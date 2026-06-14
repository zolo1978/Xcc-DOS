import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('DecisionCasesService', () => {
  const prisma = {
    decisionCase: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    evaluation: {
      findMany: vi.fn(),
    },
    forecast: {
      findFirst: vi.fn(),
    },
    hypothesis: {
      findMany: vi.fn(),
    },
    plan: {
      count: vi.fn(),
    },
    roiSimulation: {
      findMany: vi.fn(),
    },
  };

  const tenantContext = {
    getTenantId: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tenantContext.getTenantId.mockReturnValue('tenant-1');
  });

  it('generateReport returns a report payload and throws 409 when the case has no approved plan', async () => {
    const { DecisionCasesService } = await import('./decision-cases.service');
    prisma.decisionCase.findFirst.mockResolvedValueOnce({
      id: 'case-1',
      problemId: 'problem-1',
      title: 'Improve throughput',
      stage: 'calculate',
      status: 'open',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      deletedAt: null,
    });
    prisma.hypothesis.findMany.mockResolvedValue([
      {
        id: 'hyp-1',
        caseId: 'case-1',
        content: 'Demand will stay stable',
        evidenceScore: { toString: () => '75.5' },
        confidence: { toString: () => '60.0' },
        counterExample: null,
        status: 'proposed',
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
        deletedAt: null,
      },
    ]);
    prisma.forecast.findFirst.mockResolvedValue({
      id: 'forecast-2',
      caseId: 'case-1',
      version: 2,
      scenarios: [{ name: 'base' }],
      confidence: { toString: () => '88.0' },
      modelSource: 'planner',
      agentRunId: null,
      inputHypothesisIds: ['hyp-1'],
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      deletedAt: null,
    });
    prisma.evaluation.findMany.mockResolvedValue([
      {
        id: 'eval-1',
        caseId: 'case-1',
        resourceScore: { toString: () => '80' },
        timeScore: { toString: () => '70' },
        riskScore: { toString: () => '55' },
        feasibilityScore: { toString: () => '77' },
        comment: 'Looks workable',
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
        deletedAt: null,
      },
    ]);
    prisma.roiSimulation.findMany.mockResolvedValue([
      {
        id: 'roi-1',
        caseId: 'case-1',
        cost: { toString: () => '100' },
        revenue: { toString: () => '180' },
        roi: { toString: () => '0.8' },
        paybackDays: 90,
        assumptions: { volume: 'stable' },
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
        deletedAt: null,
      },
    ]);
    prisma.decisionCase.update.mockResolvedValue({
      id: 'case-1',
      problemId: 'problem-1',
      title: 'Improve throughput',
      stage: 'report',
      status: 'open',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T00:00:00.000Z'),
      deletedAt: null,
    });
    prisma.decisionCase.findFirst.mockResolvedValue({
      id: 'case-1',
      problemId: 'problem-1',
      title: 'Improve throughput',
      stage: 'report',
      status: 'open',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T00:00:00.000Z'),
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
        report: {
          case: expect.objectContaining({
            stage: 'report',
            status: 'open',
          }),
          forecast: expect.objectContaining({
            version: 2,
          }),
          hypotheses: expect.arrayContaining([
            expect.objectContaining({
              id: 'hyp-1',
            }),
          ]),
        },
      },
      status: 409,
    });
    expect(prisma.decisionCase.update).toHaveBeenCalledWith({
      where: {
        id: 'case-1',
      },
      data: {
        stage: 'report',
      },
    });
  });

  it('generateReport resolves the case when an approved plan exists', async () => {
    const { DecisionCasesService } = await import('./decision-cases.service');
    prisma.decisionCase.findFirst.mockResolvedValue({
      id: 'case-1',
      problemId: 'problem-1',
      title: 'Improve throughput',
      stage: 'calculate',
      status: 'open',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      deletedAt: null,
    });
    prisma.hypothesis.findMany.mockResolvedValue([]);
    prisma.forecast.findFirst.mockResolvedValue(null);
    prisma.evaluation.findMany.mockResolvedValue([]);
    prisma.roiSimulation.findMany.mockResolvedValue([]);
    prisma.plan.count.mockResolvedValue(1);
    prisma.decisionCase.update.mockResolvedValue({
      id: 'case-1',
      problemId: 'problem-1',
      title: 'Improve throughput',
      stage: 'report',
      status: 'resolved',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-02T00:00:00.000Z'),
      deletedAt: null,
    });

    const service = new DecisionCasesService(
      prisma as never,
      tenantContext as never,
    );

    await expect(service.generateReport('case-1')).resolves.toMatchObject({
      case: expect.objectContaining({
        stage: 'report',
        status: 'resolved',
      }),
      resolved: true,
    });
  });
});
