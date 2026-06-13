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

    const service = new AuthService(prisma as never, jwtService as never);

    await expect(
      service.login({ email: 'boss@example.com', password: 'secret' }),
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
        sub: 'user-1',
        tenant: 'tenant-1',
        role: 'manager',
        tokenType: 'refresh',
      }),
      expect.any(Object),
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

    const service = new AuthService(prisma as never, jwtService as never);

    await expect(
      service.login({ email: 'boss@example.com', password: 'wrong' }),
    ).rejects.toMatchObject({
      status: 401,
    });
  });
});
