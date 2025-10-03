import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { MatchingController } from './controllers/matching.controller';
import { MatchingNodesController } from './controllers/matching-nodes.controller';
import { MatchingService } from './services/matching.service';
import { MatchingNodeRegistryService } from './services/matching-node-registry.service';
import { MatchingGateway } from './gateways/matching.gateway';
import { MatchingNode } from '../entities/matching-node.entity';
import { SessionsModule } from '../sessions/sessions.module';
import { FilesModule } from '../../files/files.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([MatchingNode]),
    forwardRef(() => SessionsModule),
    FilesModule,
  ],
  controllers: [MatchingController, MatchingNodesController],
  providers: [MatchingService, MatchingNodeRegistryService, MatchingGateway],
  exports: [MatchingService, MatchingNodeRegistryService, MatchingGateway],
})
export class MatchingModule {}
