import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('GoalsService', () => {
  const prisma = {
    goal: {
      create: vi.fn(),
      findMany: vi.fn(),
      findFirst: vi.fn(),
      updateMany: vi.fn(),
      update: vi.fn(),
    },
    task: {
      count: vi.fn(),
    },
  };

  const tenantContext = {
    getTenantId: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tenantContext.getTenantId.mockReturnValue('tenant-1');
  });

  it('throws 409 when updateStatus optimistic lock update affects zero rows', async () => {
    const { GoalsService } = await import('./goals.service');
    prisma.goal.updateMany.mockResolvedValue({ count: 0 });

    const service = new GoalsService(prisma as never, tenantContext as never);

    await expect(
      service.updateStatus('goal-1', { status: 'active' }, 3),
    ).rejects.toMatchObject({
      response: {
        code: 'VERSION_CONFLICT',
      },
      status: 409,
    });
  });

  it('findAll only returns non-deleted rows for the current tenant', async () => {
    const { GoalsService } = await import('./goals.service');
    prisma.goal.findMany.mockResolvedValue([]);

    const service = new GoalsService(prisma as never, tenantContext as never);

    await service.findAll({ status: 'draft' });

    expect(prisma.goal.findMany).toHaveBeenCalledWith({
      where: {
        orgId: 'tenant-1',
        deletedAt: null,
        status: 'draft',
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  });

  it('softDelete throws 409 when the goal has unfinished tasks', async () => {
    const { GoalsService } = await import('./goals.service');
    prisma.goal.findFirst.mockResolvedValue({
      id: 'goal-1',
      orgId: 'tenant-1',
      deletedAt: null,
    });
    prisma.task.count.mockResolvedValue(2);

    const service = new GoalsService(prisma as never, tenantContext as never);

    await expect(service.softDelete('goal-1')).rejects.toMatchObject({
      response: {
        code: 'GOAL_HAS_ACTIVE_TASKS',
      },
      status: 409,
    });
  });

  it('findOne scopes reads to the current tenant', async () => {
    const { GoalsService } = await import('./goals.service');
    prisma.goal.findFirst.mockResolvedValue(null);

    const service = new GoalsService(prisma as never, tenantContext as never);

    await expect(service.findOne('goal-2')).rejects.toHaveProperty('status', 404);
    expect(prisma.goal.findFirst).toHaveBeenCalledWith({
      where: {
        id: 'goal-2',
        orgId: 'tenant-1',
        deletedAt: null,
      },
    });
  });
});
