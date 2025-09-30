import { IsEnum } from 'class-validator';
import { AvailableNode } from '../entities/available-node.enum';

export class AddSessionNodeDto {
  @IsEnum(AvailableNode)
  nodeType!: AvailableNode;
}
