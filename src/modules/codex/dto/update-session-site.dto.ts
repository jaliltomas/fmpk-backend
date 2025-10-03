import type { Express } from 'express';
import { IsNotEmptyObject, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateSessionSiteDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsUrl()
  baseUrl?: string;

  @IsOptional()
  @IsNotEmptyObject()
  file?: Express.Multer.File;
}
