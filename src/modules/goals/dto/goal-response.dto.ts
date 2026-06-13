export type GoalResponseDto = {
  id: string;
  orgId: string;
  ownerId: string;
  parentId: string | null;
  title: string;
  metric: string | null;
  targetValue: string | null;
  currentValue: string | null;
  startDate: string;
  deadline: string;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};
