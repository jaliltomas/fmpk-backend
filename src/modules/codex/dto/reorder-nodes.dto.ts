import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

export class ReorderNodesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  nodeIds!: string[];
}
