'use client';

import {
  Alert,
  Button,
  Card,
  Input,
  Message,
  Space,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, getTaskFeedback, reviseFeedback, submitTaskFeedback } from '@/lib/api';
import type { Feedback } from '@/types/api';

type TaskDetailPageProps = {
  taskId: string;
};

type FeedbackDraft = {
  todayGoal: string;
  result: string;
  blocker: string;
  nextAction: string;
};

function normalizeFeedbacks(payload: Feedback[] | Feedback | null | undefined) {
  if (!payload) {
    return [];
  }

  return Array.isArray(payload) ? payload : [payload];
}

function findActiveFeedback(items: Feedback[]) {
  return [...items]
    .sort((left, right) => right.revision - left.revision)
    .find((item) => !item.supersededBy);
}

export function TaskDetailPage({ taskId }: TaskDetailPageProps) {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [mode, setMode] = useState<'submit' | 'revise'>('submit');
  const [submitting, setSubmitting] = useState(false);
  const [draft, setDraft] = useState<FeedbackDraft>({
    todayGoal: '',
    result: '',
    blocker: '',
    nextAction: '',
  });

  const columns = useMemo(
    () => [
      {
        title: 'Revision',
        render: (_: unknown, record: Feedback) => `r${record.revision}`,
      },
      {
        title: '提交时间',
        dataIndex: 'submittedAt',
      },
      {
        title: '质量分',
        render: (_: unknown, record: Feedback) => record.qualityScore ?? '待评估',
      },
      {
        title: '状态',
        render: (_: unknown, record: Feedback) =>
          record.supersededBy ? <Tag>已被修订</Tag> : <Tag color="green">当前生效</Tag>,
      },
    ],
    [],
  );

  useEffect(() => {
    void loadFeedbacks();
  }, [taskId]);

  async function loadFeedbacks() {
    try {
      setLoading(true);
      setError(null);
      const payload = await getTaskFeedback(taskId);
      setFeedbacks(
        normalizeFeedbacks(payload).sort((left, right) => left.revision - right.revision),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载反馈失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit() {
    if (
      !draft.todayGoal.trim() ||
      !draft.result.trim() ||
      !draft.blocker.trim() ||
      !draft.nextAction.trim()
    ) {
      setError('四个反馈字段都必须填写');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      setHint(null);

      const activeFeedback = findActiveFeedback(feedbacks);
      const nextFeedback =
        mode === 'revise' && activeFeedback
          ? await reviseFeedback(activeFeedback.id, draft)
          : await submitTaskFeedback(taskId, draft);

      setFeedbacks((current) => {
        if (mode === 'revise' && activeFeedback) {
          return current
            .map((item) =>
              item.id === activeFeedback.id
                ? {
                    ...item,
                    supersededBy: nextFeedback.id,
                  }
                : item,
            )
            .concat(nextFeedback)
            .sort((left, right) => left.revision - right.revision);
        }

        return [...current, nextFeedback].sort((left, right) => left.revision - right.revision);
      });
      setMode('submit');
      setDraft({
        todayGoal: '',
        result: '',
        blocker: '',
        nextAction: '',
      });
      Message.success(mode === 'revise' ? '反馈修订已提交' : '反馈已提交');
    } catch (submitError) {
      if (
        submitError instanceof ApiError &&
        submitError.status === 409 &&
        submitError.body?.code === 'DUPLICATE_FEEDBACK'
      ) {
        setHint('今日已反馈，去修订');
        return;
      }

      setError(submitError instanceof Error ? submitError.message : '提交反馈失败');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-shell">
      <div className="page-shell__header">
        <div>
          <Typography.Text className="page-shell__eyebrow">强制反馈</Typography.Text>
          <Typography.Title heading={2}>任务 {taskId}</Typography.Title>
        </div>
      </div>

      {error ? <Alert type="error" content={error} style={{ marginBottom: 16 }} /> : null}

      <Card
        title={mode === 'revise' ? '提交反馈修订' : '提交每日反馈'}
        bordered={false}
        extra={
          <Button type="primary" loading={submitting} onClick={() => void handleSubmit()}>
            {mode === 'revise' ? '提交修订' : '提交反馈'}
          </Button>
        }
      >
        <div className="decision-form-grid">
          <Input.TextArea
            aria-label="今日目标"
            placeholder="今日目标"
            autoSize={{ minRows: 3 }}
            value={draft.todayGoal}
            onChange={(value) => setDraft((current) => ({ ...current, todayGoal: value }))}
          />
          <Input.TextArea
            aria-label="今日结果"
            placeholder="今日结果"
            autoSize={{ minRows: 3 }}
            value={draft.result}
            onChange={(value) => setDraft((current) => ({ ...current, result: value }))}
          />
          <Input.TextArea
            aria-label="当前卡点"
            placeholder="当前卡点"
            autoSize={{ minRows: 3 }}
            value={draft.blocker}
            onChange={(value) => setDraft((current) => ({ ...current, blocker: value }))}
          />
          <Input.TextArea
            aria-label="下一步动作"
            placeholder="下一步动作"
            autoSize={{ minRows: 3 }}
            value={draft.nextAction}
            onChange={(value) => setDraft((current) => ({ ...current, nextAction: value }))}
          />
        </div>

        {hint ? (
          <div style={{ marginTop: 16 }}>
            <Alert
              type="info"
              content={
                <Space>
                  <Typography.Text>{hint}</Typography.Text>
                  <Button
                    size="small"
                    onClick={() => {
                      setMode('revise');
                      setHint(null);
                    }}
                  >
                    去修订
                  </Button>
                </Space>
              }
            />
          </div>
        ) : null}
      </Card>

      <Card title="反馈修订链" bordered={false} style={{ marginTop: 16 }}>
        <Table
          rowKey="id"
          loading={loading}
          pagination={false}
          columns={columns}
          data={feedbacks}
        />
      </Card>
    </div>
  );
}
