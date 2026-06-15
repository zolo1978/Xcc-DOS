export type ApiErrorBody = {
  code: string;
  message: string;
};

export type GoalStatus = 'draft' | 'active' | 'completed' | 'cancelled';

export type Goal = {
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
  status: GoalStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
};

export type CreateGoalInput = {
  ownerId: string;
  parentId?: string;
  title: string;
  metric?: string;
  targetValue?: number;
  currentValue?: number;
  startDate: string;
  deadline: string;
};

export type PlanStatus =
  | 'draft'
  | 'submitted'
  | 'approved'
  | 'rejected'
  | 'executing'
  | 'completed';

export type Plan = {
  id: string;
  caseId: string;
  title?: string;
  description?: string;
  status: PlanStatus;
  submittedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectedReason?: string | null;
  version?: number;
};

export type Feedback = {
  id: string;
  taskId: string;
  revision: number;
  supersededBy?: string | null;
  qualityScore?: number | null;
  submittedAt: string;
};

export type BossDashboard = {
  tenantId: string;
  metrics: {
    goals: number;
    openCases: number;
    approvedPlans: number;
    openExceptions: number;
  };
};

export type LoginInput = {
  email: string;
  password: string;
};

export type LoginResponse = {
  accessToken: string;
  refreshToken: string;
};

export type RefreshResponse = {
  accessToken: string;
  refreshToken?: string;
};
