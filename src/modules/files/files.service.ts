import { Injectable } from '@nestjs/common';
import type { Express } from 'express';

export interface SessionSiteFileDescriptor {
  id: string;
  name: string;
  storageKey: string;
}

export interface SessionSiteProductRecord {
  id?: string;
  name?: string;
  quantity?: number | null;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
}

@Injectable()
export class FilesService {
  async storeSessionRequestedProducts(
    sessionId: string,
    file: Express.Multer.File,
  ): Promise<void> {
    void sessionId;
    void file;
    return;
  }

  async loadSessionSiteProducts(
    sessionId: string,
    descriptor: SessionSiteFileDescriptor,
  ): Promise<SessionSiteProductRecord[]> {
    void sessionId;
    void descriptor;
    return [];
  }
}
