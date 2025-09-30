import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Client, credentials } from '@grpc/grpc-js';
import * as http from 'node:http';
import { Repository } from 'typeorm';

import { CreateMatchingNodeDto } from '../dto/create-matching-node.dto';
import { UpdateMatchingNodeDto } from '../dto/update-matching-node.dto';
import { MatchingGateway } from '../gateways/matching.gateway';
import { MatchingNode } from '../../entities/matching-node.entity';

export type NodeHealthState = 'online' | 'offline' | 'degraded' | 'unknown';

interface NodeConnectionState {
  status: NodeHealthState;
  failureCount: number;
  lastHeartbeat?: Date | null;
  lastError?: string;
  httpAgent?: http.Agent;
  grpcClient?: Client;
}

@Injectable()
export class MatchingNodeRegistryService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(MatchingNodeRegistryService.name);
  private readonly nodeStates = new Map<string, NodeConnectionState>();
  private healthInterval?: NodeJS.Timeout;
  private readonly healthIntervalMs: number;
  private readonly healthTimeoutMs: number;
  private readonly maxRetries: number;
  private readonly protocol: 'http' | 'grpc';

  constructor(
    @InjectRepository(MatchingNode)
    private readonly matchingNodeRepository: Repository<MatchingNode>,
    private readonly configService: ConfigService,
    private readonly matchingGateway: MatchingGateway,
  ) {
    this.healthIntervalMs =
      this.configService.get<number>('MATCHING_NODE_HEALTH_INTERVAL_MS') ?? 30000;
    this.healthTimeoutMs =
      this.configService.get<number>('MATCHING_NODE_HEALTH_TIMEOUT_MS') ?? 5000;
    this.maxRetries =
      this.configService.get<number>('MATCHING_NODE_HEALTH_MAX_RETRIES') ?? 2;
    this.protocol =
      (this.configService.get<'http' | 'grpc'>('MATCHING_NODE_HEALTH_PROTOCOL') ??
        'http');
  }

  async onModuleInit(): Promise<void> {
    await this.hydrateStates();
    await this.executeHealthCheckCycle();
    this.scheduleHealthChecks();
  }

  onModuleDestroy(): void {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
    }

    for (const state of this.nodeStates.values()) {
      state.httpAgent?.destroy();
      state.grpcClient?.close();
    }

    this.nodeStates.clear();
  }

  async createNode(createMatchingNodeDto: CreateMatchingNodeDto): Promise<MatchingNode> {
    const node = this.matchingNodeRepository.create({
      type: createMatchingNodeDto.type,
      displayName: createMatchingNodeDto.displayName,
      host: createMatchingNodeDto.host,
      port: createMatchingNodeDto.port,
      supportedCapabilities:
        createMatchingNodeDto.capabilities?.map((capability) => capability.value) ?? [],
      healthStatus: 'unknown',
    });

    const saved = await this.matchingNodeRepository.save(node);
    this.nodeStates.set(saved.id, {
      status: 'unknown',
      failureCount: 0,
      lastHeartbeat: saved.lastHeartbeat ?? null,
    });

    await this.checkNodeHealth(saved, { emitAlways: true });

    return this.matchingNodeRepository.findOneByOrFail({ id: saved.id });
  }

  async listNodes(): Promise<MatchingNode[]> {
    return this.matchingNodeRepository.find({ order: { displayName: 'ASC' } });
  }

  async updateNode(
    nodeId: string,
    updateMatchingNodeDto: UpdateMatchingNodeDto,
  ): Promise<MatchingNode> {
    const node = await this.matchingNodeRepository.findOne({ where: { id: nodeId } });

    if (!node) {
      throw new NotFoundException(`Matching node ${nodeId} was not found`);
    }

    if (updateMatchingNodeDto.displayName !== undefined) {
      node.displayName = updateMatchingNodeDto.displayName;
    }
    if (updateMatchingNodeDto.host !== undefined) {
      node.host = updateMatchingNodeDto.host;
    }
    if (updateMatchingNodeDto.port !== undefined) {
      node.port = updateMatchingNodeDto.port;
    }
    if (updateMatchingNodeDto.type !== undefined) {
      node.type = updateMatchingNodeDto.type;
    }
    if (updateMatchingNodeDto.capabilities !== undefined) {
      node.supportedCapabilities = updateMatchingNodeDto.capabilities.map(
        (capability) => capability.value,
      );
    }

    const updated = await this.matchingNodeRepository.save(node);
    await this.checkNodeHealth(updated, { emitAlways: true });

    return updated;
  }

  async pingNode(
    nodeId: string,
  ): Promise<{ status: NodeHealthState; lastHeartbeat?: Date | null; lastError?: string }> {
    const node = await this.matchingNodeRepository.findOne({ where: { id: nodeId } });

    if (!node) {
      throw new NotFoundException(`Matching node ${nodeId} was not found`);
    }

    await this.checkNodeHealth(node, { emitAlways: true, force: true });

    const state = this.nodeStates.get(node.id);

    return {
      status: state?.status ?? 'unknown',
      lastHeartbeat: state?.lastHeartbeat,
      lastError: state?.lastError,
    };
  }

  reportNodeProgress(payload: {
    sessionId: string;
    nodeId: string;
    jobId: string;
    processed: number;
    total: number;
  }): void {
    this.matchingGateway.emitNodeProgress(payload);
  }

  async reportNodeError(payload: {
    sessionId: string;
    nodeId: string;
    jobId: string;
    error: string;
  }): Promise<void> {
    const state = this.nodeStates.get(payload.nodeId);
    if (state) {
      state.status = 'degraded';
      state.lastError = payload.error;
    }

    await this.matchingNodeRepository.update(payload.nodeId, {
      healthStatus: 'degraded',
    });

    await this.emitNodeStatusSnapshot();
    this.matchingGateway.emitNodeError(payload);
  }

  private scheduleHealthChecks(): void {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
    }

    this.healthInterval = setInterval(() => {
      void this.executeHealthCheckCycle().catch((error) => {
        this.logger.error('Scheduled health check cycle failed', error instanceof Error ? error.stack : String(error));
      });
    }, this.healthIntervalMs);
  }

  private async executeHealthCheckCycle(): Promise<void> {
    const nodes = await this.matchingNodeRepository.find();

    await Promise.all(nodes.map((node) => this.checkNodeHealth(node)));
  }

  private async hydrateStates(): Promise<void> {
    const nodes = await this.matchingNodeRepository.find();
    for (const node of nodes) {
      this.nodeStates.set(node.id, {
        status: this.normaliseState(node.healthStatus),
        failureCount: 0,
        lastHeartbeat: node.lastHeartbeat ?? null,
      });
    }
  }

  private async checkNodeHealth(
    node: MatchingNode,
    options: { emitAlways?: boolean; force?: boolean } = {},
  ): Promise<void> {
    const state = this.nodeStates.get(node.id) ?? {
      status: 'unknown' as NodeHealthState,
      failureCount: 0,
      lastHeartbeat: node.lastHeartbeat ?? null,
    };

    if (!this.nodeStates.has(node.id)) {
      this.nodeStates.set(node.id, state);
    }

    try {
      await this.performHealthCheck(node, state, options.force ?? false);

      state.failureCount = 0;
      state.lastError = undefined;
      state.status = 'online';
      state.lastHeartbeat = new Date();

      await this.matchingNodeRepository.update(node.id, {
        healthStatus: 'online',
        lastHeartbeat: state.lastHeartbeat,
      });

      if (options.emitAlways || node.healthStatus !== 'online') {
        await this.emitNodeStatusSnapshot();
      }
    } catch (error) {
      state.failureCount += 1;
      state.lastError = error instanceof Error ? error.message : String(error);

      const status: NodeHealthState =
        state.failureCount > this.maxRetries ? 'offline' : 'degraded';
      state.status = status;

      if (status === 'offline') {
        await this.matchingNodeRepository.update(node.id, {
          healthStatus: status,
          lastHeartbeat: state.lastHeartbeat ?? null,
        });
      } else {
        state.lastHeartbeat = new Date();
        await this.matchingNodeRepository.update(node.id, {
          healthStatus: status,
          lastHeartbeat: state.lastHeartbeat,
        });
      }

      this.logger.warn(
        `Health check for node ${node.displayName} (${node.id}) failed: ${state.lastError}`,
      );

      if (options.emitAlways || node.healthStatus !== status) {
        await this.emitNodeStatusSnapshot();
      }
    }
  }

  private async performHealthCheck(
    node: MatchingNode,
    state: NodeConnectionState,
    force: boolean,
  ): Promise<void> {
    if (this.protocol === 'grpc') {
      await this.performGrpcHealthCheck(node, state, force);
      return;
    }

    await this.performHttpHealthCheck(node, state, force);
  }

  private async performHttpHealthCheck(
    node: MatchingNode,
    state: NodeConnectionState,
    force: boolean,
  ): Promise<void> {
    const agent = state.httpAgent ?? new http.Agent({ keepAlive: true });
    state.httpAgent = agent;

    if (!force && state.status === 'online') {
      // No need to re-establish anything, keep-alive agent will reuse the connection.
    }

    await new Promise<void>((resolve, reject) => {
      const request = http.request(
        {
          host: node.host,
          port: node.port,
          path: '/health',
          agent,
          timeout: this.healthTimeoutMs,
        },
        (response) => {
          // Consume response to free socket and determine status.
          response.on('data', () => undefined);
          response.on('end', () => {
            if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
              resolve();
            } else {
              reject(
                new Error(
                  `Unexpected HTTP status ${response.statusCode ?? 'unknown'} during health check`,
                ),
              );
            }
          });
        },
      );

      request.on('error', (err) => {
        reject(err);
      });

      request.on('timeout', () => {
        request.destroy(new Error('Health check request timed out'));
      });

      request.end();
    });
  }

  private async performGrpcHealthCheck(
    node: MatchingNode,
    state: NodeConnectionState,
    force: boolean,
  ): Promise<void> {
    if (!state.grpcClient || force) {
      state.grpcClient?.close();
      state.grpcClient = new Client(
        `${node.host}:${node.port}`,
        credentials.createInsecure(),
      );
    }

    await new Promise<void>((resolve, reject) => {
      const deadline = Date.now() + this.healthTimeoutMs;
      state.grpcClient!.waitForReady(deadline, (error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }

  private async emitNodeStatusSnapshot(): Promise<void> {
    const nodes = await this.matchingNodeRepository.find({ order: { displayName: 'ASC' } });

    this.matchingGateway.emitNodeStatus({
      nodes: nodes.map((node) => {
        const state = this.nodeStates.get(node.id);
        return {
          nodeId: node.id,
          displayName: node.displayName,
          status: this.mapStatusForEvent(state?.status ?? node.healthStatus),
          lastHeartbeat: (state?.lastHeartbeat ?? node.lastHeartbeat ?? undefined)?.toISOString(),
          healthMessage: state?.lastError,
        };
      }),
    });
  }

  private normaliseState(status: string | NodeHealthState): NodeHealthState {
    if (status === 'online' || status === 'offline' || status === 'degraded') {
      return status;
    }

    return 'unknown';
  }

  private mapStatusForEvent(
    status: string | NodeHealthState,
  ): 'online' | 'offline' | 'degraded' {
    const normalised = this.normaliseState(status);

    if (normalised === 'online' || normalised === 'offline') {
      return normalised;
    }

    return 'degraded';
  }
}
