import type { Express } from 'express';
import { IsNotEmpty, IsNotEmptyObject, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateSessionSiteDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsUrl()
  baseUrl!: string;

  @IsOptional()
  @IsNotEmptyObject()
  file?: Express.Multer.File;
}
