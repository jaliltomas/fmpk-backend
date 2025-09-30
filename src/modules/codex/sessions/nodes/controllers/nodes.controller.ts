import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { AddSessionNodeDto } from '../../../dto/add-session-node.dto';
import { PaginationDto } from '../../../dto/pagination.dto';
import { ReorderNodesDto } from '../../../dto/reorder-nodes.dto';
import { NodesService } from '../services/nodes.service';

@ApiTags('session-nodes')
@Controller({ path: 'sessions/:sessionId/nodes', version: '1' })
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class NodesController {
  constructor(private readonly nodesService: NodesService) {}

  @Post()
  addNode(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Body() addSessionNodeDto: AddSessionNodeDto,
  ) {
    return this.nodesService.addNode(sessionId, addSessionNodeDto);
  }

  @Patch('reorder')
  reorderNodes(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Body() reorderNodesDto: ReorderNodesDto,
  ) {
    return this.nodesService.reorderNodes(sessionId, reorderNodesDto);
  }

  @Get()
  getNodes(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.nodesService.getNodes(sessionId, paginationDto);
  }
}
