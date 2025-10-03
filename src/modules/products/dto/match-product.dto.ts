import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsString, ValidateNested } from 'class-validator';

import { CreateProductDto } from './create-product.dto';

export class MatchProductDto {
  @ValidateNested()
  @Type(() => CreateProductDto)
  product!: CreateProductDto;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  nodeIds!: string[];
}
