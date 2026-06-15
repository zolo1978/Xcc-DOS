import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('TasksService', () => {
  const prisma = {
    plan: {
      findFirst: vi.fn(),
    },
    task: {
      create: vi.fn(),
    },
  };

  const tenantContext = {
    getTenantId: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tenantContext.getTenantId.mockReturnValue('tenant-1');
  });

  it('create throws 422 when the referenced plan is not approved', async () => {
    const { TasksService } = await import('./tasks.service');
    prisma.plan.findFirst.mockResolvedValue({
      id: 'plan-1',
      caseId: 'case-1',
      status: 'submitted',
      deletedAt: null,
    });

    const service = new TasksService(prisma as never, tenantContext as never);

    await expect(
      service.create({
        planId: 'plan-1',
        goalId: 'goal-1',
        ownerId: 'user-1',
        title: 'Follow up',
        description: 'Call supplier',
        dueTime: '2026-06-20T10:00:00.000Z',
        standardId: 'standard-1',
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'PLAN_NOT_APPROVED',
      },
      status: 422,
    });
  });
});
