import { Injectable } from '@nestjs/common';

import { AddSessionNodeDto } from '../../../dto/add-session-node.dto';
import { PaginationDto } from '../../../dto/pagination.dto';
import { ReorderNodesDto } from '../../../dto/reorder-nodes.dto';

@Injectable()
export class NodesService {
  async addNode(
    sessionId: string,
    addSessionNodeDto: AddSessionNodeDto,
  ): Promise<void> {
    return;
  }

  async reorderNodes(
    sessionId: string,
    reorderNodesDto: ReorderNodesDto,
  ): Promise<void> {
    return;
  }

  async getNodes(sessionId: string, paginationDto: PaginationDto): Promise<void> {
    return;
  }
}
