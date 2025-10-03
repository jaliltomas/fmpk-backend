import { HttpService } from '@nestjs/axios';
import { Injectable, NotFoundException } from '@nestjs/common';
import type { AxiosError, AxiosResponse } from 'axios';
import { firstValueFrom } from 'rxjs';

import { CreateProductDto } from './dto/create-product.dto';
import { MatchingNode, MatchingNodeRepository } from './nodes.repository';

interface MatchResult {
  matches: unknown[];
}

@Injectable()
export class MatchingService {
  constructor(
    private readonly httpService: HttpService,
    private readonly nodeRepository: MatchingNodeRepository,
  ) {}

  async matchProduct(
    product: CreateProductDto,
    nodeIds: string[],
  ): Promise<Record<string, MatchResult>> {
    const nodes = nodeIds.map((nodeId) => {
      const node = this.nodeRepository.findById(nodeId);
      if (!node) {
        throw new NotFoundException(`Matching node ${nodeId} not found`);
      }
      return node;
    });

    const results: Record<string, MatchResult> = {};

    await Promise.all(
      nodes.map(async (node) => {
        try {
          const response: AxiosResponse<unknown> = await firstValueFrom(
            this.httpService.post<unknown>(
              `http://${node.host}:${node.port}/match`,
              product,
            ),
          );

          results[node.id] = this.normalizeNodeResponse(response.data);
        } catch (error) {
          results[node.id] = {
            matches: this.buildSimulatedMatches(product, node, error as AxiosError),
          };
        }
      }),
    );

    return results;
  }

  private normalizeNodeResponse(data: unknown): MatchResult {
    if (data && typeof data === 'object' && 'matches' in (data as Record<string, unknown>)) {
      const matches = (data as Record<string, unknown>).matches;
      if (Array.isArray(matches)) {
        return { matches };
      }
    }

    if (Array.isArray(data)) {
      return { matches: data };
    }

    return { matches: [data] };
  }

  private buildSimulatedMatches(
    product: CreateProductDto,
    node: MatchingNode,
    error: AxiosError,
  ): unknown[] {
    const message = error?.message ?? 'Unknown error';
    return [
      {
        title: `Simulated match for ${product.nombre}`,
        ean: product.ean,
        node: node.type,
        confidence: 0,
        reason: `Fallback due to error contacting node: ${message}`,
      },
    ];
  }
}
