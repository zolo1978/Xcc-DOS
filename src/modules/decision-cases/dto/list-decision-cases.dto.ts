import { IsOptional, IsUUID } from 'class-validator';

export class ListDecisionCasesDto {
  @IsOptional()
  @IsUUID()
  problemId?: string;
}
