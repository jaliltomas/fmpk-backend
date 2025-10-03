import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';

import { MatchingService } from './matching.service';
import { MatchingNodeRepository } from './nodes.repository';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

@Module({
  imports: [HttpModule],
  controllers: [ProductsController],
  providers: [ProductsService, MatchingService, MatchingNodeRepository],
  exports: [ProductsService],
})
export class ProductsModule {}
