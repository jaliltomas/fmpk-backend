import type { Express } from 'express';
import { IsNotEmpty, IsString, IsUrl, IsOptional } from 'class-validator';

export class CreateSiteDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @IsUrl()
    @IsNotEmpty()
    baseUrl: string;

    @IsOptional()
    file?: Express.Multer.File;
}
