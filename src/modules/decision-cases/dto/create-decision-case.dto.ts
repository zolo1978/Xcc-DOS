import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

export class CreateDecisionCaseDto {
  @IsUUID()
  problemId!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;
}
