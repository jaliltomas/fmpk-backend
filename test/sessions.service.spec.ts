import type { Express } from 'express';
import { DataSource } from 'typeorm';

import { SessionsService } from '../src/modules/codex/sessions/services/sessions.service';
import { FilesService } from '../src/modules/files/files.service';
import { createInMemoryDataSource } from './utils/in-memory-datasource';
import { AvailableNode } from '../src/modules/codex/entities/available-node.enum';
import { Session } from '../src/modules/codex/entities/session.entity';
import { MatchRow } from '../src/modules/codex/entities/match-row.entity';
import { MatchCandidate } from '../src/modules/codex/entities/match-candidate.entity';

describe('SessionsService', () => {
  let dataSource: DataSource;
  let service: SessionsService;
  let filesService: FilesService;
  let storeFileMock: jest.Mock;

  beforeEach(() => {
    dataSource = createInMemoryDataSource();
    storeFileMock = jest.fn();
    filesService = { storeSessionRequestedProducts: storeFileMock } as unknown as FilesService;
    service = new SessionsService(dataSource, filesService);
  });

  it('creates a session with default metrics and related nodes/sites', async () => {
    const session = await service.createSession({
      name: 'Test Session',
      nodes: [
        { nodeType: AvailableNode.EAN },
        { nodeType: AvailableNode.NOMBRE },
      ],
      sites: [
        {
          name: 'Store A',
          baseUrl: 'https://store-a.example.com',
          productCount: 8,
        } as any,
      ],
    });

    expect(session.id).toBeDefined();
    expect(session.requestedProductsCount).toBe(0);
    expect(session.totalSiteProducts).toBe(8);
    expect(session.matchRate).toBeNull();
    expect(session.validationStats).toBeNull();
    expect(session.nodes).toHaveLength(2);
    expect(session.sites).toHaveLength(1);
  });

  it('uploads requested products, stores metadata and resets metrics', async () => {
    const session = await service.createSession({ name: 'Upload Session' });
    const filePayload = JSON.stringify([
      { name: 'Alpha' },
      { name: 'Beta' },
      'Gamma',
    ]);
    const file = {
      buffer: Buffer.from(filePayload, 'utf-8'),
      originalname: 'requested-products.json',
      mimetype: 'application/json',
      size: filePayload.length,
    } as Express.Multer.File;

    await service.uploadRequestedProducts(session.id, { file } as any);

    expect(storeFileMock).toHaveBeenCalledWith(session.id, file);

    const repository = dataSource.getRepository(Session) as any;
    const stored = await repository.findOne({ where: { id: session.id }, relations: { nodes: true, sites: true } });

    expect(stored?.requestedProductsCount).toBe(3);
    expect(stored?.matchRate).toBeNull();
    expect(stored?.validationStats).toBeNull();
    expect(stored?.requestedProductsFileMetadata?.products).toEqual([
      'Alpha',
      'Beta',
      'Gamma',
    ]);
  });

  it('recalculates validation statistics based on candidate validations', async () => {
    const session = await service.createSession({ name: 'Stats Session' });
    const sessionRepository = dataSource.getRepository(Session) as any;

    const matchRowRepository = dataSource.getRepository(MatchRow) as any;
    const candidateRepository = dataSource.getRepository(MatchCandidate) as any;

    const row = matchRowRepository.create({
      sessionId: session.id,
      productName: 'Product X',
      orderIndex: 0,
      candidates: [
        candidateRepository.create({
          siteId: 'site-1',
          siteName: 'Site 1',
          value: 'Match A',
          status: true,
        }),
        candidateRepository.create({
          siteId: 'site-2',
          siteName: 'Site 2',
          value: 'Match B',
          status: false,
        }),
        candidateRepository.create({
          siteId: 'site-3',
          siteName: 'Site 3',
          value: 'Match C',
          status: null,
        }),
      ],
    });

    await matchRowRepository.save(row);

    const storedSession = await sessionRepository.findOneOrFail({ where: { id: session.id } });
    storedSession.requestedProductsCount = 3;
    await sessionRepository.save(storedSession);

    await service.recalculateValidationStats(session.id);

    const updated = await sessionRepository.findOneOrFail({ where: { id: session.id } });

    expect(updated.validationStats).toBeTruthy();
    expect(updated.validationStats.validated).toBe(2);
    expect(updated.validationStats.correct).toBe(1);
    expect(updated.validationStats.effectiveness).toBeCloseTo(0.5);
    expect(updated.matchRate).toBeCloseTo(1 / 3);
  });
});
