import { Type } from 'class-transformer';
import { IsInt, IsOptional } from 'class-validator';

export class ListForecastsDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  version?: number;
}
