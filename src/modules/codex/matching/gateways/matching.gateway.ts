import { Logger } from '@nestjs/common';
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

export interface MatchingProgressPayload {
  sessionId: string;
  jobId: string;
  percent: number;
}

export interface MatchingCompletedPayload {
  sessionId: string;
  jobId: string;
  summary: MatchingSummary;
}

export interface MatchingSummary {
  totalMatchRows: number;
  validatedCount: number;
  correctCount: number;
  effectiveness: number;
}

export interface ValidationUpdatedPayload {
  sessionId: string;
  matchRowId: string;
  siteId: string;
  status: boolean | null;
  validationStats: ValidationStatistics;
}

export interface ValidationStatistics {
  validated: number;
  correct: number;
  effectiveness: number;
  matchRate: number;
}

export interface MatchingNodeStatusPayload {
  nodes: MatchingNodeStatus[];
}

export interface MatchingNodeStatus {
  nodeId: string;
  displayName: string;
  status: 'online' | 'offline' | 'degraded';
  lastHeartbeat?: string;
  healthMessage?: string;
}

export interface MatchingNodeProgressPayload {
  sessionId: string;
  nodeId: string;
  jobId: string;
  processed: number;
  total: number;
}

export interface MatchingNodeErrorPayload {
  sessionId: string;
  nodeId: string;
  jobId: string;
  error: string;
}

/**
 * MatchingGateway centralises all websocket interactions for Codex matching operations.
 *
 * Frontend consumers should connect to the namespace `/ws/matching` and listen for the
 * following events:
 * - `matching.progress`: Receives {@link MatchingProgressPayload} updates while a job runs.
 * - `matching.completed`: Receives {@link MatchingCompletedPayload} once a job finalises.
 * - `matching.validation-updated`: Receives {@link ValidationUpdatedPayload} whenever a
 *   validation status changes for any candidate.
 * - `matching.node-status`: Receives {@link MatchingNodeStatusPayload} snapshots with the
 *   real-time health of external matching nodes.
 * - `matching.node-progress`: Receives {@link MatchingNodeProgressPayload} for in-flight
 *   batch processing feedback per node.
 * - `matching.node-error`: Receives {@link MatchingNodeErrorPayload} when a node reports an
 *   unrecoverable error during processing.
 *
 * Example (frontend):
 * ```ts
 * const socket = io('/ws/matching');
 * socket.on('matching.progress', (payload) => updateProgress(payload));
 * socket.on('matching.completed', (payload) => showSummary(payload.summary));
 * socket.on('matching.validation-updated', refreshValidationTable);
 * socket.on('matching.node-status', (payload) => renderNodeHealth(payload.nodes));
 * socket.on('matching.node-progress', handleNodeProgress);
 * socket.on('matching.node-error', alertNodeFailure);
 * ```
 */
@WebSocketGateway({ namespace: '/ws/matching' })
export class MatchingGateway
  implements OnGatewayInit<Server>, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(MatchingGateway.name);

  @WebSocketServer()
  private server!: Server;

  afterInit(server: Server): void {
    this.logger.debug('MatchingGateway initialised');
    this.server = server;
  }

  handleConnection(client: Socket): void {
    this.logger.verbose(`Client connected to MatchingGateway: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.verbose(`Client disconnected from MatchingGateway: ${client.id}`);
  }

  emitMatchingProgress(payload: MatchingProgressPayload): void {
    this.server.emit('matching.progress', payload);
  }

  emitMatchingCompleted(payload: MatchingCompletedPayload): void {
    this.server.emit('matching.completed', payload);
  }

  emitValidationUpdated(payload: ValidationUpdatedPayload): void {
    this.server.emit('matching.validation-updated', payload);
  }

  emitNodeStatus(payload: MatchingNodeStatusPayload): void {
    this.server.emit('matching.node-status', payload);
  }

  emitNodeProgress(payload: MatchingNodeProgressPayload): void {
    this.server.emit('matching.node-progress', payload);
  }

  emitNodeError(payload: MatchingNodeErrorPayload): void {
    this.server.emit('matching.node-error', payload);
  }
}
