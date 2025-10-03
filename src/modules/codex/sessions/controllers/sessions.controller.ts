import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  ValidationPipe,
  ParseFilePipeBuilder,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Express } from 'express';
import { ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { plainToInstance } from 'class-transformer';

import { UploadRequestedProductsDto } from '../../dto/upload-requested-products.dto';
import { CreateSessionDto } from '../../dto/create-session.dto';
import { PaginationDto } from '../../dto/pagination.dto';
import { SessionsService } from '../services/sessions.service';
import { CreateSiteDto } from "../../dto/create-site-dto";

@ApiTags('sessions')
@Controller({ path: 'sessions', version: '1' })
@UsePipes(
  new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: true,
  }),
)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Post()
  createSession(@Body() createSessionDto: CreateSessionDto) {
    return this.sessionsService.createSession(createSessionDto);
  }

  @Get()
  getSessions(@Query() paginationDto: PaginationDto) {
    return this.sessionsService.getSessions(paginationDto);
  }

  @Get(':sessionId')
  getSession(@Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string) {
    return this.sessionsService.getSessionById(sessionId);
  }

  @Post(':sessionId/requested-products')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: UploadRequestedProductsDto })
  uploadRequestedProducts(
    @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
    @UploadedFile(
      new ParseFilePipeBuilder()
        .addMaxSizeValidator({ maxSize: 10 * 1024 * 1024 })
        .build({ fileIsRequired: true }),
    )
    file: Express.Multer.File,
  ) {
    const uploadRequestedProductsDto = plainToInstance(UploadRequestedProductsDto, { file });

    return this.sessionsService.uploadRequestedProducts(
      sessionId,
      uploadRequestedProductsDto,
    );
  }
    @Post(':sessionId/sites')
    @UseInterceptors(FileInterceptor('file'))
    @ApiConsumes('multipart/form-data')
    @ApiBody({ type: CreateSiteDto })
    async createSite(
        @Param('sessionId', new ParseUUIDPipe({ version: '4' })) sessionId: string,
        @Body() body: CreateSiteDto,
        @UploadedFile() file: Express.Multer.File,
    ) {
        return this.sessionsService.addSiteToSession(sessionId, {
            ...body,
            file,
        });
    }
}
