import { Type } from 'class-transformer';
import {
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateGoalDto {
  @IsUUID()
  ownerId!: string;

  @IsOptional()
  @IsUUID()
  parentId?: string;

  @IsString()
  @MaxLength(200)
  title!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  metric?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  targetValue?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  currentValue?: number;

  @IsDateString()
  startDate!: string;

  @IsDateString()
  deadline!: string;
}
