import { IsOptional, IsString } from 'class-validator';

export class CreateProblemDto {
  @IsOptional()
  @IsString()
  goalId?: string;

  @IsString()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
