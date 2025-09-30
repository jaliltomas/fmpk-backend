import { IsIn } from 'class-validator';

export class UpdateMatchStatusDto {
  @IsIn([true, false, null])
  status!: boolean | null;
}
