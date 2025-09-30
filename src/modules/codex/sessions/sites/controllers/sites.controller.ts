import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { CreateSessionSiteDto } from '../../../dto/create-session-site.dto';
import { PaginationDto } from '../../../dto/pagination.dto';
import { UpdateSessionSiteDto } from '../../../dto/update-session-site.dto';
import { SitesService } from '../services/sites.service';

@ApiTags('session-sites')
@Controller({ path: 'sessions/:sessionId/sites', version: '1' })
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class SitesController {
  constructor(private readonly sitesService: SitesService) {}

  @Post()
  createSite(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Body() createSessionSiteDto: CreateSessionSiteDto,
  ) {
    return this.sitesService.createSite(sessionId, createSessionSiteDto);
  }

  @Get()
  getSites(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Query() paginationDto: PaginationDto,
  ) {
    return this.sitesService.getSites(sessionId, paginationDto);
  }

  @Patch(':siteId')
  updateSite(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @Param('siteId', new ParseUUIDPipe({ version: '4' })) siteId: string,
    @Body() updateSessionSiteDto: UpdateSessionSiteDto,
  ) {
    return this.sitesService.updateSite(sessionId, siteId, updateSessionSiteDto);
  }
}
