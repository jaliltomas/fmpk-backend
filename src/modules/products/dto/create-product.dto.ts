import { Type } from 'class-transformer';
import {
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

export class CreateProductDto {
  @IsString()
  @IsNotEmpty()
  nombre!: string;

  @IsString()
  @IsNotEmpty()
  marca!: string;

  @IsString()
  @IsNotEmpty()
  img!: string;

  @Type(() => Number)
  @IsNumber()
  precioFinal!: number;

  @Type(() => Number)
  @IsNumber()
  precioLista!: number;

  @Type(() => Number)
  @IsNumber()
  precioKiloLitro!: number;

  @IsString()
  @IsNotEmpty()
  categoria!: string;

  @IsOptional()
  @IsString()
  subcategoria?: string;

  @IsString()
  @IsNotEmpty()
  ean!: string;

  @IsISO8601()
  scrapedate!: string;

  @IsUrl()
  url_producto!: string;

  @IsString()
  @IsNotEmpty()
  sitio!: string;
}
