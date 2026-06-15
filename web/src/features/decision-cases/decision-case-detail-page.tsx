'use client';

import Link from 'next/link';
import {
  Alert,
  Button,
  Card,
  Input,
  InputNumber,
  Message,
  Modal,
  Select,
  Space,
  Steps,
  Table,
  Tag,
  Typography,
} from '@arco-design/web-react';
import { useEffect, useMemo, useState } from 'react';
import {
  ApiError,
  addHypothesis,
  approvePlan,
  createForecast,
  createPlan,
  createTask,
  evaluateDecisionCase,
  generateDecisionReport,
  getDecisionCase,
  getPlan,
  listForecasts,
  rejectPlan,
  simulateDecisionCaseRoi,
  submitPlan,
} from '@/lib/api';
import { getCurrentUserId } from '@/lib/session';
import type {
  DecisionCase,
  Forecast,
  Hypothesis,
  Plan,
  RoiSimulation,
  Task,
} from '@/types/api';

const STEP_ITEMS: Array<{
  key: DecisionCase['stage'];
  label: string;
}> = [
  { key: 'dismantle', label: '拆解' },
  { key: 'hypothesize', label: '推演' },
  { key: 'evaluate', label: '评估' },
  { key: 'calculate', label: '测算' },
  { key: 'report', label: '报告' },
];

type DecisionCaseDetailPageProps = {
  decisionCaseId: string;
};

type HypothesisDraft = {
  content: string;
  evidenceScore: number;
  confidence: number;
  counterExample: string;
};

type EvaluationDraft = {
  resourceScore: number;
  timeScore: number;
  riskScore: number;
  feasibilityScore: number;
  comment: string;
};

type RoiDraft = {
  cost: number;
  revenue: number;
  assumptions: string;
};

type PlanDraft = {
  title: string;
  description: string;
};

type TaskDraft = {
  ownerId: string;
  title: string;
  description: string;
  dueTime: string;
};

function normalizeForecasts(payload: Forecast[] | Forecast | null | undefined) {
  if (!payload) {
    return [];
  }

  return Array.isArray(payload) ? payload : [payload];
}

function sortForecasts(items: Forecast[]) {
  return [...items].sort((left, right) => right.version - left.version);
}

function getCurrentStageIndex(stage: DecisionCase['stage']) {
  const index = STEP_ITEMS.findIndex((item) => item.key === stage);
  return index === -1 ? 0 : index;
}

