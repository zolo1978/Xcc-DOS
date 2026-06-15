import { IsOptional, IsString, IsUUID } from 'class-validator';

export class ListGoalsDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  goalId?: string;
}
