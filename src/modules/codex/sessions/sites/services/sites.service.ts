import { Injectable } from '@nestjs/common';

import { CreateSessionSiteDto } from '../../../dto/create-session-site.dto';
import { PaginationDto } from '../../../dto/pagination.dto';
import { UpdateSessionSiteDto } from '../../../dto/update-session-site.dto';

@Injectable()
export class SitesService {
  async createSite(
    sessionId: string,
    createSessionSiteDto: CreateSessionSiteDto,
  ): Promise<void> {
    return;
  }

  async updateSite(
    sessionId: string,
    siteId: string,
    updateSessionSiteDto: UpdateSessionSiteDto,
  ): Promise<void> {
    return;
  }

  async getSites(sessionId: string, paginationDto: PaginationDto): Promise<void> {
    return;
  }
}
