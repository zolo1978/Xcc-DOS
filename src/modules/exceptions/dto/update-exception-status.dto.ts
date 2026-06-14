import { IsString } from 'class-validator';

export class UpdateExceptionStatusDto {
  @IsString()
  status!: string;
}
