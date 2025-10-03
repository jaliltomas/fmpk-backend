import { randomUUID } from 'crypto';
import {
  DataSource,
  EntityManager,
  EntityTarget,
  FindManyOptions,
  FindOneOptions,
} from 'typeorm';

import { Session } from '../../src/modules/codex/entities/session.entity';
import { SessionNode } from '../../src/modules/codex/entities/session-node.entity';
import { SessionSite } from '../../src/modules/codex/entities/session-site.entity';
import { MatchRow } from '../../src/modules/codex/entities/match-row.entity';
import { MatchCandidate } from '../../src/modules/codex/entities/match-candidate.entity';

interface SessionRecord extends Session {
  nodes: SessionNodeRecord[];
  sites: SessionSiteRecord[];
  matchRows: MatchRowRecord[];
}

interface SessionNodeRecord extends SessionNode {}

interface SessionSiteRecord extends SessionSite {}

interface MatchRowRecord extends MatchRow {
  candidates: MatchCandidateRecord[];
}

interface MatchCandidateRecord extends MatchCandidate {
  matchRowId: string;
}

class InMemoryDatabase {
  readonly sessions = new Map<string, SessionRecord>();
  readonly sessionNodes = new Map<string, SessionNodeRecord>();
  readonly sessionSites = new Map<string, SessionSiteRecord>();
  readonly matchRows = new Map<string, MatchRowRecord>();
  readonly matchCandidates = new Map<string, MatchCandidateRecord>();
}

const now = () => new Date();

function cloneSession(record: SessionRecord): SessionRecord {
  const session = Object.assign(new Session(), record);
  session.nodes = record.nodes.map((node) => Object.assign(new SessionNode(), node));
  session.sites = record.sites.map((site) => Object.assign(new SessionSite(), site));
  session.matchRows = record.matchRows.map((row) => cloneMatchRow(row));
  return session as SessionRecord;
}

function cloneMatchRow(record: MatchRowRecord): MatchRowRecord {
  const row = Object.assign(new MatchRow(), record);
  row.candidates = record.candidates.map((candidate) => cloneCandidate(candidate, row));
  return row as MatchRowRecord;
}

function cloneCandidate(
  record: MatchCandidateRecord,
  parentRow?: MatchRow,
): MatchCandidateRecord {
  const candidate = Object.assign(new MatchCandidate(), record);
  if (parentRow) {
    candidate.matchRow = parentRow;
  } else if (record.matchRow) {
    candidate.matchRow = record.matchRow;
  }
  return candidate as MatchCandidateRecord;
}

class SessionRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  create(data: Partial<SessionRecord>): SessionRecord {
    const session = Object.assign(new Session(), {
      ...data,
      requestedProductsCount: data.requestedProductsCount ?? 0,
      totalSiteProducts: data.totalSiteProducts ?? 0,
      matchRate: data.matchRate ?? null,
      validationStats: data.validationStats ?? null,
      requestedProductsFileMetadata: data.requestedProductsFileMetadata ?? null,
      nodes: [],
      sites: [],
      matchRows: [],
      createdAt: data.createdAt ?? now(),
      updatedAt: data.updatedAt ?? now(),
    }) as SessionRecord;

    if (data.id) {
      session.id = data.id;
    }

