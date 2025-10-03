import { INestApplication, ValidationPipe, VersioningType } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { SessionsController } from '../src/modules/codex/sessions/controllers/sessions.controller';
import { SitesController } from '../src/modules/codex/sessions/sites/controllers/sites.controller';
import { MatchingController } from '../src/modules/codex/matching/controllers/matching.controller';
import { SessionsService } from '../src/modules/codex/sessions/services/sessions.service';
import { MatchingService } from '../src/modules/codex/matching/services/matching.service';
import { SitesService } from '../src/modules/codex/sessions/sites/services/sites.service';
import { FilesService } from '../src/modules/files/files.service';
import { createInMemoryDataSource } from './utils/in-memory-datasource';
import { SessionSite } from '../src/modules/codex/entities/session-site.entity';
import { Session } from '../src/modules/codex/entities/session.entity';
import { MatchCandidate } from '../src/modules/codex/entities/match-candidate.entity';
import { CreateSessionSiteDto } from '../src/modules/codex/dto/create-session-site.dto';
import { UpdateSessionSiteDto } from '../src/modules/codex/dto/update-session-site.dto';
import { PaginationDto } from '../src/modules/codex/dto/pagination.dto';

class TestSitesService extends SitesService {
  constructor(private readonly dataSource: DataSource) {
    super();
  }

  async createSite(sessionId: string, createSessionSiteDto: CreateSessionSiteDto): Promise<void> {
    const repository = this.dataSource.getRepository(SessionSite) as any;
    const site = repository.create({
      sessionId,
      name: createSessionSiteDto.name,
      baseUrl: createSessionSiteDto.baseUrl,
      productCount: 5,
      fileName:
        createSessionSiteDto.file?.originalname ?? `${createSessionSiteDto.name}.json`,
      storageKey: `sessions/${sessionId}/sites/${Date.now()}`,
    });

    await repository.save(site);
  }

  async updateSite(
    _sessionId: string,
    _siteId: string,
    _updateSessionSiteDto: UpdateSessionSiteDto,
  ): Promise<void> {
    return;
  }

  async getSites(_sessionId: string, _paginationDto: PaginationDto): Promise<void> {
    return;
  }
}

describe('Codex matching flows (e2e)', () => {
  let app: INestApplication;
  let dataSource: DataSource;

  beforeEach(async () => {
    dataSource = createInMemoryDataSource();

    const moduleRef = await Test.createTestingModule({
      controllers: [SessionsController, SitesController, MatchingController],
      providers: [
        SessionsService,
        MatchingService,
        FilesService,
        { provide: DataSource, useValue: dataSource },
        {
          provide: SitesService,
          useFactory: (ds: DataSource) => new TestSitesService(ds),
          inject: [DataSource],
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    );
    app.setGlobalPrefix('api');
    app.enableVersioning({ type: VersioningType.URI });

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('creates sessions, uploads products, generates matches and updates validations', async () => {
    const createSessionResponse = await request(app.getHttpServer())
      .post('/api/v1/sessions')
      .send({
        name: 'E2E Session',
      })
      .expect(201);

    const sessionId = createSessionResponse.body.id as string;

    const productsPayload = Buffer.from(
      JSON.stringify([
        { name: 'Keyboard' },
        { name: 'Mouse' },
      ]),
    );

    await request(app.getHttpServer())
      .post(`/api/v1/sessions/${sessionId}/requested-products`)
      .attach('file', productsPayload, 'requested-products.json')
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/sessions/${sessionId}/sites`)
      .send({
        name: 'Storefront',
        baseUrl: 'https://storefront.example.com',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/sessions/${sessionId}/matching/reset`)
      .send({})
      .expect(201);

    const sessionAfterReset = await request(app.getHttpServer())
      .get(`/api/v1/sessions/${sessionId}`)
      .expect(200);

    const matchRows = sessionAfterReset.body.matchRows as Array<{ candidates: Array<{ id: string }> }>;
    expect(matchRows).toHaveLength(2);
    const candidateId = matchRows[0].candidates[0].id;

    await request(app.getHttpServer())
      .patch(`/api/v1/sessions/${sessionId}/matching/candidates/${candidateId}/status`)
      .send({ status: true })
      .expect(200);

    const sessionRepository = dataSource.getRepository(Session) as any;
    const candidateRepository = dataSource.getRepository(MatchCandidate) as any;

    const finalSession = await sessionRepository.findOneOrFail({ where: { id: sessionId } });
    const updatedCandidate = await candidateRepository.findOneOrFail({ where: { id: candidateId } });

    expect(finalSession.validationStats?.validated).toBe(1);
    expect(finalSession.validationStats?.correct).toBe(1);
    expect(finalSession.validationStats?.effectiveness).toBe(1);
    expect(finalSession.matchRate).toBe(0.5);
    expect(updatedCandidate.status).toBe(true);
  });
});
