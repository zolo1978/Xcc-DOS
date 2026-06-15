import { TaskDetailPage } from '@/features/tasks/task-detail-page';

export default function TaskDetailRoute({
  params,
}: {
  params: {
    id: string;
  };
}) {
  return <TaskDetailPage taskId={params.id} />;
}
