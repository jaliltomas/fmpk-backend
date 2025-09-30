import { Module, forwardRef } from '@nestjs/common';

import { FilesModule } from '../../files/files.module';
import { MatchingModule } from '../matching/matching.module';
import { NodesModule } from './nodes/nodes.module';
import { SessionsController } from './controllers/sessions.controller';
import { SessionsService } from './services/sessions.service';
import { SitesModule } from './sites/sites.module';

@Module({
  imports: [
    FilesModule,
    SitesModule,
    NodesModule,
    forwardRef(() => MatchingModule),
  ],
  controllers: [SessionsController],
  providers: [SessionsService],
  exports: [SessionsService],
})
export class SessionsModule {}
