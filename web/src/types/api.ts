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

export type DecisionCaseStage =
  | 'dismantle'
  | 'hypothesize'
  | 'evaluate'
  | 'calculate'
  | 'report';

export type Hypothesis = {
  id: string;
  content: string;
  evidenceScore: number;
  confidence: number;
  counterExample?: string | null;
  status?: string;
};

export type ForecastScenario = {
  name: string;
  probability: number;
  outcome: string;
  impact: string;
  assumptions: string;
};

export type Forecast = {
  id: string;
  caseId: string;
  version: number;
  scenarios: ForecastScenario[];
  confidence?: number;
  modelSource?: string;
  agentRunId?: string | null;
};

export type DecisionCaseEvaluation = {
  resourceScore: number;
  timeScore: number;
  riskScore: number;
  feasibilityScore: number;
  comment?: string;
};

export type RoiSimulation = {
  cost?: number;
  revenue?: number;
  roi: number | null;
  paybackDays: number | null;
  assumptions?: Record<string, unknown>;
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
  ownerId?: string;
  title?: string;
  description?: string;
  status: PlanStatus;
  submittedAt?: string | null;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectedReason?: string | null;
  version?: number;
  taskCount?: number;
};

export type DecisionCase = {
  id: string;
  problemId?: string;
  ownerId?: string;
  title: string;
  stage: DecisionCaseStage;
  status?: string;
  hypotheses: Hypothesis[];
  evaluation?: DecisionCaseEvaluation | null;
  roiSimulation?: RoiSimulation | null;
  forecasts?: Forecast[];
  plans?: Plan[];
  report?: {
    id?: string;
    summary?: string;
    generatedAt?: string;
  } | null;
};

export type CreateHypothesisInput = {
  content: string;
  evidenceScore: number;
  confidence: number;
  counterExample: string;
};

export type CreateForecastInput = {
  selectedHypothesisIds: string[];
};

export type EvaluateDecisionCaseInput = DecisionCaseEvaluation;

export type SimulateRoiInput = {
  cost: number;
  revenue: number;
  assumptions?: Record<string, unknown>;
};

export type CreatePlanInput = {
  title: string;
  description?: string;
};

export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'delayed';

export type Task = {
  id: string;
  planId: string;
  goalId?: string | null;
  ownerId: string;
  title: string;
  description?: string;
  dueTime: string;
  status: TaskStatus;
  standardId?: string | null;
  version?: number;
};

export type CreateTaskInput = {
  planId: string;
  goalId?: string;
  ownerId: string;
  title: string;
  description?: string;
  dueTime: string;
  standardId?: string;
};

export type FeedbackInput = {
  todayGoal: string;
  result: string;
  blocker: string;
  nextAction: string;
};

export type Feedback = {
  id: string;
  taskId: string;
  revision: number;
  todayGoal?: string;
  result?: string;
  blocker?: string;
  nextAction?: string;
  supersededBy?: string | null;
  supersedes?: string | null;
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
