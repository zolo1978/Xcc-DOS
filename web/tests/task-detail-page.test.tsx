import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TaskDetailPage } from '@/features/tasks/task-detail-page';
import { clearSession, setSession } from '@/lib/session';

function createToken(payload: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return `header.${encoded}.signature`;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('TaskDetailPage', () => {
  beforeEach(() => {
    clearSession();
    vi.restoreAllMocks();
    setSession({
      accessToken: createToken({
        tenant: 'tenant-1',
        tokenType: 'access',
        sub: 'user-2',
      }),
      refreshToken: 'refresh-token',
      tenantId: 'tenant-1',
    });
  });

  it('guides the user to create a revision after duplicate feedback on the same day', async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);

      if (url === '/api/tasks/task-1/feedback' && init?.method === 'GET') {
        return Promise.resolve(
          jsonResponse([
            {
              id: 'feedback-1',
              taskId: 'task-1',
              revision: 1,
              todayGoal: '完成方案宣讲',
              result: '已完成',
              blocker: '无',
              nextAction: '输出复盘',
              supersededBy: null,
              qualityScore: 82,
              submittedAt: '2026-06-15T09:00:00.000Z',
            },
          ]),
        );
      }

      if (url === '/api/tasks/task-1/feedback' && init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(
            {
              code: 'DUPLICATE_FEEDBACK',
              message: 'duplicate',
            },
            409,
          ),
        );
      }

      if (url === '/api/feedbacks/feedback-1/revisions' && init?.method === 'POST') {
        return Promise.resolve(
          jsonResponse(
            {
              id: 'feedback-2',
              taskId: 'task-1',
              revision: 2,
              todayGoal: '完成方案宣讲',
              result: '已完成并补充会议纪要',
              blocker: '无',
              nextAction: '同步销售团队',
              supersededBy: null,
              qualityScore: null,
              submittedAt: '2026-06-15T10:30:00.000Z',
            },
            201,
          ),
        );
      }

      return Promise.reject(new Error(`Unhandled request: ${url}`));
    });

    vi.stubGlobal('fetch', fetchMock);

    render(<TaskDetailPage taskId="task-1" />);

    await waitFor(() => {
      expect(screen.getByText('反馈修订链')).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText('今日目标'), {
      target: { value: '完成方案宣讲' },
    });
    fireEvent.change(screen.getByLabelText('今日结果'), {
      target: { value: '已完成并补充会议纪要' },
    });
    fireEvent.change(screen.getByLabelText('当前卡点'), {
      target: { value: '无' },
    });
    fireEvent.change(screen.getByLabelText('下一步动作'), {
      target: { value: '同步销售团队' },
    });

    fireEvent.click(screen.getByRole('button', { name: '提交反馈' }));

    await waitFor(() => {
      expect(screen.getByText('今日已反馈，去修订')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '去修订' }));
    fireEvent.click(screen.getByRole('button', { name: '提交修订' }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/feedbacks/feedback-1/revisions',
        expect.objectContaining({
          method: 'POST',
        }),
      );
    });
  });
});
