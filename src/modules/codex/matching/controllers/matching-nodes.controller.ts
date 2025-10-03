import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UsePipes,
  ValidationPipe,
    Delete,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { CreateMatchingNodeDto } from '../dto/create-matching-node.dto';
import { UpdateMatchingNodeDto } from '../dto/update-matching-node.dto';
import { MatchingNodeRegistryService } from '../services/matching-node-registry.service';

@ApiTags('matching-nodes')
@Controller({ path: 'matching/nodes', version: '1' })
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class MatchingNodesController {
  constructor(
    private readonly matchingNodeRegistryService: MatchingNodeRegistryService,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Register a new external matching node' })
  createNode(@Body() createMatchingNodeDto: CreateMatchingNodeDto) {
    return this.matchingNodeRegistryService.createNode(createMatchingNodeDto);
  }

  @Get()
  @ApiOperation({ summary: 'List registered matching nodes with their health status' })
  listNodes() {
    return this.matchingNodeRegistryService.listNodes();
  }
    @Delete(':nodeId')
    @ApiOperation({ summary: 'Delete a registered matching node' })
    deleteNode(@Param('nodeId', new ParseUUIDPipe({ version: '4' })) nodeId: string) {
        return this.matchingNodeRegistryService.deleteNode(nodeId);
    }
  @Patch(':nodeId')
  @ApiOperation({ summary: 'Update node metadata or capabilities' })
  updateNode(
    @Param('nodeId', new ParseUUIDPipe({ version: '4' })) nodeId: string,
    @Body() updateMatchingNodeDto: UpdateMatchingNodeDto,
  ) {
    return this.matchingNodeRegistryService.updateNode(
      nodeId,
      updateMatchingNodeDto,
    );
  }

  @Post(':nodeId/ping')
  @ApiOperation({ summary: 'Trigger an immediate health-check for a node' })
  pingNode(@Param('nodeId', new ParseUUIDPipe({ version: '4' })) nodeId: string) {
    return this.matchingNodeRegistryService.pingNode(nodeId);
  }
}
