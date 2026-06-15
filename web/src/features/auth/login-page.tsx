'use client';

import { Card, Grid, Typography } from '@arco-design/web-react';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoginForm } from './login-form';
import { useAuthStore } from '@/stores/auth-store';

type LoginPageProps = {
  redirectTo?: string;
};

export function LoginPage({ redirectTo = '/dashboard' }: LoginPageProps) {
  const router = useRouter();
  const status = useAuthStore((state) => state.status);
  const login = useAuthStore((state) => state.login);
  const submitting = useAuthStore((state) => state.submitting);
  const loginError = useAuthStore((state) => state.loginError);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(redirectTo);
    }
  }, [redirectTo, router, status]);

  return (
    <div className="login-page">
      <Grid.Row gutter={32} align="center" className="login-page__grid">
        <Grid.Col xs={24} md={12}>
          <div className="login-page__hero">
            <Typography.Text className="login-page__eyebrow">
              XCDOS WEB CONSOLE
            </Typography.Text>
            <Typography.Title heading={1} className="login-page__title">
              决策与执行在同一块操作台里收口。
            </Typography.Title>
            <Typography.Paragraph className="login-page__desc">
              本切片覆盖认证、目标管理与老板驾驶舱，所有请求遵循 JWT Bearer 与租户头约束。
            </Typography.Paragraph>
          </div>
        </Grid.Col>
        <Grid.Col xs={24} md={12}>
          <Card className="login-page__card" bordered={false}>
            <Typography.Title heading={4}>登录 XCDOS</Typography.Title>
            <Typography.Paragraph type="secondary">
              使用 NestJS 后端签发的 token 对接前端会话。
            </Typography.Paragraph>
            <LoginForm
              onSubmit={async (values) => {
                await login(values);
                router.replace(redirectTo);
              }}
              submitting={submitting}
              errorMessage={loginError}
            />
          </Card>
        </Grid.Col>
      </Grid.Row>
    </div>
  );
}
