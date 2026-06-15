'use client';

import { PropsWithChildren } from 'react';
import { Button, Layout, Menu, Space, Typography } from '@arco-design/web-react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth-store';

const { Header, Content, Sider } = Layout;

function getActiveMenuKey(pathname: string) {
  if (pathname.startsWith('/goals')) {
    return '/goals';
  }

  return '/dashboard';
}

export function AppShell({ children }: PropsWithChildren) {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useAuthStore((state) => state.logout);
  const tenantId = useAuthStore((state) => state.tenantId);

  return (
    <Layout className="app-shell">
      <Sider className="app-shell__sider" breakpoint="lg" collapsedWidth={0}>
        <div className="app-shell__brand">
          <Typography.Title heading={4} style={{ margin: 0, color: '#fff' }}>
            XCDOS
          </Typography.Title>
          <Typography.Text style={{ color: 'rgba(255,255,255,0.72)' }}>
            Sprint 5
          </Typography.Text>
        </div>
        <Menu
          theme="dark"
          selectedKeys={[getActiveMenuKey(pathname)]}
          onClickMenuItem={(key) => router.push(key)}
        >
          <Menu.Item key="/dashboard">老板驾驶舱</Menu.Item>
          <Menu.Item key="/goals">目标管理</Menu.Item>
        </Menu>
      </Sider>
      <Layout>
        <Header className="app-shell__header">
          <Space size="large">
            <div>
              <Typography.Text className="app-shell__eyebrow">当前租户</Typography.Text>
              <Typography.Title heading={6} style={{ margin: 0 }}>
                {tenantId ?? '未识别'}
              </Typography.Title>
            </div>
            <Button
              onClick={() => {
                logout();
                router.replace('/login');
              }}
            >
              退出
            </Button>
          </Space>
        </Header>
        <Content className="app-shell__content">{children}</Content>
      </Layout>
    </Layout>
  );
}
