import { PartialType } from '@nestjs/swagger';

import { CreateMatchingNodeDto } from './create-matching-node.dto';

export class UpdateMatchingNodeDto extends PartialType(CreateMatchingNodeDto) {}
