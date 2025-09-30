import { Type } from 'class-transformer';
import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { AddSessionNodeDto } from './add-session-node.dto';
import { CreateSessionSiteDto } from './create-session-site.dto';

export class CreateSessionDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddSessionNodeDto)
  nodes?: AddSessionNodeDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateSessionSiteDto)
  sites?: CreateSessionSiteDto[];
}
