import { IsIn } from 'class-validator';

export class UpdateGoalStatusDto {
  @IsIn(['draft', 'active', 'completed', 'cancelled'])
  status!: 'draft' | 'active' | 'completed' | 'cancelled';
}
