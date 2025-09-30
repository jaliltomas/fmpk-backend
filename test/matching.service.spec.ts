import { DataSource } from 'typeorm';

import { MatchingService } from '../src/modules/codex/matching/services/matching.service';
import { SessionsService } from '../src/modules/codex/sessions/services/sessions.service';
import { FilesService } from '../src/modules/files/files.service';
import { createInMemoryDataSource } from './utils/in-memory-datasource';
import { Session } from '../src/modules/codex/entities/session.entity';
import { SessionSite } from '../src/modules/codex/entities/session-site.entity';
import { MatchCandidate } from '../src/modules/codex/entities/match-candidate.entity';

describe('MatchingService', () => {
  let dataSource: DataSource;
  let sessionsService: SessionsService;
  let matchingService: MatchingService;

  beforeEach(() => {
    dataSource = createInMemoryDataSource();
    sessionsService = new SessionsService(dataSource, new FilesService());
    matchingService = new MatchingService(dataSource, sessionsService);
  });

  it('generates match rows and simulated candidates when resetting matches', async () => {
    const session = await sessionsService.createSession({ name: 'Match Session' });
    const sessionRepository = dataSource.getRepository(Session) as any;
    const siteRepository = dataSource.getRepository(SessionSite) as any;

    const storedSession = await sessionRepository.findOneOrFail({ where: { id: session.id } });
    storedSession.requestedProductsCount = 2;
    storedSession.requestedProductsFileMetadata = {
      products: ['Laptop', 'Headphones'],
    } as any;
    await sessionRepository.save(storedSession);

    await siteRepository.save(
      siteRepository.create({
        sessionId: session.id,
        name: 'Storefront',
        baseUrl: 'https://storefront.example.com',
        productCount: 5,
        storageKey: 'sessions/test/site',
        fileName: 'catalog.json',
      }),
    );

    await matchingService.resetMatches(session.id, {} as any);

    const updated = await sessionRepository.findOneOrFail({
      where: { id: session.id },
      relations: { matchRows: { candidates: true }, sites: true },
    });

    expect(updated.matchRows).toHaveLength(2);
    expect(updated.matchRows[0].candidates).toHaveLength(1);
    expect(updated.matchRows[0].candidates[0].value).toContain('Laptop');
    expect(updated.validationStats).toBeNull();
    expect(updated.matchRate).toBeNull();
  });

  it('updates candidate status and recalculates session statistics', async () => {
    const session = await sessionsService.createSession({ name: 'Status Session' });
    const sessionRepository = dataSource.getRepository(Session) as any;
    const siteRepository = dataSource.getRepository(SessionSite) as any;
    const candidateRepository = dataSource.getRepository(MatchCandidate) as any;

    const storedSession = await sessionRepository.findOneOrFail({ where: { id: session.id } });
    storedSession.requestedProductsCount = 2;
    storedSession.requestedProductsFileMetadata = {
      products: ['Console', 'Controller'],
    } as any;
    await sessionRepository.save(storedSession);

    await siteRepository.save(
      siteRepository.create({
        sessionId: session.id,
        name: 'Gaming Store',
        baseUrl: 'https://games.example.com',
        productCount: 10,
        storageKey: 'sessions/test/site',
        fileName: 'gaming.json',
      }),
    );

    await matchingService.resetMatches(session.id, {} as any);

    const sessionWithMatches = await sessionRepository.findOneOrFail({
      where: { id: session.id },
      relations: { matchRows: { candidates: true } },
    });

    const candidateId = sessionWithMatches.matchRows[0].candidates[0].id;

    await matchingService.updateMatchStatus(session.id, candidateId, { status: true });

    const updatedCandidate = await candidateRepository.findOneOrFail({
      where: { id: candidateId },
      relations: { matchRow: true },
    });

    expect(updatedCandidate.status).toBe(true);

    const updatedSession = await sessionRepository.findOneOrFail({ where: { id: session.id } });

    expect(updatedSession.validationStats?.validated).toBe(1);
    expect(updatedSession.validationStats?.correct).toBe(1);
    expect(updatedSession.validationStats?.effectiveness).toBe(1);
    expect(updatedSession.matchRate).toBe(0.5);
  });
});
