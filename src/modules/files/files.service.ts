import { Injectable } from '@nestjs/common';
import type { Express } from 'express';

@Injectable()
export class FilesService {
  async storeSessionRequestedProducts(
    sessionId: string,
    file: Express.Multer.File,
  ): Promise<void> {
    return;
  }
}
