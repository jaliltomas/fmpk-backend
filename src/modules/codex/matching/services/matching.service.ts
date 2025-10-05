import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import * as http from 'http';
import * as https from 'https';
import { DataSource, EntityManager } from 'typeorm';

import { ResetMatchesDto } from '../../dto/reset-matches.dto';
import { UpdateMatchStatusDto } from '../../dto/update-match-status.dto';
import { MatchCandidate } from '../../entities/match-candidate.entity';
import { MatchRow } from '../../entities/match-row.entity';
import { Session } from '../../entities/session.entity';
import { SessionSite } from '../../entities/session-site.entity';
import {
  REQUESTED_PRODUCTS_SITE_ID,
  REQUESTED_PRODUCTS_SITE_NAME,
} from '../../entities/requested-products-site.interface';
import { SessionsService } from '../../sessions/services/sessions.service';
import { MatchingNodeRegistryService } from './matching-node-registry.service';
import { MatchingNode } from '../../entities/matching-node.entity';
import {
  FilesService,
  SessionSiteFileDescriptor,
  SessionSiteProductRecord,
} from '../../../files/files.service';
import {
  MatchingProductDto,
  MatchingResponseDto,
} from '../dto/matching-response.dto';

type CatalogSourceType = 'requested' | 'site';

interface CatalogProduct {
  id: string;
  name: string;
  siteId: string;
  siteName: string;
  sourceType: CatalogSourceType;
  quantity?: number | null;
  metadata?: Record<string, unknown> | null;
}

interface CatalogSource {
  siteId: string;
  siteName: string;
  sourceType: CatalogSourceType;
  products: CatalogProduct[];
}

interface NodeMatchCandidateEntry {
  nodeId: string;
  product: CatalogProduct;
  score?: number | null;
}

interface MatchingNodeRequestProductPayload {
  id: string;
  name: string;
  siteId: string;
  siteName: string;
  sourceType: CatalogSourceType;
  quantity?: number | null;
  metadata?: Record<string, unknown> | null;
}

interface MatchingNodeRequestPayload {
  sessionId: string;
  products: MatchingNodeRequestProductPayload[];
}

interface MatchingNodeResponseCandidatePayload {
  id: string;
  name?: string;
  siteId?: string;
  siteName?: string;
  score?: number;
  sourceType?: CatalogSourceType;
  metadata?: Record<string, unknown> | null;
}

interface MatchingNodeResponseEntry {
  requestedProductId: string;
  candidates: MatchingNodeResponseCandidatePayload[];
}

interface MatchingNodeResponse {
  matches?: MatchingNodeResponseEntry[];
}

@Injectable()
export class MatchingService {
  private readonly logger = new Logger(MatchingService.name);
  private readonly nodeRequestTimeoutMs = 15000;

