'use client';

import Link from 'next/link';
import { Alert, Button, Card, Space, Table, Tag, Typography } from '@arco-design/web-react';
import { useEffect, useMemo, useState } from 'react';
import { listDecisionCases } from '@/lib/api';
import type { DecisionCase } from '@/types/api';

export function DecisionCasesPage() {
  const [decisionCases, setDecisionCases] = useState<DecisionCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const columns = useMemo(
    () => [
      {
        title: '决策案例',
        render: (_: unknown, record: DecisionCase) => (
          <Link href={`/decision-cases/${record.id}`}>{record.title}</Link>
        ),
      },
      {
        title: '阶段',
        render: (_: unknown, record: DecisionCase) => (
          <Tag color="arcoblue">{record.stage}</Tag>
        ),
      },
      {
        title: '状态',
        render: (_: unknown, record: DecisionCase) => record.status ?? '未标注',
      },
      {
        title: '假设数',
        render: (_: unknown, record: DecisionCase) => record.hypotheses?.length ?? 0,
      },
      {
        title: '方案数',
        render: (_: unknown, record: DecisionCase) => record.plans?.length ?? 0,
      },
    ],
    [],
  );

  useEffect(() => {
    void loadDecisionCases();
  }, []);

  async function loadDecisionCases() {
    try {
      setLoading(true);
      setError(null);
      setDecisionCases(await listDecisionCases());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : '加载决策案例失败');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-shell">
      <div className="page-shell__header">
        <div>
          <Typography.Text className="page-shell__eyebrow">拆推评算中心</Typography.Text>
          <Typography.Title heading={2}>Decision Cases</Typography.Title>
        </div>
        <Space>
          <Button onClick={() => void loadDecisionCases()}>刷新</Button>
        </Space>
      </div>
      {error ? <Alert type="error" content={error} style={{ marginBottom: 16 }} /> : null}
      <Card bordered={false}>
        <Table
          rowKey="id"
          loading={loading}
          pagination={false}
          columns={columns}
          data={decisionCases}
        />
      </Card>
    </div>
  );
}