function toNumberValue(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function DecisionCaseDetailPage({ decisionCaseId }: DecisionCaseDetailPageProps) {
  const [decisionCase, setDecisionCase] = useState<DecisionCase | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hypothesisDraft, setHypothesisDraft] = useState<HypothesisDraft>({
    content: '',
    evidenceScore: 60,
    confidence: 60,
    counterExample: '',
  });
  const [selectedHypothesisIds, setSelectedHypothesisIds] = useState<string[]>([]);
  const [forecasts, setForecasts] = useState<Forecast[]>([]);
  const [selectedForecastVersion, setSelectedForecastVersion] = useState<number | null>(null);
  const [selectedForecast, setSelectedForecast] = useState<Forecast | null>(null);
  const [evaluationDraft, setEvaluationDraft] = useState<EvaluationDraft>({
    resourceScore: 70,
    timeScore: 70,
    riskScore: 70,
    feasibilityScore: 70,
    comment: '',
  });
  const [roiDraft, setRoiDraft] = useState<RoiDraft>({
    cost: 10000,
    revenue: 15000,
    assumptions: '',
  });
  const [roiResult, setRoiResult] = useState<RoiSimulation | null>(null);
  const [planDraft, setPlanDraft] = useState<PlanDraft>({
    title: '',
    description: '',
  });
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);
  const [currentPlan, setCurrentPlan] = useState<Plan | null>(null);
  const [taskDraft, setTaskDraft] = useState<TaskDraft>({
    ownerId: getCurrentUserId() ?? '',
    title: '',
    description: '',
    dueTime: '',
  });
  const [createdTask, setCreatedTask] = useState<Task | null>(null);
  const [reportHint, setReportHint] = useState<string | null>(null);
  const [taskHint, setTaskHint] = useState<string | null>(null);
  const [rejectVisible, setRejectVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const currentUserId = getCurrentUserId();

  const hypothesisColumns = useMemo(
    () => [
      { title: '假设', dataIndex: 'content' },
      { title: '证据', dataIndex: 'evidenceScore' },
      { title: '置信度', dataIndex: 'confidence' },
      {
        title: '反例',
        render: (_: unknown, record: Hypothesis) => record.counterExample ?? '未填写',
      },
    ],
    [],
  );

  const forecastColumns = useMemo(
    () => [
      { title: '情景', dataIndex: 'name' },
      {
        title: '概率',
        render: (_: unknown, record: Forecast['scenarios'][number]) =>
          `${Math.round(record.probability * 100)}%`,
      },
      { title: '结果', dataIndex: 'outcome' },
      { title: '影响', dataIndex: 'impact' },
      { title: '前提', dataIndex: 'assumptions' },
    ],
    [],
  );

  useEffect(() => {
    void loadDecisionCase();
  }, [decisionCaseId]);

  async function loadDecisionCase() {
    try {
      setLoading(true);
      setError(null);
      const nextCase = await getDecisionCase(decisionCaseId);
      setDecisionCase(nextCase);
      const nextHypothesisIds = nextCase.hypotheses?.map((item) => item.id) ?? [];
      setSelectedHypothesisIds(nextHypothesisIds);
      await loadForecastCollection(nextCase);

      const nextPlanId =
        currentPlanId && nextCase.plans?.some((plan) => plan.id === currentPlanId)
          ? currentPlanId
          : nextCase.plans?.[0]?.id ?? null;
      setCurrentPlanId(nextPlanId);
      if (nextPlanId) {
        await loadPlan(nextPlanId);
      } else {
        setCurrentPlan(null);
      }
      setRoiResult(nextCase.roiSimulation ?? null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载决策案例失败');
    } finally {
      setLoading(false);
    }
  }

  async function loadForecastCollection(nextCase?: DecisionCase) {
    try {
      const payload = await listForecasts(nextCase?.id ?? decisionCaseId);
      const nextForecasts = sortForecasts(normalizeForecasts(payload));
      setForecasts(nextForecasts);
      const nextVersion =
        selectedForecastVersion && nextForecasts.some((item) => item.version === selectedForecastVersion)
          ? selectedForecastVersion
          : nextForecasts[0]?.version ?? null;
      setSelectedForecastVersion(nextVersion);
      if (nextVersion) {
        await loadForecastVersion(nextVersion);
      } else {
        setSelectedForecast(null);
      }
    } catch {
      setForecasts(sortForecasts(nextCase?.forecasts ?? []));
      setSelectedForecast(nextCase?.forecasts?.[0] ?? null);
      setSelectedForecastVersion(nextCase?.forecasts?.[0]?.version ?? null);
    }
  }

  async function loadForecastVersion(version: number) {
    const payload = await listForecasts(decisionCaseId, version);
    const nextForecast = normalizeForecasts(payload)[0] ?? null;
    setSelectedForecast(nextForecast);
  }

  async function loadPlan(planId: string) {
    try {
      const nextPlan = await getPlan(planId);
      setCurrentPlan(nextPlan);
    } catch {
      const fallback = decisionCase?.plans?.find((item) => item.id === planId) ?? null;
      setCurrentPlan(fallback);
    }
  }

  async function handleAddHypothesis() {
    if (!hypothesisDraft.content.trim()) {
      setError('请输入假设内容');
      return;
    }

    try {
      setBusyAction('hypothesis');
      setError(null);
      await addHypothesis(decisionCaseId, hypothesisDraft);
      setHypothesisDraft({
        content: '',
        evidenceScore: 60,
        confidence: 60,
        counterExample: '',
      });
      await loadDecisionCase();
      Message.success('假设已登记');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '登记假设失败');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleForecast() {
    if (!selectedHypothesisIds.length) {
      setError('至少选择一条假设再推演');
      return;
    }

    try {
      setBusyAction('forecast');
      setError(null);
      const nextForecast = await createForecast(decisionCaseId, {
        selectedHypothesisIds,
      });
      const nextForecasts = sortForecasts([
        ...forecasts.filter((item) => item.version !== nextForecast.version),
        nextForecast,
      ]);
      setForecasts(nextForecasts);
      setSelectedForecastVersion(nextForecast.version);
      setSelectedForecast(nextForecast);
      await loadDecisionCase();
      Message.success('推演已生成');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '推演失败');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleEvaluate() {
    try {
      setBusyAction('evaluate');
      setError(null);
      await evaluateDecisionCase(decisionCaseId, evaluationDraft);
      await loadDecisionCase();
      Message.success('评估已保存');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '提交评估失败');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSimulateRoi() {
    try {
      setBusyAction('roi');
      setError(null);
      const nextResult = await simulateDecisionCaseRoi(decisionCaseId, {
        cost: roiDraft.cost,
        revenue: roiDraft.revenue,
        assumptions: roiDraft.assumptions
          ? { note: roiDraft.assumptions }
          : undefined,
      });
      setRoiResult(nextResult);
      Message.success('ROI 试算完成');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : 'ROI 试算失败');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleGenerateReport() {
    try {
      setBusyAction('report');
      setError(null);
      setReportHint(null);
      await generateDecisionReport(decisionCaseId);
      setReportHint('报告已生成，可继续进入审批与执行。');
    } catch (actionError) {
      if (
        actionError instanceof ApiError &&
        actionError.status === 409 &&
        actionError.body?.code === 'NO_APPROVED_PLAN'
      ) {
        setReportHint('需先有已批准方案');
        return;
      }

      setError(actionError instanceof Error ? actionError.message : '生成报告失败');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreatePlan() {
    if (!planDraft.title.trim()) {
      setError('请输入方案标题');
      return;
    }

    try {
      setBusyAction('plan-create');
      setError(null);
      const nextPlan = await createPlan(decisionCaseId, planDraft);
      setCurrentPlanId(nextPlan.id);
      setCurrentPlan(nextPlan);
      setPlanDraft({ title: '', description: '' });
      await loadDecisionCase();
      Message.success('方案已创建');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '创建方案失败');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleSubmitPlan() {
    if (!currentPlanId) {
      return;
    }

    try {
      setBusyAction('plan-submit');
      setError(null);
      await submitPlan(currentPlanId);
      await loadPlan(currentPlanId);
      await loadDecisionCase();
      Message.success('方案已提交审批');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '提交审批失败');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleApprovePlan() {
    if (!currentPlanId) {
      return;
    }

    try {
      setBusyAction('plan-approve');
      setError(null);
      await approvePlan(currentPlanId);
      await loadPlan(currentPlanId);
      await loadDecisionCase();
      Message.success('方案已批准');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '审批失败');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleRejectPlan() {
    if (!currentPlanId || !rejectReason.trim()) {
      setError('请输入驳回原因');
      return;
    }

    try {
      setBusyAction('plan-reject');
      setError(null);
      await rejectPlan(currentPlanId, rejectReason.trim());
      setRejectVisible(false);
      setRejectReason('');
      await loadPlan(currentPlanId);
      await loadDecisionCase();
      Message.success('方案已驳回');
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : '驳回失败');
    } finally {
      setBusyAction(null);
    }
  }

  async function handleCreateTask() {
    if (!currentPlanId) {
      setTaskHint('请先创建方案');
      return;
    }

    if (!taskDraft.ownerId.trim() || !taskDraft.title.trim() || !taskDraft.dueTime) {
      setTaskHint('请填写负责人、任务标题和截止时间');
      return;
    }

    try {
      setBusyAction('task-create');
      setTaskHint(null);
      const nextTask = await createTask({
        planId: currentPlanId,
        ownerId: taskDraft.ownerId.trim(),
        title: taskDraft.title.trim(),
        description: taskDraft.description.trim() || undefined,
        dueTime: taskDraft.dueTime,
      });
      setCreatedTask(nextTask);
      Message.success('任务已创建');
    } catch (actionError) {
      if (
        actionError instanceof ApiError &&
        actionError.status === 422 &&
        actionError.body?.code === 'PLAN_NOT_APPROVED'
      ) {
        setTaskHint('方案未批准');
        return;
      }

      setTaskHint(actionError instanceof Error ? actionError.message : '创建任务失败');
    } finally {
      setBusyAction(null);
    }
  }

  if (loading) {
    return (
      <div className="page-shell">
        <Typography.Title heading={4}>加载中...</Typography.Title>
      </div>
    );
  }

  if (!decisionCase) {
    return (
      <div className="page-shell">
        <Alert type="error" content={error ?? '未找到决策案例'} />
      </div>
    );
  }

  const approveDisabled = currentPlan?.ownerId === currentUserId;

  return (
    <div className="page-shell decision-case-page">
      <div className="page-shell__header">
        <div>
          <Typography.Text className="page-shell__eyebrow">决策详情</Typography.Text>
          <Typography.Title heading={2}>{decisionCase.title}</Typography.Title>
          <Space size="medium">
            <Tag color="arcoblue">{decisionCase.stage}</Tag>
            <Tag>{decisionCase.status ?? '未标注'}</Tag>
          </Space>
        </div>
        <Button onClick={() => void loadDecisionCase()}>刷新</Button>
      </div>

      {error ? <Alert type="error" content={error} style={{ marginBottom: 16 }} /> : null}

      <Card bordered={false} className="decision-case-card">
        <Steps current={getCurrentStageIndex(decisionCase.stage)}>
          {STEP_ITEMS.map((item) => (
            <Steps.Step key={item.key} title={item.label} />
          ))}
        </Steps>
      </Card>

      <div className="decision-grid" style={{ marginTop: 8 }}>
        <div className="decision-grid__item">
          <Card
            title="假设登记"
            bordered={false}
            extra={
              <Button
                type="primary"
                loading={busyAction === 'hypothesis'}
                onClick={() => void handleAddHypothesis()}
              >
                登记假设
              </Button>
            }
          >
            <div className="decision-form-grid">
              <Input
                placeholder="假设内容"
                value={hypothesisDraft.content}
                onChange={(value) =>
                  setHypothesisDraft((current) => ({ ...current, content: value }))
                }
              />
              <InputNumber
                placeholder="证据强度"
                min={0}
                max={100}
                value={hypothesisDraft.evidenceScore}
                onChange={(value) =>
                  setHypothesisDraft((current) => ({
                    ...current,
                    evidenceScore: typeof value === 'number' ? value : 0,
                  }))
                }
              />
              <InputNumber
                placeholder="置信度"
                min={0}
                max={100}
                value={hypothesisDraft.confidence}
                onChange={(value) =>
                  setHypothesisDraft((current) => ({
                    ...current,
                    confidence: typeof value === 'number' ? value : 0,
                  }))
                }
              />
              <Input
                placeholder="反例"
                value={hypothesisDraft.counterExample}
                onChange={(value) =>
                  setHypothesisDraft((current) => ({ ...current, counterExample: value }))
                }
              />
            </div>
            <Table
              rowKey="id"
              size="small"
              pagination={false}
              columns={hypothesisColumns}
              data={decisionCase.hypotheses ?? []}
              style={{ marginTop: 16 }}
            />
          </Card>
        </div>

        <div className="decision-grid__item">
          <Card
            title="推演版本"
            bordered={false}
            extra={
              <Button
                type="primary"
                loading={busyAction === 'forecast'}
                disabled={!selectedHypothesisIds.length}
                onClick={() => void handleForecast()}
              >
                生成推演
              </Button>
            }
          >
            <Select
              mode="multiple"
              placeholder="选择进入推演的假设"
              value={selectedHypothesisIds}
              onChange={(value) => setSelectedHypothesisIds(value as string[])}
              options={(decisionCase.hypotheses ?? []).map((item) => ({
                label: item.content,
                value: item.id,
              }))}
            />
            <div className="decision-inline-row">
              <Typography.Text>版本切换</Typography.Text>
              <Select
                placeholder="选择推演版本"
                value={selectedForecastVersion ?? undefined}
                onChange={(value) => {
                  const nextVersion = value as number;
                  setSelectedForecastVersion(nextVersion);
                  void loadForecastVersion(nextVersion);
                }}
                options={forecasts.map((item) => ({
                  label: `v${item.version}`,
                  value: item.version,
                }))}
                style={{ width: 180 }}
              />
            </div>
            <Table
              rowKey="name"
              size="small"
              pagination={false}
              columns={forecastColumns}
              data={selectedForecast?.scenarios ?? []}
              style={{ marginTop: 16 }}
            />
          </Card>
        </div>

        <div className="decision-grid__item">
          <Card
            title="多维评估"
            bordered={false}
            extra={
              <Button
                type="primary"
                loading={busyAction === 'evaluate'}
                onClick={() => void handleEvaluate()}
              >
                保存评估
              </Button>
            }
          >
            <div className="decision-form-grid">
              <InputNumber
                placeholder="资源分"
                min={0}
                max={100}
                value={evaluationDraft.resourceScore}
                onChange={(value) =>
                  setEvaluationDraft((current) => ({
                    ...current,
                    resourceScore: typeof value === 'number' ? value : 0,
                  }))
                }
              />
              <InputNumber
                placeholder="时间分"
                min={0}
                max={100}
                value={evaluationDraft.timeScore}
                onChange={(value) =>
                  setEvaluationDraft((current) => ({
                    ...current,
                    timeScore: typeof value === 'number' ? value : 0,
                  }))
                }
              />
              <InputNumber
                placeholder="风险分"
                min={0}
                max={100}
                value={evaluationDraft.riskScore}
                onChange={(value) =>
                  setEvaluationDraft((current) => ({
                    ...current,
                    riskScore: typeof value === 'number' ? value : 0,
                  }))
                }
              />
              <InputNumber
                placeholder="可行性分"
                min={0}
                max={100}
                value={evaluationDraft.feasibilityScore}
                onChange={(value) =>
                  setEvaluationDraft((current) => ({
                    ...current,
                    feasibilityScore: typeof value === 'number' ? value : 0,
                  }))
                }
              />
            </div>
            <Input.TextArea
              placeholder="评估说明"
              autoSize={{ minRows: 3 }}
              value={evaluationDraft.comment}
              onChange={(value) =>
                setEvaluationDraft((current) => ({ ...current, comment: value }))
              }
              style={{ marginTop: 16 }}
            />
          </Card>
        </div>

        <div className="decision-grid__item">
          <Card
            title="ROI 试算"
            bordered={false}
            extra={
              <Button
                type="primary"
                loading={busyAction === 'roi'}
                onClick={() => void handleSimulateRoi()}
              >
                试算 ROI
              </Button>
            }
          >
            <div className="decision-form-grid">
              <Input
                placeholder="成本"
                type="number"
                value={String(roiDraft.cost)}
                onChange={(value) =>
                  setRoiDraft((current) => ({ ...current, cost: toNumberValue(value) }))
                }
              />
              <Input
                placeholder="收入"
                type="number"
                value={String(roiDraft.revenue)}
                onChange={(value) =>
                  setRoiDraft((current) => ({ ...current, revenue: toNumberValue(value) }))
                }
              />
            </div>
            <Input.TextArea
              placeholder="试算假设"
              autoSize={{ minRows: 3 }}
              value={roiDraft.assumptions}
              onChange={(value) => setRoiDraft((current) => ({ ...current, assumptions: value }))}
              style={{ marginTop: 16 }}
            />
            {roiResult ? (
              <div className="decision-result-grid">
                <Card size="small">
                  <Typography.Text className="app-shell__eyebrow">ROI</Typography.Text>
                  <Typography.Title heading={4}>
                    {roiResult.roi === null ? '成本为零' : roiResult.roi.toFixed(4)}
                  </Typography.Title>
                </Card>
                <Card size="small">
                  <Typography.Text className="app-shell__eyebrow">回收天数</Typography.Text>
                  <Typography.Title heading={4}>
                    {roiResult.paybackDays ?? '未返回'}
                  </Typography.Title>
                </Card>
              </div>
              ) : null}
          </Card>
        </div>
      </div>

      <div className="decision-grid" style={{ marginTop: 8 }}>
        <div className="decision-grid__item">
          <Card
            title="生成报告"
            bordered={false}
            extra={
              <Button
                type="primary"
                loading={busyAction === 'report'}
                onClick={() => void handleGenerateReport()}
              >
                生成报告
              </Button>
            }
          >
            <Typography.Paragraph type="secondary">
              汇总拆解、假设、评估、ROI 与方案审批上下文。
            </Typography.Paragraph>
            {reportHint ? <Alert type="info" content={reportHint} /> : null}
          </Card>
        </div>

        <div className="decision-grid__item">
          <Card title="方案审批" bordered={false}>
            <div className="decision-form-grid">
              <Input
                placeholder="方案标题"
                value={planDraft.title}
                onChange={(value) => setPlanDraft((current) => ({ ...current, title: value }))}
              />
              <Input.TextArea
                placeholder="方案描述"
                autoSize={{ minRows: 3 }}
                value={planDraft.description}
                onChange={(value) =>
                  setPlanDraft((current) => ({ ...current, description: value }))
                }
              />
            </div>
            <Space wrap style={{ marginTop: 16 }}>
              <Button
                type="primary"
                loading={busyAction === 'plan-create'}
                onClick={() => void handleCreatePlan()}
              >
                创建方案
              </Button>
              <Button
                loading={busyAction === 'plan-submit'}
                disabled={!currentPlanId}
                onClick={() => void handleSubmitPlan()}
              >
                提交审批
              </Button>
              <Button
                type="primary"
                status="success"
                disabled={!currentPlanId || approveDisabled}
                loading={busyAction === 'plan-approve'}
                onClick={() => void handleApprovePlan()}
              >
                审批通过
              </Button>
              <Button
                status="danger"
                disabled={!currentPlanId}
                onClick={() => setRejectVisible(true)}
              >
                驳回
              </Button>
            </Space>
            {approveDisabled ? (
              <Typography.Paragraph type="warning" style={{ marginTop: 12 }}>
                职责分离：不能审批自己的方案
              </Typography.Paragraph>
            ) : null}
            {currentPlan ? (
              <div className="decision-plan-summary">
                <Typography.Title heading={6}>{currentPlan.title}</Typography.Title>
                <Space size="medium">
                  <Tag color="arcoblue">{currentPlan.status}</Tag>
                  <Typography.Text>版本 {currentPlan.version ?? '-'}</Typography.Text>
                </Space>
                {currentPlan.rejectedReason ? (
                  <Typography.Paragraph type="secondary">
                    驳回原因：{currentPlan.rejectedReason}
                  </Typography.Paragraph>
                ) : null}
              </div>
            ) : null}
          </Card>
        </div>
      </div>

      <Card title="任务派生" bordered={false} style={{ marginTop: 16 }}>
        <div className="decision-form-grid">
          <Input
            placeholder="负责人 userId"
            value={taskDraft.ownerId}
            onChange={(value) => setTaskDraft((current) => ({ ...current, ownerId: value }))}
          />
          <Input
            placeholder="任务标题"
            value={taskDraft.title}
            onChange={(value) => setTaskDraft((current) => ({ ...current, title: value }))}
          />
          <Input
            placeholder="截止时间"
            type="datetime-local"
            value={taskDraft.dueTime}
            onChange={(value) => setTaskDraft((current) => ({ ...current, dueTime: value }))}
          />
          <Input.TextArea
            placeholder="任务描述"
            autoSize={{ minRows: 3 }}
            value={taskDraft.description}
            onChange={(value) =>
              setTaskDraft((current) => ({ ...current, description: value }))
            }
          />
        </div>
        <Space wrap style={{ marginTop: 16 }}>
          <Button
            type="primary"
            disabled={!currentPlanId}
            loading={busyAction === 'task-create'}
            onClick={() => void handleCreateTask()}
          >
            创建任务
          </Button>
          {currentPlan?.status !== 'approved' ? (
            <Typography.Text type="secondary">仅已批准方案允许派生任务。</Typography.Text>
          ) : null}
        </Space>
        {taskHint ? <Alert type="info" content={taskHint} style={{ marginTop: 16 }} /> : null}
        {createdTask ? (
          <div className="decision-task-created">
            <Typography.Title heading={6}>{createdTask.title}</Typography.Title>
            <Space size="medium">
              <Tag color="green">{createdTask.status}</Tag>
              <Link href={`/tasks/${createdTask.id}`}>进入任务反馈</Link>
            </Space>
          </div>
        ) : null}
      </Card>

      <Modal
        title="驳回方案"
        visible={rejectVisible}
        onCancel={() => setRejectVisible(false)}
        onOk={() => void handleRejectPlan()}
        confirmLoading={busyAction === 'plan-reject'}
        unmountOnExit
      >
        <Input.TextArea
          placeholder="请输入驳回原因"
          autoSize={{ minRows: 4 }}
          value={rejectReason}
          onChange={(value) => setRejectReason(value)}
        />
      </Modal>
    </div>
  );
}
