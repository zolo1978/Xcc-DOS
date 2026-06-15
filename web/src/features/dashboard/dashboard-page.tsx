'use client';

import { Alert, Card, Grid, Skeleton, Typography } from '@arco-design/web-react';
import { useEffect, useState } from 'react';
import type { BossDashboard } from '@/types/api';
import { getBossDashboard } from '@/lib/api';

const KPI_ITEMS = [
  { key: 'goals', label: '目标总数' },
  { key: 'openCases', label: '开放决策' },
  { key: 'approvedPlans', label: '已批方案' },
  { key: 'openExceptions', label: '待处理异常' },
] as const;

export function DashboardPage() {
  const [data, setData] = useState<BossDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        setData(await getBossDashboard());
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : '加载失败');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <div className="page-shell">
      <div className="page-shell__header">
        <div>
          <Typography.Text className="page-shell__eyebrow">老板驾驶舱</Typography.Text>
          <Typography.Title heading={2}>经营全景</Typography.Title>
        </div>
      </div>
      {error ? <Alert type="error" content={error} style={{ marginBottom: 16 }} /> : null}
      <Grid.Row gutter={[16, 16]}>
        {KPI_ITEMS.map((item) => (
          <Grid.Col xs={24} sm={12} lg={6} key={item.key}>
            <Card className="kpi-card" bordered={false}>
              <Typography.Text className="kpi-card__label">{item.label}</Typography.Text>
              {loading ? (
                <Skeleton text={{ rows: 1 }} animation />
              ) : (
                <Typography.Title heading={2} className="kpi-card__value">
                  {data?.metrics[item.key] ?? 0}
                </Typography.Title>
              )}
            </Card>
          </Grid.Col>
        ))}
      </Grid.Row>
      <Card className="embed-card" bordered={false}>
        <Typography.Title heading={5}>Superset 嵌入区</Typography.Title>
        <Typography.Paragraph type="secondary">
          Guest token 对接完成前，先保留 iframe 容器与版式位置。
        </Typography.Paragraph>
        {/* Superset guest token wiring will be added when embedding credentials are available. */}
        <iframe
          title="Superset placeholder"
          className="embed-card__frame"
          srcDoc="<html><body style='margin:0;display:flex;align-items:center;justify-content:center;height:100%;background:#0b1d33;color:#d9e8ff;font-family:Helvetica Neue,sans-serif;'>Superset guest token 待接入</body></html>"
        />
      </Card>
    </div>
  );
}
