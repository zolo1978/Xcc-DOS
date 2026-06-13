import { IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';

export class SubmitFeedbackDto {
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  todayGoal?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  result?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  blocker?: string;

  @IsOptional()
  @IsString()
  @MaxLength(5000)
  nextAction?: string;

  @IsOptional()
  @IsNumber()
  qualityScore?: number;

  @IsString()
  timezone!: string;
}
