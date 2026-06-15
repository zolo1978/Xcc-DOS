import { DecisionCaseDetailPage } from '@/features/decision-cases/decision-case-detail-page';

export default function DecisionCaseDetailRoute({
  params,
}: {
  params: {
    id: string;
  };
}) {
  return <DecisionCaseDetailPage decisionCaseId={params.id} />;
}
