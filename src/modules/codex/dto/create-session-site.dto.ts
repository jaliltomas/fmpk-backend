import type { Express } from 'express';
import type { Multer } from 'multer';

import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class CreateSessionSiteDto {
    @IsString()
    @IsNotEmpty()
    name!: string;

    @IsUrl()
    baseUrl!: string;

    @IsOptional()
    file?: Express.Multer.File;
}
