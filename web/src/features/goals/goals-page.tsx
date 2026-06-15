'use client';

import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  Message,
  Modal,
  Select,
  Space,
  Table,
  Typography,
} from '@arco-design/web-react';
import { useEffect, useMemo, useState } from 'react';
import { createGoal, listGoals, updateGoalStatus } from '@/lib/api';
import { getCurrentUserId } from '@/lib/session';
import type { CreateGoalInput, Goal } from '@/types/api';

type CreateGoalFormValues = {
  title: string;
  metric: string;
  targetValue: string;
  currentValue: string;
  startDate: string;
  deadline: string;
};

const GOAL_STATUS_OPTIONS: Goal['status'][] = [
  'draft',
  'active',
  'completed',
  'cancelled',
];

function toOptionalNumber(value: string) {
  if (!value) {
    return undefined;
  }

  return Number(value);
}

export function GoalsPage() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createVisible, setCreateVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [form] = Form.useForm<CreateGoalFormValues>();
  const currentUserId = getCurrentUserId();

  const columns = useMemo(
    () => [
      {
        title: '目标',
        dataIndex: 'title',
      },
      {
        title: '指标',
        dataIndex: 'metric',
        render: (value: string | null) => value ?? '未设置',
      },
      {
        title: '进度',
        render: (_: unknown, record: Goal) =>
          `${record.currentValue ?? '-'} / ${record.targetValue ?? '-'}`,
      },
      {
        title: '状态',
        render: (_: unknown, record: Goal) => (
          <Select
            size="small"
            value={record.status}
            loading={updatingId === record.id}
            onChange={(value) => {
              void handleStatusChange(record, value as Goal['status']);
            }}
            options={GOAL_STATUS_OPTIONS.map((status) => ({
              label: status,
              value: status,
            }))}
          />
        ),
      },
      {
        title: '版本',
        dataIndex: 'version',
      },
      {
        title: '周期',
        render: (_: unknown, record: Goal) => `${record.startDate} - ${record.deadline}`,
      },
    ],
    [updatingId],
  );

  useEffect(() => {
    void loadGoals();
  }, []);

  async function loadGoals() {
    try {
      setLoading(true);
      setError(null);
      setGoals(await listGoals());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载目标失败');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate(values: CreateGoalFormValues) {
    if (!currentUserId) {
      setError('当前 access token 缺少 user id，无法创建目标。');
      return;
    }

    const payload: CreateGoalInput = {
      ownerId: currentUserId,
      title: values.title,
      metric: values.metric || undefined,
      targetValue: toOptionalNumber(values.targetValue),
      currentValue: toOptionalNumber(values.currentValue),
      startDate: values.startDate,
      deadline: values.deadline,
    };

    try {
      setSubmitting(true);
      const createdGoal = await createGoal(payload);
      setGoals((current) => [createdGoal, ...current]);
      setCreateVisible(false);
      form.resetFields();
      Message.success('目标已创建');
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : '创建目标失败');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStatusChange(goal: Goal, status: Goal['status']) {
    try {
      setUpdatingId(goal.id);
      const updatedGoal = await updateGoalStatus(goal.id, status, goal.version);
      setGoals((current) =>
        current.map((item) => (item.id === updatedGoal.id ? updatedGoal : item)),
      );
      Message.success('状态已更新');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : '更新状态失败');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="page-shell">
      <div className="page-shell__header">
        <div>
          <Typography.Text className="page-shell__eyebrow">目标管理</Typography.Text>
          <Typography.Title heading={2}>Goals</Typography.Title>
        </div>
        <Space>
          <Button onClick={() => void loadGoals()}>刷新</Button>
          <Button type="primary" onClick={() => setCreateVisible(true)}>
            新建 Goal
          </Button>
        </Space>
      </div>
      {error ? <Alert type="error" content={error} style={{ marginBottom: 16 }} /> : null}
      <Card bordered={false}>
        <Table
          rowKey="id"
          loading={loading}
          pagination={false}
          columns={columns}
          data={goals}
        />
      </Card>
      <Modal
        title="创建目标"
        visible={createVisible}
        onCancel={() => setCreateVisible(false)}
        onOk={() => form.submit()}
        confirmLoading={submitting}
        unmountOnExit
      >
        <Form<CreateGoalFormValues>
          form={form}
          layout="vertical"
          onSubmit={(values) => {
            void handleCreate(values);
          }}
        >
          <Form.Item
            label="标题"
            field="title"
            rules={[{ required: true, message: '请输入目标标题' }]}
          >
            <Input placeholder="例如：年度 ARR 增长" />
          </Form.Item>
          <Form.Item label="指标" field="metric">
            <Input placeholder="例如：ARR" />
          </Form.Item>
          <Form.Item label="目标值" field="targetValue">
            <Input type="number" placeholder="100" />
          </Form.Item>
          <Form.Item label="当前值" field="currentValue">
            <Input type="number" placeholder="36" />
          </Form.Item>
          <Form.Item
            label="开始日期"
            field="startDate"
            rules={[{ required: true, message: '请选择开始日期' }]}
          >
            <Input type="date" />
          </Form.Item>
          <Form.Item
            label="截止日期"
            field="deadline"
            rules={[{ required: true, message: '请选择截止日期' }]}
          >
            <Input type="date" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