    return session;
  }

  async save(entity: SessionRecord | SessionRecord[]): Promise<SessionRecord | SessionRecord[]> {
    if (Array.isArray(entity)) {
      const saved = await Promise.all(entity.map((item) => this.save(item) as Promise<SessionRecord>));
      return saved;
    }

    const session = entity;
    if (!session.id) {
      session.id = randomUUID();
      session.createdAt = now();
    }

    session.updatedAt = now();

    const existing = this.db.sessions.get(session.id);
    const record: SessionRecord = {
      ...session,
      nodes: existing?.nodes ?? session.nodes ?? [],
      sites: existing?.sites ?? session.sites ?? [],
      matchRows: existing?.matchRows ?? session.matchRows ?? [],
    } as SessionRecord;

    this.db.sessions.set(session.id, record);

    return cloneSession(record);
  }

  async findOne(options: FindOneOptions<SessionRecord>): Promise<SessionRecord | null> {
    const id = options.where && 'id' in options.where ? (options.where as { id: string }).id : undefined;
    if (!id) {
      return null;
    }

    const record = this.db.sessions.get(id);
    if (!record) {
      return null;
    }

    const cloned = cloneSession(record);

    if (!options.relations?.nodes) {
      cloned.nodes = [];
    }

    if (!options.relations?.sites) {
      cloned.sites = [];
    }

    const matchRowsRelation = options.relations?.matchRows;
    if (!matchRowsRelation) {
      cloned.matchRows = [];
    } else if (matchRowsRelation !== true && matchRowsRelation?.candidates !== true) {
      cloned.matchRows = cloned.matchRows.map((row) => ({ ...row, candidates: [] } as MatchRowRecord));
    }

    return cloned;
  }

  async findOneOrFail(options: FindOneOptions<SessionRecord>): Promise<SessionRecord> {
    const session = await this.findOne(options);
    if (!session) {
      throw new Error('Session not found');
    }

    return session;
  }

  async findAndCount(
    options: FindManyOptions<SessionRecord>,
  ): Promise<[SessionRecord[], number]> {
    const records = Array.from(this.db.sessions.values()).sort(
      (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
    );

    const total = records.length;
    const start = options.skip ?? 0;
    const end = options.take ? start + options.take : undefined;
    const slice = records.slice(start, end).map((record) => {
      const cloned = cloneSession(record);
      if (!options.relations?.nodes) {
        cloned.nodes = [];
      }
      if (!options.relations?.sites) {
        cloned.sites = [];
      }
      return cloned;
    });

    return [slice, total];
  }
}

class SessionNodeRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  create(data: Partial<SessionNodeRecord>): SessionNodeRecord {
    const node = Object.assign(new SessionNode(), {
      ...data,
      orderIndex: data.orderIndex ?? 0,
    });

    if (data.id) {
      node.id = data.id;
    }

    return node as SessionNodeRecord;
  }

  async save(entity: SessionNodeRecord | SessionNodeRecord[]): Promise<SessionNodeRecord | SessionNodeRecord[]> {
    if (Array.isArray(entity)) {
      const saved = await Promise.all(entity.map((item) => this.save(item) as Promise<SessionNodeRecord>));
      return saved;
    }

    const node = entity;
    if (!node.id) {
      node.id = randomUUID();
    }

    this.db.sessionNodes.set(node.id, node);

    const session = this.db.sessions.get(node.sessionId);
    if (session) {
      const nodes = session.nodes.filter((existing) => existing.id !== node.id);
      nodes.splice(node.orderIndex ?? nodes.length, 0, node);
      session.nodes = nodes;
      this.db.sessions.set(session.id, session);
    }

    return Object.assign(new SessionNode(), node);
  }
}

class SessionSiteRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  create(data: Partial<SessionSiteRecord>): SessionSiteRecord {
    const site = Object.assign(new SessionSite(), {
      ...data,
      productCount: data.productCount ?? 0,
    });

    if (data.id) {
      site.id = data.id;
    }

