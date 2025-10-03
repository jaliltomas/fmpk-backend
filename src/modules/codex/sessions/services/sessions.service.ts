import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Express } from 'express';
import { DataSource, EntityManager } from 'typeorm';

import { UploadRequestedProductsDto } from '../../dto/upload-requested-products.dto';
import { CreateSessionDto } from '../../dto/create-session.dto';
import { PaginationDto } from '../../dto/pagination.dto';
import { FilesService } from '../../../files/files.service';
import { Session } from '../../entities/session.entity';
import { SessionNode } from '../../entities/session-node.entity';
import { SessionSite } from '../../entities/session-site.entity';
import { MatchCandidate } from '../../entities/match-candidate.entity';
import {
  REQUESTED_PRODUCTS_SITE_ID,
  REQUESTED_PRODUCTS_SITE_NAME,
  RequestedProductRecord,
} from '../../entities/requested-products-site.interface';

@Injectable()
export class SessionsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly filesService: FilesService,
  ) {}

  async createSession(createSessionDto: CreateSessionDto): Promise<Session> {
    return this.dataSource.transaction(async (manager) => {
      const sessionRepository = manager.getRepository(Session);
      const nodeRepository = manager.getRepository(SessionNode);
      const siteRepository = manager.getRepository(SessionSite);

      const session = sessionRepository.create({
        name: createSessionDto.name,
        requestedProductsCount: 0,
        totalSiteProducts: 0,
        matchRate: null,
        validationStats: null,
      });

      await sessionRepository.save(session);

      if (createSessionDto.nodes?.length) {
        const nodes = createSessionDto.nodes.map((nodeDto, index) =>
          nodeRepository.create({
            sessionId: session.id,
            name: nodeDto.nodeType,
            orderIndex: index,
          }),
        );

        await nodeRepository.save(nodes);
      }

      if (createSessionDto.sites?.length) {
        const sites = createSessionDto.sites.map((siteDto, index) => {
          const augmentedSite = siteDto as unknown as {
            productCount?: number;
            storageKey?: string;
            fileName?: string;
          };

          const productCount = augmentedSite.productCount ?? 0;

          return siteRepository.create({
            sessionId: session.id,
            name: siteDto.name,
            baseUrl: siteDto.baseUrl,
            fileName:
              augmentedSite.fileName ??
              siteDto.file?.originalname ??
              `${siteDto.name}-${index + 1}`,
            productCount,
            storageKey:
              augmentedSite.storageKey ??
              `sessions/${session.id}/sites/${Date.now()}-${Math.random()
                .toString(36)
                .slice(2)}`,
          });
        });

        await siteRepository.save(sites);
        await this.refreshTotalSiteProducts(session.id, manager);
      }

      return sessionRepository.findOneOrFail({
        where: { id: session.id },
        relations: { nodes: true, sites: true },
      });
    });
  }

  async getSessions(paginationDto: PaginationDto) {
    const { page = 1, pageSize = 25 } = paginationDto;

    const sessionRepository = this.dataSource.getRepository(Session);
    const [sessions, total] = await sessionRepository.findAndCount({
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      relations: { nodes: true, sites: true },
    });

    return {
      data: sessions,
      pagination: {
        page,
        pageSize,
        totalItems: total,
        totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
      },
    };
  }

  async getSessionById(sessionId: string) {
    const sessionRepository = this.dataSource.getRepository(Session);

    const session = await sessionRepository.findOne({
      where: { id: sessionId },
      relations: { nodes: true, sites: true, matchRows: { candidates: true } },
    });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} was not found`);
    }

    return session;
  }

  async uploadRequestedProducts(
    sessionId: string,
    uploadRequestedProductsDto: UploadRequestedProductsDto,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const sessionRepository = manager.getRepository(Session);
      const session = await sessionRepository.findOne({ where: { id: sessionId } });

      if (!session) {
        throw new NotFoundException(`Session ${sessionId} was not found`);
      }

      const { products, metadata } = this.parseRequestedProducts(
        uploadRequestedProductsDto.file,
      );

      session.requestedProductsCount = products.length;
      session.requestedProductsFileMetadata = metadata;
      session.requestedProductsSite = {
        siteId: REQUESTED_PRODUCTS_SITE_ID,
        siteName: REQUESTED_PRODUCTS_SITE_NAME,
        products,
      };
      session.matchRate = null;
      session.validationStats = null;

      await sessionRepository.save(session);
    });

    await this.filesService.storeSessionRequestedProducts(
      sessionId,
      uploadRequestedProductsDto.file,
    );

    return;
  }

  async recalculateValidationStats(
    sessionId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const activeManager = manager ?? this.dataSource.manager;
    const candidateRepository = activeManager.getRepository(MatchCandidate);
    const sessionRepository = activeManager.getRepository(Session);

    const session = await sessionRepository.findOne({ where: { id: sessionId } });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} was not found`);
    }

    const rawStats = await candidateRepository
      .createQueryBuilder('candidate')
      .innerJoin('candidate.matchRow', 'matchRow')
      .where('matchRow.sessionId = :sessionId', { sessionId })
      .select(
        'SUM(CASE WHEN candidate.status IS NOT NULL THEN 1 ELSE 0 END)',
        'validated',
      )
      .addSelect(
        'SUM(CASE WHEN candidate.status = true THEN 1 ELSE 0 END)',
        'correct',
      )
      .getRawOne<{ validated: string | null; correct: string | null }>();

    const validatedCount = Number(rawStats?.validated ?? 0);
    const correctCount = Number(rawStats?.correct ?? 0);
    const effectiveness =
      validatedCount > 0 ? correctCount / validatedCount : 0;
    const matchRate =
      session.requestedProductsCount > 0 && validatedCount > 0
        ? correctCount / session.requestedProductsCount
        : null;

    session.validationStats =
      validatedCount === 0
        ? null
        : {
            validated: validatedCount,
            correct: correctCount,
            effectiveness,
          };
    session.matchRate = matchRate;

    await sessionRepository.save(session);
  }

  async refreshTotalSiteProducts(
    sessionId: string,
    manager?: EntityManager,
  ): Promise<void> {
    const activeManager = manager ?? this.dataSource.manager;
    const siteRepository = activeManager.getRepository(SessionSite);
    const sessionRepository = activeManager.getRepository(Session);

    const session = await sessionRepository.findOne({ where: { id: sessionId } });

    if (!session) {
      throw new NotFoundException(`Session ${sessionId} was not found`);
    }

    const rawTotal = await siteRepository
      .createQueryBuilder('site')
      .select('COALESCE(SUM(site.productCount), 0)', 'total')
      .where('site.sessionId = :sessionId', { sessionId })
      .getRawOne<{ total: string | null }>();

    session.totalSiteProducts = Number(rawTotal?.total ?? 0);

    await sessionRepository.save(session);
  }

  private parseRequestedProducts(file: Express.Multer.File): {
    products: RequestedProductRecord[];
    metadata: Record<string, unknown>;
  } {
    if (!file?.buffer) {
      throw new BadRequestException('The uploaded file does not contain data');
    }

    let parsed: unknown;

    try {
      parsed = JSON.parse(file.buffer.toString('utf-8'));
    } catch (error) {
      throw new BadRequestException('The uploaded file must contain valid JSON');
    }

    if (!Array.isArray(parsed)) {
      throw new BadRequestException('The JSON payload must be an array');
    }

    const products = parsed.map<RequestedProductRecord>((entry, index) => {
      const fallbackName = `Producto ${index + 1}`;
      const id = `${REQUESTED_PRODUCTS_SITE_ID}:${index}`;

      if (typeof entry === 'string') {
        const trimmed = entry.trim();
        return {
          id,
          name: trimmed.length > 0 ? trimmed : fallbackName,
          quantity: null,
          metadata: { raw: entry },
        };
      }

      if (entry && typeof entry === 'object') {
        const rawEntry = entry as Record<string, unknown>;
        const rawName =
          typeof rawEntry.name === 'string' ? rawEntry.name.trim() : fallbackName;
        const quantity =
          typeof rawEntry.quantity === 'number' && Number.isFinite(rawEntry.quantity)
            ? rawEntry.quantity
            : null;

        return {
          id,
          name: rawName.length > 0 ? rawName : fallbackName,
          quantity,
          metadata: rawEntry,
        };
      }

      return {
        id,
        name: fallbackName,
        quantity: null,
        metadata: { raw: entry },
      };
    });

    const metadata = {
      originalName: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      products,
    };

    return { products, metadata };
  }
}
