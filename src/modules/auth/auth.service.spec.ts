import { beforeEach, describe, expect, it, vi } from 'vitest';

const argon2Verify = vi.fn();

vi.mock('argon2', () => ({
  verify: argon2Verify,
}));

describe('AuthService', () => {
  const prisma = {
    user: {
      findFirst: vi.fn(),
    },
  };

  const jwtService = {
    signAsync: vi.fn(),
    verifyAsync: vi.fn(),
  };

  const tokenStore = {
    blacklistAccessToken: vi.fn(),
    blacklistRefreshToken: vi.fn(),
    deleteSession: vi.fn(),
    getSession: vi.fn(),
    isTokenBlacklisted: vi.fn(),
    listSessions: vi.fn(),
    storeSession: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('login returns signed access and refresh tokens for a valid user', async () => {
    const { AuthService } = await import('./auth.service');
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      orgId: 'tenant-1',
      role: { name: 'manager' },
      passwordHash: 'stored-hash',
      status: 'active',
      deletedAt: null,
    });
    argon2Verify.mockResolvedValue(true);
    jwtService.signAsync
      .mockResolvedValueOnce('access-token')
      .mockResolvedValueOnce('refresh-token');
    tokenStore.storeSession.mockResolvedValue(undefined);

    const service = new AuthService(
      prisma as never,
      jwtService as never,
      tokenStore as never,
    );

    await expect(
      service.login(
        { email: 'boss@example.com', password: 'secret' },
        'Unit Test UA',
      ),
    ).resolves.toMatchObject({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    expect(prisma.user.findFirst).toHaveBeenCalledWith({
      where: {
        email: 'boss@example.com',
        deletedAt: null,
      },
      include: {
        role: true,
      },
    });
    expect(argon2Verify).toHaveBeenCalledWith('stored-hash', 'secret');
    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        jti: expect.any(String),
        sub: 'user-1',
        tenant: 'tenant-1',
        role: 'manager',
        tokenType: 'access',
      }),
      expect.any(Object),
    );
    expect(jwtService.signAsync).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        jti: expect.any(String),
        sub: 'user-1',
        tenant: 'tenant-1',
        role: 'manager',
        tokenType: 'refresh',
      }),
      expect.any(Object),
    );
    expect(tokenStore.storeSession).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        jti: expect.any(String),
        issuedAt: expect.any(String),
        userAgent: 'Unit Test UA',
      }),
      604800,
    );
  });

  it('login throws 401 when password verification fails', async () => {
    const { AuthService } = await import('./auth.service');
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      orgId: 'tenant-1',
      role: { name: 'manager' },
      passwordHash: 'stored-hash',
      status: 'active',
      deletedAt: null,
    });
    argon2Verify.mockResolvedValue(false);

    const service = new AuthService(
      prisma as never,
      jwtService as never,
      tokenStore as never,
    );

    await expect(
      service.login({ email: 'boss@example.com', password: 'wrong' }),
    ).rejects.toMatchObject({
      status: 401,
    });
  });

  it('refresh throws 401 when the refresh token jti has been blacklisted', async () => {
    const { AuthService } = await import('./auth.service');
    jwtService.verifyAsync.mockResolvedValue({
      sub: 'user-1',
      tenant: 'tenant-1',
      role: 'manager',
      tokenType: 'refresh',
      jti: 'refresh-jti-1',
      exp: Math.floor(Date.now() / 1000) + 300,
    });
    tokenStore.isTokenBlacklisted.mockResolvedValue(true);

    const service = new AuthService(
      prisma as never,
      jwtService as never,
      tokenStore as never,
    );

    await expect(
      service.refresh({ refreshToken: 'revoked-refresh-token' }),
    ).rejects.toMatchObject({
      status: 401,
    });
  });
});