    return site as SessionSiteRecord;
  }

  async save(entity: SessionSiteRecord | SessionSiteRecord[]): Promise<SessionSiteRecord | SessionSiteRecord[]> {
    if (Array.isArray(entity)) {
      const saved = await Promise.all(entity.map((item) => this.save(item) as Promise<SessionSiteRecord>));
      return saved;
    }

    const site = entity;
    if (!site.id) {
      site.id = randomUUID();
    }

    this.db.sessionSites.set(site.id, site);

    const session = this.db.sessions.get(site.sessionId);
    if (session) {
      const sites = session.sites.filter((existing) => existing.id !== site.id);
      sites.push(site);
      session.sites = sites;
      this.db.sessions.set(session.id, session);
    }

    return Object.assign(new SessionSite(), site);
  }

  async find(options: { where: { sessionId: string } }): Promise<SessionSiteRecord[]> {
    const sessionId = options.where.sessionId;
    return Array.from(this.db.sessionSites.values())
      .filter((site) => site.sessionId === sessionId)
      .map((site) => Object.assign(new SessionSite(), site));
  }

  createQueryBuilder() {
    const repo = this;
    let sessionId: string | undefined;

    return {
      where(_: string, params: { sessionId: string }) {
        sessionId = params.sessionId;
        return this;
      },
      select() {
        return this;
      },
      async getRawOne<T>(): Promise<T> {
        const total = Array.from(repo.db.sessionSites.values())
          .filter((site) => !sessionId || site.sessionId === sessionId)
          .reduce((acc, site) => acc + (site.productCount ?? 0), 0);

        return { total: total.toString() } as unknown as T;
      },
    };
  }
}

class MatchCandidateRepository {
  constructor(private readonly db: InMemoryDatabase) {}

  create(data: Partial<MatchCandidateRecord>): MatchCandidateRecord {
    const candidate = Object.assign(new MatchCandidate(), {
      ...data,
      status: data.status ?? null,
    }) as MatchCandidateRecord;

    if (data.id) {
      candidate.id = data.id;
    }

    if (data.matchRowId) {
      candidate.matchRowId = data.matchRowId;
    }

    return candidate;
  }

  async save(
    entity: MatchCandidateRecord | MatchCandidateRecord[],
  ): Promise<MatchCandidateRecord | MatchCandidateRecord[]> {
    if (Array.isArray(entity)) {
      const saved = await Promise.all(
        entity.map((item) => this.save(item) as Promise<MatchCandidateRecord>),
      );
      return saved;
    }

    const candidate = entity;
    if (!candidate.id) {
      candidate.id = randomUUID();
    }

    if (!candidate.matchRowId && candidate.matchRow) {
      candidate.matchRowId = candidate.matchRow.id;
    }

    this.db.matchCandidates.set(candidate.id, candidate);

    if (candidate.matchRowId) {
      const matchRow = this.db.matchRows.get(candidate.matchRowId);
      if (matchRow) {
        const candidates = matchRow.candidates.filter((item) => item.id !== candidate.id);
        candidates.push(candidate);
        matchRow.candidates = candidates;
        this.db.matchRows.set(matchRow.id, matchRow);
      }
    }

    return cloneCandidate(candidate);
  }

  async findOne(options: FindOneOptions<MatchCandidateRecord>): Promise<MatchCandidateRecord | null> {
    const id = options.where && 'id' in options.where ? (options.where as { id: string }).id : undefined;
    if (!id) {
      return null;
    }

    const record = this.db.matchCandidates.get(id);
    if (!record) {
      return null;
    }

    const candidate = cloneCandidate(record);
    if (options.relations?.matchRow) {
      const matchRow = this.db.matchRows.get(record.matchRowId);
      if (matchRow) {
        candidate.matchRow = cloneMatchRow(matchRow);
      }
    }

    return candidate;
  }

  async findOneOrFail(
    options: FindOneOptions<MatchCandidateRecord>,
  ): Promise<MatchCandidateRecord> {
    const candidate = await this.findOne(options);
    if (!candidate) {
      throw new Error('Match candidate not found');
    }

    return candidate;
  }

  createQueryBuilder() {
    const repo = this;
    let sessionId: string | undefined;

    return {
      innerJoin() {
        return this;
      },
      where(_: string, params: { sessionId: string }) {
        sessionId = params.sessionId;
        return this;
      },
      select() {
        return this;
      },
      addSelect() {
        return this;
      },
      async getRawOne<T>(): Promise<T> {
        const candidates = Array.from(repo.db.matchCandidates.values()).filter((candidate) => {
          if (!sessionId) {
            return true;
          }

          const row = repo.db.matchRows.get(candidate.matchRowId);
          return row?.sessionId === sessionId;
        });

        const validated = candidates.filter((candidate) => candidate.status !== null).length;
        const correct = candidates.filter((candidate) => candidate.status === true).length;

        return {
          validated: validated.toString(),
          correct: correct.toString(),
        } as unknown as T;
      },
    };
  }
}

