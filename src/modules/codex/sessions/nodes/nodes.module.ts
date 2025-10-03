import { Module } from '@nestjs/common';

import { NodesController } from './controllers/nodes.controller';
import { NodesService } from './services/nodes.service';

@Module({
  controllers: [NodesController],
  providers: [NodesService],
  exports: [NodesService],
})
export class NodesModule {}
