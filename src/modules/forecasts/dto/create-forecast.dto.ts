import { Type } from 'class-transformer';
import {
  IsArray,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

class ForecastScenarioDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsNumber()
  probability?: number;

  @IsOptional()
  @IsString()
  outcome?: string;

  @IsOptional()
  @IsString()
  impact?: string;

  @IsOptional()
  @IsString()
  assumptions?: string;
}

export class CreateForecastDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ForecastScenarioDto)
  scenarios!: ForecastScenarioDto[];

  @IsOptional()
  @IsNumber()
  confidence?: number;

  @IsString()
  modelSource!: string;

  @IsArray()
  @IsString({ each: true })
  inputHypothesisIds!: string[];

  @IsOptional()
  @IsString()
  agentRunId?: string | null;
}
