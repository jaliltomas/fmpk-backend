import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { AvailableNode } from '../../entities/available-node.enum';

export class CapabilityDto {
  @ApiProperty({ description: 'Capability identifier supported by the node' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  value!: string;
}

export class CreateMatchingNodeDto {
  @ApiProperty({ enum: AvailableNode, description: 'Type of matching node' })
  @IsEnum(AvailableNode)
  type!: AvailableNode;

  @ApiProperty({ description: 'Human readable name' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  displayName!: string;

  @ApiProperty({ description: 'Resolvable hostname or IP address' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  host!: string;

  @ApiProperty({ description: 'Port where the node listens for health checks', minimum: 1 })
  @IsInt()
  @Min(1)
  port!: number;

  @ApiProperty({
    description: 'Capabilities supported by the node',
    required: false,
    type: [CapabilityDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CapabilityDto)
  capabilities?: CapabilityDto[];
}
