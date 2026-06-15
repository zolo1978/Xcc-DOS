import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { LoginForm } from '@/features/auth/login-form';

describe('LoginForm', () => {
  it('submits email and password from the Arco form', async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);

    render(<LoginForm onSubmit={onSubmit} submitting={false} />);

    fireEvent.change(screen.getByLabelText('邮箱'), {
      target: { value: 'boss@example.com' },
    });
    fireEvent.change(screen.getByLabelText('密码'), {
      target: { value: 'password123' },
    });
    fireEvent.click(screen.getByRole('button', { name: '登录' }));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        email: 'boss@example.com',
        password: 'password123',
      });
    });
  });
});
