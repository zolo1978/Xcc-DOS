import { IsArray, IsOptional, IsString } from 'class-validator';

export class RunForecastDto {
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  hypothesisIds?: string[];
}
