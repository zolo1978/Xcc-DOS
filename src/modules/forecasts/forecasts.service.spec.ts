import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('ForecastsService', () => {
  const prisma = {
    decisionCase: {
      findFirst: vi.fn(),
    },
    forecast: {
      findFirst: vi.fn(),
      create: vi.fn(),
      findMany: vi.fn(),
    },
  };

  const tenantContext = {
    getTenantId: vi.fn(),
    getUserId: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tenantContext.getTenantId.mockReturnValue('tenant-1');
    tenantContext.getUserId.mockReturnValue('user-1');
  });

  it('create increments version and does not overwrite older forecast', async () => {
    const { ForecastsService } = await import('./forecasts.service');
    prisma.decisionCase.findFirst.mockResolvedValue({
      id: 'case-1',
      deletedAt: null,
    });
    prisma.forecast.findFirst.mockResolvedValue({
      version: 2,
    });
    prisma.forecast.create.mockResolvedValue({
      id: 'forecast-3',
      caseId: 'case-1',
      version: 3,
      scenarios: [{ name: 'Base' }],
      confidence: 0.7,
      modelSource: 'manual',
      agentRunId: null,
      inputHypothesisIds: ['hyp-1'],
      createdAt: new Date('2026-06-14T00:00:00.000Z'),
      updatedAt: new Date('2026-06-14T00:00:00.000Z'),
      deletedAt: null,
    });

    const service = new ForecastsService(prisma as never, tenantContext as never);

    const created = await service.create('case-1', {
      scenarios: [{ name: 'Base' }],
      confidence: 0.7,
      modelSource: 'manual',
      inputHypothesisIds: ['hyp-1'],
      agentRunId: null,
    });

    expect(prisma.forecast.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        caseId: 'case-1',
        version: 3,
      }),
    });
    expect(created).toMatchObject({
      id: 'forecast-3',
      version: 3,
    });
  });
});
