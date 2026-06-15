import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearSession, setSession } from '@/lib/session';
import { listGoals } from '@/lib/api';

function createToken(payload: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return `header.${encoded}.signature`;
}

describe('api client', () => {
  beforeEach(() => {
    clearSession();
    vi.restoreAllMocks();
  });

  it('injects Authorization and X-Tenant-Id headers', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify([]), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);
    setSession({
      accessToken: createToken({ tenant: 'tenant-1', tokenType: 'access' }),
      refreshToken: 'refresh-token',
      tenantId: 'tenant-1',
    });

    await listGoals();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[1]).toMatchObject({
      headers: expect.objectContaining({
        Authorization: expect.stringContaining('Bearer '),
        'X-Tenant-Id': 'tenant-1',
      }),
    });
  });

  it('refreshes once on 401 and retries the original request', async () => {
    const refreshedToken = createToken({
      tenant: 'tenant-1',
      tokenType: 'access',
      sub: 'user-1',
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: refreshedToken }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify([{ id: 'goal-1', title: 'Grow ARR' }]), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      );

    vi.stubGlobal('fetch', fetchMock);
    setSession({
      accessToken: createToken({ tenant: 'tenant-1', tokenType: 'access' }),
      refreshToken: 'refresh-token',
      tenantId: 'tenant-1',
    });

    const goals = await listGoals();

    expect(goals).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[0]).toBe('/api/auth/refresh');
    expect(fetchMock.mock.calls[2]?.[1]).toMatchObject({
      headers: expect.objectContaining({
        Authorization: `Bearer ${refreshedToken}`,
      }),
    });
  });
});
