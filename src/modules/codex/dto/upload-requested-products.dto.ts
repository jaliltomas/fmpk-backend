import type { Express } from 'express';
import { IsDefined, IsNotEmptyObject } from 'class-validator';

export class UploadRequestedProductsDto {
  @IsDefined()
  @IsNotEmptyObject()
  file!: Express.Multer.File;
}
