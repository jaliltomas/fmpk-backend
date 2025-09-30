import { Inject, Injectable, NotFoundException, forwardRef } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';

import { ResetMatchesDto } from '../../dto/reset-matches.dto';
import { UpdateMatchStatusDto } from '../../dto/update-match-status.dto';
import { MatchCandidate } from '../../entities/match-candidate.entity';
import { MatchRow } from '../../entities/match-row.entity';
import { Session } from '../../entities/session.entity';
import { SessionSite } from '../../entities/session-site.entity';
import { SessionsService } from '../../sessions/services/sessions.service';

@Injectable()
export class MatchingService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(forwardRef(() => SessionsService))
    private readonly sessionsService: SessionsService,
  ) {}

  async updateMatchStatus(
    sessionId: string,
    candidateId: string,
    updateMatchStatusDto: UpdateMatchStatusDto,
  ): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const candidateRepository = manager.getRepository(MatchCandidate);

      const candidate = await candidateRepository.findOne({
        where: { id: candidateId },
        relations: { matchRow: true },
      });

      if (!candidate || candidate.matchRow.sessionId !== sessionId) {
        throw new NotFoundException('Match candidate not found for the session');
      }

      candidate.status = updateMatchStatusDto.status;
      await candidateRepository.save(candidate);

      await this.sessionsService.recalculateValidationStats(sessionId, manager);
    });
  }

  async resetMatches(
    sessionId: string,
    resetMatchesDto: ResetMatchesDto,
  ): Promise<void> {
    void resetMatchesDto;

    await this.dataSource.transaction(async (manager) => {
      const sessionRepository = manager.getRepository(Session);
      const matchRowRepository = manager.getRepository(MatchRow);
      const siteRepository = manager.getRepository(SessionSite);

      const session = await sessionRepository.findOne({
        where: { id: sessionId },
        relations: { sites: true },
      });

      if (!session) {
        throw new NotFoundException(`Session ${sessionId} was not found`);
      }

      const productNames = this.resolveProductNames(session);

      await matchRowRepository.delete({ sessionId });

      const sites = session.sites?.length
        ? session.sites
        : await siteRepository.find({ where: { sessionId } });

      const rows = productNames.map((productName, index) => {
        const row = matchRowRepository.create({
          sessionId,
          productName,
          orderIndex: index,
        });

        row.candidates = sites.map((site) =>
          this.createSimulatedCandidate(manager, site, productName),
        );

        return row;
      });

      await matchRowRepository.save(rows);

      session.validationStats = null;
      session.matchRate = null;

      await sessionRepository.save(session);
    });
  }

  private resolveProductNames(session: Session): string[] {
    const metadata = session.requestedProductsFileMetadata as
      | { products?: unknown }
      | undefined;

    if (metadata?.products && Array.isArray(metadata.products)) {
      return (metadata.products as unknown[])
        .map((value, index) => {
          if (typeof value === 'string' && value.trim().length > 0) {
            return value.trim();
          }

          if (
            value &&
            typeof value === 'object' &&
            'name' in value &&
            typeof (value as Record<string, unknown>).name === 'string'
          ) {
            const name = (value as Record<string, unknown>).name as string;
            return name.trim().length > 0 ? name.trim() : `Producto ${index + 1}`;
          }

          return `Producto ${index + 1}`;
        })
        .filter((name) => name.length > 0);
    }

    const placeholderCount = Math.max(session.requestedProductsCount, 1);

    return Array.from({ length: placeholderCount }, (_, index) =>
      `Producto ${index + 1}`,
    );
  }

  private createSimulatedCandidate(
    manager: EntityManager,
    site: SessionSite,
    productName: string,
  ) {
    const candidateRepository = manager.getRepository(MatchCandidate);

    return candidateRepository.create({
      siteId: site.id,
      siteName: site.name,
      value: `Simulated match for ${productName} on ${site.name}`,
      status: null,
    });
  }
}
