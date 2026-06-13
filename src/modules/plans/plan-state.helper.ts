import { ConflictException } from '@nestjs/common';
import { errorBody } from '../../common/http/api-error';

export type PlanStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed';

export function assertPlanState(
  currentState: string,
  allowedStates: PlanStatus[],
  action: string,
): void {
  if (allowedStates.includes(currentState as PlanStatus)) {
    return;
  }

  throw new ConflictException(
    errorBody(
      'INVALID_PLAN_STATE',
      `Cannot ${action} plan in state ${currentState}`,
    ),
  );
}
