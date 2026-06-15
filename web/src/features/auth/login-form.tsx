'use client';

import { Alert, Button, Form, Input } from '@arco-design/web-react';
import type { LoginInput } from '@/types/api';

type LoginFormProps = {
  onSubmit: (values: LoginInput) => Promise<void>;
  submitting: boolean;
  errorMessage?: string | null;
};

export function LoginForm({ onSubmit, submitting, errorMessage }: LoginFormProps) {
  return (
    <Form<LoginInput>
      layout="vertical"
      initialValues={{
        email: 'owner@example.com',
        password: 'password123',
      }}
      onSubmit={(values) => {
        void onSubmit(values);
      }}
    >
      {errorMessage ? (
        <Alert
          type="error"
          content={errorMessage}
          style={{ marginBottom: 16 }}
        />
      ) : null}
      <Form.Item
        label="邮箱"
        field="email"
        rules={[{ required: true, message: '请输入邮箱' }]}
      >
        <Input aria-label="邮箱" placeholder="boss@example.com" autoComplete="email" />
      </Form.Item>
      <Form.Item
        label="密码"
        field="password"
        rules={[{ required: true, message: '请输入密码' }]}
      >
        <Input.Password
          aria-label="密码"
          placeholder="请输入密码"
          autoComplete="current-password"
        />
      </Form.Item>
      <Button htmlType="submit" type="primary" long loading={submitting}>
        登录
      </Button>
    </Form>
  );
}