  constructor(
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => SessionsService))
    private readonly sessionsService: SessionsService,
    private readonly matchingNodeRegistryService: MatchingNodeRegistryService,
    private readonly filesService: FilesService,
  ) {}

  async updateMatchStatus(
    sessionId: string,
    candidateId: string,
    updateMatchStatusDto: UpdateMatchStatusDto,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const candidateRepository = manager.getRepository(MatchCandidate);

      const candidate = await candidateRepository.findOne({
        where: { id: candidateId },
        relations: { matchRow: true },
      });

      if (!candidate || candidate.matchRow.sessionId !== sessionId) {
        throw new NotFoundException('Match candidate not found for the session');
      }

      candidate.status = updateMatchStatusDto.status;
      await candidateRepository.save(candidate);

      await this.sessionsService.recalculateValidationStats(sessionId, manager);
    });
  }

  async resetMatches(
    sessionId: string,
    resetMatchesDto: ResetMatchesDto,
  ): Promise<MatchingResponseDto> {
    void resetMatchesDto;

    return this.dataSource.transaction(async (manager) => {
      const sessionRepository = manager.getRepository(Session);
      const matchRowRepository = manager.getRepository(MatchRow);
      const siteRepository = manager.getRepository(SessionSite);

      const session = await sessionRepository.findOne({
        where: { id: sessionId },
        relations: { sites: true, nodes: true },
      });

      if (!session) {
        throw new NotFoundException(`Session ${sessionId} was not found`);
      }

      const requestedSource = this.buildRequestedProductsSite(session);
      const persistedSites = session.sites?.length
        ? session.sites
        : await siteRepository.find({ where: { sessionId } });
      const siteSources = await this.loadSiteSources(sessionId, persistedSites);
      const catalogSources = requestedSource
        ? [requestedSource, ...siteSources]
        : siteSources;

      const requestedProducts = requestedSource?.products?.length
        ? requestedSource.products
        : this.buildFallbackRequestedProducts(siteSources);

      const allProducts = catalogSources.flatMap((source) => source.products);
      const matchesByRequested = await this.executeMatchingNodes(
        session,
        allProducts,
        requestedProducts,
      );

      const response = this.buildMatchingResponse(
        session.id,
        requestedProducts,
        matchesByRequested,
        siteSources,
      );

      await matchRowRepository.delete({ sessionId });

      const rows = this.buildMatchRows(
        sessionId,
        requestedProducts,
        matchesByRequested,
        siteSources,
        manager,
      );

      if (rows.length > 0) {
        await matchRowRepository.save(rows);
      }

      session.validationStats = null;
      session.matchRate = null;

      await sessionRepository.save(session);

      return response;
    });
  }

  private buildRequestedProductsSite(session: Session): CatalogSource | null {
    const siteData = session.requestedProductsSite;

    if (!siteData?.products?.length) {
      return null;
    }

    const siteId = siteData.siteId ?? REQUESTED_PRODUCTS_SITE_ID;
    const siteName = siteData.siteName ?? REQUESTED_PRODUCTS_SITE_NAME;

    const products = siteData.products
      .filter((product) => typeof product?.name === 'string')
      .map((product, index): CatalogProduct | null => {
        const trimmed = product.name.trim();
        if (trimmed.length === 0) {
          return null;
        }

        return {
          id: product.id ?? `${siteId}:${index}`,
          name: trimmed,
          siteId,
          siteName,
          sourceType: 'requested',
          quantity:
            typeof product.quantity === 'number' && Number.isFinite(product.quantity)
              ? product.quantity
              : null,
          metadata:
            product.metadata && typeof product.metadata === 'object'
              ? (product.metadata as Record<string, unknown>)
              : null,
        };
      })
      .filter((product): product is CatalogProduct => product !== null);

    if (!products.length) {
      return null;
    }

    return {
      siteId,
      siteName,
      sourceType: 'requested',
      products,
    };
  }

  private async loadSiteSources(
    sessionId: string,
    sites: SessionSite[],
  ): Promise<CatalogSource[]> {
    const sources: CatalogSource[] = [];

    for (const site of sites) {
      const descriptor: SessionSiteFileDescriptor = {
        id: site.id,
        name: site.name,
        storageKey: site.storageKey,
      };

      let records: SessionSiteProductRecord[] = [];

      try {
        records = await this.filesService.loadSessionSiteProducts(sessionId, descriptor);
      } catch (error) {
        this.logger.warn(
          `Failed to load catalog for site ${site.id} in session ${sessionId}: ${error instanceof Error ? error.message : String(error)}`,
        );
        records = [];
      }

      if (!Array.isArray(records) || records.length === 0) {
        records = this.buildFallbackSiteProducts(site);
      }

      const products = records
        .map((record, index) => this.normalizeSiteProduct(record, site, index))
        .filter((product): product is CatalogProduct => product !== null);

      sources.push({
        siteId: site.id,
        siteName: site.name,
        sourceType: 'site',
        products,
      });
    }

    return sources;
  }

  private normalizeSiteProduct(
    record: SessionSiteProductRecord,
    site: SessionSite,
    index: number,
  ): CatalogProduct | null {
    if (!record) {
      return null;
    }

    const nameCandidate =
      typeof record.name === 'string' && record.name.trim().length > 0
        ? record.name.trim()
        : `Producto ${index + 1}`;

    const identifier =
      typeof record.id === 'string' && record.id.length > 0
        ? record.id
        : `${site.id}:${index}`;

    const { id: _id, name: _name, quantity: _quantity, metadata, ...rest } = record;
    const normalizedMetadata =
      metadata && typeof metadata === 'object'
        ? (metadata as Record<string, unknown>)
        : Object.keys(rest).length > 0
        ? (rest as Record<string, unknown>)
        : null;

    return {
      id: identifier,
      name: nameCandidate,
      siteId: site.id,
      siteName: site.name,
      sourceType: 'site',
      quantity:
        typeof record.quantity === 'number' && Number.isFinite(record.quantity)
          ? record.quantity
          : null,
      metadata: normalizedMetadata,
    };
  }

  private buildFallbackSiteProducts(site: SessionSite): SessionSiteProductRecord[] {
    const total = Math.max(Math.min(site.productCount ?? 0, 20), 1);

    return Array.from({ length: total }, (_, index) => ({
      id: `${site.id}:placeholder-${index}`,
      name: `Producto ${index + 1} (${site.name})`,
      quantity: null,
      metadata: { placeholder: true },
    }));
  }

  private buildFallbackRequestedProducts(siteSources: CatalogSource[]): CatalogProduct[] {
    if (!siteSources.length) {
      return [
        {
          id: `${REQUESTED_PRODUCTS_SITE_ID}:placeholder-0`,
          name: 'Producto 1',
          siteId: REQUESTED_PRODUCTS_SITE_ID,
          siteName: REQUESTED_PRODUCTS_SITE_NAME,
          sourceType: 'requested',
          metadata: { placeholder: true },
        },
      ];
    }

    const sampleName =
      siteSources[0]?.products?.[0]?.name ?? 'Producto 1';

    return [
      {
        id: `${REQUESTED_PRODUCTS_SITE_ID}:placeholder-0`,
        name: sampleName,
        siteId: REQUESTED_PRODUCTS_SITE_ID,
        siteName: REQUESTED_PRODUCTS_SITE_NAME,
        sourceType: 'requested',
        metadata: { placeholder: true },
      },
    ];
  }

  private async executeMatchingNodes(
    session: Session,
    allProducts: CatalogProduct[],
    requestedProducts: CatalogProduct[],
  ): Promise<Map<string, NodeMatchCandidateEntry[]>> {
    const matches = new Map<string, NodeMatchCandidateEntry[]>();

    if (!requestedProducts.length) {
      return matches;
    }

    const productMap = new Map<string, CatalogProduct>(
      allProducts.map((product) => [product.id, product]),
    );

    if (!session.nodes?.length) {
      return matches;
    }

    const availableNodes = await this.matchingNodeRegistryService.listNodes();
    const nodesByType = new Map<string, MatchingNode>(
      availableNodes.map((node) => [node.type, node]),
    );

    const payload = this.buildNodeRequestPayload(session.id, allProducts);

    for (const sessionNode of session.nodes) {
      const node = nodesByType.get(sessionNode.name);

      if (!node) {
        this.logger.warn(
          `Matching node of type ${sessionNode.name} is not registered`,
        );
        continue;
      }

      try {
        const response = await this.callMatchingNode(node, payload);
        this.mergeNodeMatches(matches, response, productMap, node);
      } catch (error) {
        this.logger.warn(
          `Node ${node.id} failed while matching session ${session.id}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    }

    return matches;
  }

  private buildNodeRequestPayload(
    sessionId: string,
    products: CatalogProduct[],
  ): MatchingNodeRequestPayload {
    return {
      sessionId,
      products: products.map((product) => ({
        id: product.id,
        name: product.name,
        siteId: product.siteId,
        siteName: product.siteName,
        sourceType: product.sourceType,
        quantity: product.quantity ?? null,
        metadata: product.metadata ?? null,
      })),
    };
  }

  private async callMatchingNode(
    node: MatchingNode,
    payload: MatchingNodeRequestPayload,
  ): Promise<MatchingNodeResponse> {
    const endpointPath = this.resolveMatchEndpoint(node);
    const url = this.resolveNodeUrl(node, endpointPath).toString();

    const parsedUrl = new URL(url);
    const isHttps = parsedUrl.protocol === 'https:';
    const requestFn = isHttps ? https.request : http.request;

    const requestOptions: http.RequestOptions = {
      protocol: parsedUrl.protocol,
      hostname: parsedUrl.hostname,
      port: parsedUrl.port,
      path: `${parsedUrl.pathname}${parsedUrl.search}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-ndjson',
        Accept: 'application/json',
      },
    };

    try {
      const rawResponse = await new Promise<string>((resolve, reject) => {
        let settled = false;
        const finalizeResolve = (value: string) => {
          if (!settled) {
            settled = true;
            resolve(value);
          }
        };
        const finalizeReject = (reason: Error) => {
          if (!settled) {
            settled = true;
            reject(reason);
          }
        };
        const wrapRequestError = (reason: unknown): Error =>
          reason instanceof Error
            ? new Error(`Node ${node.id} request failed: ${reason.message}`)
            : new Error(`Node ${node.id} request failed: ${String(reason)}`);

        const req = requestFn(requestOptions, (res) => {
          const { statusCode = 0 } = res;
          const chunks: Buffer[] = [];

          res.on('error', (resError) => {
            finalizeReject(wrapRequestError(resError));
          });

          res.on('data', (chunk) => {
            chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          });

          res.on('end', () => {
            const body = Buffer.concat(chunks).toString('utf8');

            if (statusCode < 200 || statusCode >= 300) {
              const snippet = body ? `: ${body.slice(0, 500)}` : '';
              finalizeReject(
                new Error(
                  `Node ${node.id} request failed with status ${statusCode}${snippet}`,
                ),
              );
              return;
            }

            finalizeResolve(body);
          });
        });

        req.on('error', (error) => {
          finalizeReject(wrapRequestError(error));
        });

        req.setTimeout(this.nodeRequestTimeoutMs, () => {
          finalizeReject(
            new Error(
              `Node ${node.id} request timed out after ${this.nodeRequestTimeoutMs}ms`,
            ),
          );
          req.destroy();
        });

        for (const product of payload.products) {
          req.write(`${JSON.stringify(product)}\n`);
        }

        req.end();
      });

      const trimmed = rawResponse.trim();
      const parsed = trimmed ? JSON.parse(trimmed) : {};

      return this.normalizeNodeResponse(parsed, node);
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`Node ${node.id} returned an invalid JSON response`);
      }

      throw error instanceof Error
        ? error
        : new Error(`Node ${node.id} request failed: ${String(error)}`);
    }
  }

  private normalizeNodeResponse(
    data: unknown,
    node: MatchingNode,
  ): MatchingNodeResponse {
    if (!data) {
      return { matches: [] };
    }

    if (typeof data !== 'object') {
      throw new Error(`Node ${node.id} returned an invalid response payload`);
    }

    const response = data as MatchingNodeResponse;
    const matches = Array.isArray(response.matches) ? response.matches : [];

    return {
      ...response,
      matches,
    };
  }

  private resolveMatchEndpoint(node: MatchingNode): string {
    switch (node.type) {
      case 'Nombre':
        return '/matchByName';
      case 'AIEAN':
      case 'EAN':
        return '/match';
      default:
        return '/match';
    }
  }

  private resolveNodeUrl(node: MatchingNode, endpointPath: string): URL {
    const normalizedPath = endpointPath.startsWith('/')
      ? endpointPath
      : `/${endpointPath}`;
    const hasProtocol =
      node.host.startsWith('http://') || node.host.startsWith('https://');
    const base = hasProtocol ? node.host : `http://${node.host}`;
    const baseWithTrailingSlash = base.endsWith('/') ? base : `${base}/`;

    const url = new URL(normalizedPath, baseWithTrailingSlash);

    if (!url.port && node.port) {
      url.port = String(node.port);
    }

    return url;
  }

  private mergeNodeMatches(
    matches: Map<string, NodeMatchCandidateEntry[]>,
    response: MatchingNodeResponse,
    productMap: Map<string, CatalogProduct>,
    node: MatchingNode,
  ): void {
    if (!response?.matches) {
      return;
    }

    for (const entry of response.matches) {
      if (!entry?.requestedProductId) {
        continue;
      }

      const requestedProduct = productMap.get(entry.requestedProductId);

      if (!requestedProduct || requestedProduct.sourceType !== 'requested') {
        continue;
      }

      const existing = matches.get(requestedProduct.id) ?? [];

      for (const candidatePayload of entry.candidates ?? []) {
        const candidateProduct = this.resolveCandidateProduct(
          candidatePayload,
          productMap,
          node,
        );

        if (!candidateProduct || candidateProduct.sourceType !== 'site') {
          continue;
        }

        if (
          existing.some(
            (candidate) => candidate.product.id === candidateProduct.id,
          )
        ) {
          continue;
        }

        existing.push({
          nodeId: node.id,
          product: candidateProduct,
          score:
            typeof candidatePayload.score === 'number'
              ? candidatePayload.score
              : null,
        });
      }

      if (existing.length > 0) {
        matches.set(requestedProduct.id, existing);
      }
    }
  }

  private resolveCandidateProduct(
    payload: MatchingNodeResponseCandidatePayload,
    productMap: Map<string, CatalogProduct>,
    node: MatchingNode,
  ): CatalogProduct | null {
    if (!payload) {
      return null;
    }

    if (payload.id) {
      const existing = productMap.get(payload.id);
      if (existing) {
        return existing;
      }
    }

    const siteId = payload.siteId ?? `${node.id}-external-site`;
    const siteName = payload.siteName ?? 'External site';
    const identifier =
      payload.id ?? `${node.id}:${siteId}:${payload.name ?? 'product'}`;
    const name =
      typeof payload.name === 'string' && payload.name.trim().length > 0
        ? payload.name.trim()
        : identifier;

    const product: CatalogProduct = {
      id: identifier,
      name,
      siteId,
      siteName,
      sourceType: payload.sourceType === 'requested' ? 'requested' : 'site',
      quantity: null,
      metadata:
        payload.metadata && typeof payload.metadata === 'object'
          ? (payload.metadata as Record<string, unknown>)
          : null,
    };

    productMap.set(product.id, product);
    return product;
  }

  private buildMatchRows(
    sessionId: string,
    requestedProducts: CatalogProduct[],
    matchesByRequested: Map<string, NodeMatchCandidateEntry[]>,
    siteSources: CatalogSource[],
    manager: EntityManager,
  ): MatchRow[] {
    const matchRowRepository = manager.getRepository(MatchRow);

    return requestedProducts.map((product, index) => {
      const row = matchRowRepository.create({
        sessionId,
        productName: product.name,
        orderIndex: index,
      });

      const matches = this.resolveMatchesForProduct(
        product,
        matchesByRequested,
        siteSources,
      );

      row.candidates = matches.map((candidate) =>
        this.createMatchCandidate(candidate, manager),
      );

      return row;
    });
  }

  private resolveMatchesForProduct(
    product: CatalogProduct,
    matchesByRequested: Map<string, NodeMatchCandidateEntry[]>,
    siteSources: CatalogSource[],
  ): NodeMatchCandidateEntry[] {
    const matches = matchesByRequested.get(product.id);

    if (matches) {
      return matches;
    }

    return this.buildFallbackCandidatesForProduct(product, siteSources);
  }

  private buildMatchingResponse(
    sessionId: string,
    requestedProducts: CatalogProduct[],
    matchesByRequested: Map<string, NodeMatchCandidateEntry[]>,
    siteSources: CatalogSource[],
  ): MatchingResponseDto {
    const rows = requestedProducts.map((product) => {
      const matches = this.resolveMatchesForProduct(
        product,
        matchesByRequested,
        siteSources,
      );

      return {
        requestedProduct: this.mapProductToDto(product),
        candidates: matches.map((match) => ({
          nodeId: match.nodeId,
          score: match.score ?? null,
          product: this.mapProductToDto(match.product),
        })),
      };
    });

    return {
      sessionId,
      rows,
    };
  }

  private mapProductToDto(product: CatalogProduct): MatchingProductDto {
    return {
      id: product.id,
      name: product.name,
      siteId: product.siteId,
      siteName: product.siteName,
      sourceType: product.sourceType,
      quantity: product.quantity ?? null,
      metadata: product.metadata ?? null,
    };
  }

  private buildFallbackCandidatesForProduct(
    product: CatalogProduct,
    siteSources: CatalogSource[],
  ): NodeMatchCandidateEntry[] {
    void product;
    const candidates: NodeMatchCandidateEntry[] = [];

    for (const siteSource of siteSources) {
      const fallbackProduct = siteSource.products[0];

      if (!fallbackProduct) {
        continue;
      }

      if (
        candidates.some(
          (candidate) => candidate.product.id === fallbackProduct.id,
        )
      ) {
        continue;
      }

      candidates.push({
        nodeId: 'fallback',
        product: fallbackProduct,
        score: null,
      });
    }

    return candidates;
  }

  private createMatchCandidate(
    candidate: NodeMatchCandidateEntry,
    manager: EntityManager,
  ): MatchCandidate {
    const candidateRepository = manager.getRepository(MatchCandidate);

    return candidateRepository.create({
      siteId: candidate.product.sourceType === 'site' ? candidate.product.siteId : null,
      siteName: candidate.product.siteName,
      value: JSON.stringify({
        productId: candidate.product.id,
        name: candidate.product.name,
        nodeId: candidate.nodeId,
        score: candidate.score ?? null,
        quantity: candidate.product.quantity ?? null,
        metadata: candidate.product.metadata ?? null,
        sourceType: candidate.product.sourceType,
      }),
      status: null,
      sourceType: candidate.product.sourceType,
    });
  }
}
