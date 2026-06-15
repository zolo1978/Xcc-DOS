import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GoalsPage } from '@/features/goals/goals-page';
import { setSession, clearSession } from '@/lib/session';

function createToken(payload: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return `header.${encoded}.signature`;
}

describe('GoalsPage', () => {
  beforeEach(() => {
    clearSession();
    vi.restoreAllMocks();
  });

  it('renders rows from GET /api/goals', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify([
            {
              id: 'goal-1',
              orgId: 'tenant-1',
              ownerId: 'user-1',
              parentId: null,
              title: 'Grow ARR',
              metric: 'ARR',
              targetValue: '100',
              currentValue: '36',
              startDate: '2026-01-01',
              deadline: '2026-12-31',
              status: 'active',
              version: 3,
              createdAt: '2026-01-01T00:00:00.000Z',
              updatedAt: '2026-01-02T00:00:00.000Z',
              deletedAt: null,
            },
          ]),
          {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      ),
    );
    setSession({
      accessToken: createToken({ tenant: 'tenant-1', tokenType: 'access' }),
      refreshToken: 'refresh-token',
      tenantId: 'tenant-1',
    });

    render(<GoalsPage />);

    await waitFor(() => {
      expect(screen.getByText('Grow ARR')).toBeInTheDocument();
    });
    expect(screen.getByText('ARR')).toBeInTheDocument();
  });
});
