import { Module } from '@nestjs/common';

import { SitesController } from './controllers/sites.controller';
import { SitesService } from './services/sites.service';

@Module({
  controllers: [SitesController],
  providers: [SitesService],
  exports: [SitesService],
})
export class SitesModule {}
