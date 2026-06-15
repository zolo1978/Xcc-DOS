import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('PlansService', () => {
  const prisma = {
    plan: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    decisionCase: {
      update: vi.fn(),
    },
  };

  const tenantContext = {
    getTenantId: vi.fn(),
    getUserId: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tenantContext.getTenantId.mockReturnValue('tenant-1');
    tenantContext.getUserId.mockReturnValue('approver-1');
  });

  it('approve throws 403 when approver is the plan owner', async () => {
    const { PlansService } = await import('./plans.service');
    prisma.plan.findFirst.mockResolvedValue({
      id: 'plan-1',
      caseId: 'case-1',
      ownerId: 'approver-1',
      status: 'submitted',
      deletedAt: null,
    });

    const service = new PlansService(prisma as never, tenantContext as never);

    await expect(service.approve('plan-1')).rejects.toMatchObject({
      status: 403,
    });
  });

  it('submit throws 409 on an illegal plan state transition', async () => {
    const { PlansService } = await import('./plans.service');
    prisma.plan.findFirst.mockResolvedValue({
      id: 'plan-1',
      caseId: 'case-1',
      ownerId: 'owner-1',
      status: 'approved',
      deletedAt: null,
    });

    const service = new PlansService(prisma as never, tenantContext as never);

    await expect(service.submit('plan-1')).rejects.toMatchObject({
      response: {
        code: 'INVALID_PLAN_STATE',
      },
      status: 409,
    });
  });
});
