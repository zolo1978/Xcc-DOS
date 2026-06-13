export type PlanResponseDto = {
  id: string;
  caseId: string;
  title: string;
  description: string | null;
  status: string;
  submittedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectedReason: string | null;
  version: number;
};
