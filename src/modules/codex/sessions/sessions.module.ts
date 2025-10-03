import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { FilesModule } from '../../files/files.module';
import { MatchingModule } from '../matching/matching.module';
import { NodesModule } from './nodes/nodes.module';
import { SitesModule } from './sites/sites.module';

import { SessionsController } from './controllers/sessions.controller';
import { SessionsService } from './services/sessions.service';

import { Session } from '../entities/session.entity';
import { SessionNode } from '../entities/session-node.entity';
import { SessionSite } from '../entities/session-site.entity';
import { MatchRow } from '../entities/match-row.entity';
import { MatchCandidate } from '../entities/match-candidate.entity';

@Module({
    imports: [
        TypeOrmModule.forFeature([Session, SessionNode, SessionSite, MatchRow, MatchCandidate],), // 👈 Aquí registras tus entidades
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
