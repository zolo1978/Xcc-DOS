import { IsDateString, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class CreateTaskDto {
  @IsUUID()
  planId!: string;

  @IsOptional()
  @IsUUID()
  goalId?: string;

  @IsUUID()
  ownerId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsDateString()
  dueTime!: string;

  @IsOptional()
  @IsUUID()
  standardId?: string;
}