class MatchRowRepository {
  constructor(
    private readonly db: InMemoryDatabase,
    private readonly entityManager: InMemoryEntityManager,
  ) {}

  create(data: Partial<MatchRowRecord>): MatchRowRecord {
    const row = Object.assign(new MatchRow(), {
      ...data,
      orderIndex: data.orderIndex ?? 0,
      candidates: data.candidates ?? [],
    }) as MatchRowRecord;

    if (data.id) {
      row.id = data.id;
    }

    return row;
  }

  async save(entity: MatchRowRecord | MatchRowRecord[]): Promise<MatchRowRecord | MatchRowRecord[]> {
    if (Array.isArray(entity)) {
      const saved = await Promise.all(entity.map((item) => this.save(item) as Promise<MatchRowRecord>));
      return saved;
    }

    const row = entity;
    if (!row.id) {
      row.id = randomUUID();
    }

    const candidateRepository = this.entityManager.getRepository(
      MatchCandidate,
    ) as unknown as MatchCandidateRepository;

    if (row.candidates?.length) {
      const persistedCandidates: MatchCandidateRecord[] = [];
      for (const candidate of row.candidates) {
        candidate.matchRowId = row.id;
        candidate.matchRow = row;
        const savedCandidate = (await candidateRepository.save(candidate)) as MatchCandidateRecord;
        persistedCandidates.push(savedCandidate);
      }
      row.candidates = persistedCandidates;
    } else {
      row.candidates = row.candidates ?? [];
    }

    this.db.matchRows.set(row.id, row);

    const session = this.db.sessions.get(row.sessionId);
    if (session) {
      const rows = session.matchRows.filter((existing) => existing.id !== row.id);
      rows.splice(row.orderIndex ?? rows.length, 0, row);
      session.matchRows = rows;
      this.db.sessions.set(session.id, session);
    }

    return cloneMatchRow(row);
  }

  async delete(criteria: { sessionId: string }): Promise<void> {
    const rowsToDelete = Array.from(this.db.matchRows.values()).filter(
      (row) => row.sessionId === criteria.sessionId,
    );

    for (const row of rowsToDelete) {
      this.db.matchRows.delete(row.id);
      for (const candidate of row.candidates) {
        this.db.matchCandidates.delete(candidate.id);
      }
    }

    const session = this.db.sessions.get(criteria.sessionId);
    if (session) {
      session.matchRows = [];
      this.db.sessions.set(session.id, session);
    }
  }
}

class InMemoryEntityManager {
  constructor(private readonly db: InMemoryDatabase) {}

  getRepository<Entity>(target: EntityTarget<Entity>) {
    if (target === Session) {
      return new SessionRepository(this.db) as unknown as Entity;
    }

    if (target === SessionNode) {
      return new SessionNodeRepository(this.db) as unknown as Entity;
    }

    if (target === SessionSite) {
      return new SessionSiteRepository(this.db) as unknown as Entity;
    }

    if (target === MatchRow) {
      return new MatchRowRepository(this.db, this) as unknown as Entity;
    }

    if (target === MatchCandidate) {
      return new MatchCandidateRepository(this.db) as unknown as Entity;
    }

    throw new Error('Repository not implemented');
  }
}

export function createInMemoryDataSource(): DataSource {
  const db = new InMemoryDatabase();
  const defaultManager = new InMemoryEntityManager(db);

  const dataSource = {
    manager: defaultManager as unknown as EntityManager,
    async transaction<T>(runInTransaction: (manager: EntityManager) => Promise<T>): Promise<T> {
      const transactionManager = new InMemoryEntityManager(db);
      return runInTransaction(transactionManager as unknown as EntityManager);
    },
    getRepository<Entity>(target: EntityTarget<Entity>) {
      return (defaultManager.getRepository(target) as unknown) as Entity;
    },
  } as unknown as DataSource;

  return dataSource;
}
