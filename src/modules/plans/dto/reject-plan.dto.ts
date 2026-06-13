import { IsNotEmpty, IsString } from 'class-validator';

export class RejectPlanDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}
