import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('DecisionCasesService', () => {
  const prisma = {
    decisionCase: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    plan: {
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

  it('generateReport throws 409 when the case has no approved plan', async () => {
    const { DecisionCasesService } = await import('./decision-cases.service');
    prisma.decisionCase.findFirst.mockResolvedValue({
      id: 'case-1',
      problemId: 'problem-1',
      title: 'Improve throughput',
      stage: 'calculate',
      status: 'open',
      deletedAt: null,
    });
    prisma.plan.count.mockResolvedValue(0);

    const service = new DecisionCasesService(
      prisma as never,
      tenantContext as never,
    );

    await expect(service.generateReport('case-1')).rejects.toMatchObject({
      response: {
        code: 'NO_APPROVED_PLAN',
      },
      status: 409,
    });
  });
});
