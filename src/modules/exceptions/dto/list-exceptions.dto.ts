import { IsOptional, IsString } from 'class-validator';

export class ListExceptionsDto {
  @IsOptional()
  @IsString()
  severity?: string;

  @IsOptional()
  @IsString()
  status?: string;
}
