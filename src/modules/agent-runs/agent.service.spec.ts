import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('AgentService', () => {
  const prisma = {
    goal: {
      findFirst: vi.fn(),
    },
    problem: {
      findFirst: vi.fn(),
    },
    decisionCase: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    hypothesis: {
      findMany: vi.fn(),
    },
    forecast: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    evaluation: {
      create: vi.fn(),
    },
    agentRun: {
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  const tenantContext = {
    getTenantId: vi.fn(),
    getUserId: vi.fn(),
  };

  const llmGateway = {
    chat: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tenantContext.getTenantId.mockReturnValue('tenant-1');
    tenantContext.getUserId.mockReturnValue('user-1');
  });

  it('runBreakdown persists a succeeded agent run with structured output', async () => {
    const { AgentService } = await import('./agent.service');

    prisma.goal.findFirst.mockResolvedValue({
      id: 'goal-1',
      orgId: 'tenant-1',
      title: 'Increase margin',
      metric: 'margin',
      targetValue: { toString: () => '30' },
      currentValue: { toString: () => '20' },
      startDate: new Date('2026-06-01T00:00:00.000Z'),
      deadline: new Date('2026-12-31T00:00:00.000Z'),
      status: 'draft',
      version: 0,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      deletedAt: null,
    });
    prisma.agentRun.create.mockResolvedValue({
      id: 'run-1',
      agentType: 'breakdown',
      triggerType: 'manual',
      status: 'running',
      input: {},
      output: null,
      toolCalls: null,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    });
    llmGateway.chat.mockResolvedValue({
      model: 'mock-gateway',
      usage: {
        promptTokens: 11,
        completionTokens: 7,
        totalTokens: 18,
      },
      content: JSON.stringify({
        summary: 'Increase margin',
        dimensions: ['pricing', 'yield'],
        constraints: ['budget'],
      }),
    });
    prisma.agentRun.update.mockResolvedValue({
      id: 'run-1',
      status: 'succeeded',
    });

    const service = new AgentService(
      prisma as never,
      tenantContext as never,
      llmGateway as never,
    );

    const result = await service.runBreakdown('goal-1');

    expect(llmGateway.chat).toHaveBeenCalledTimes(1);
    expect(prisma.agentRun.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({
        status: 'succeeded',
        output: expect.objectContaining({
          summary: 'Increase margin',
          dimensions: ['pricing', 'yield'],
          constraints: ['budget'],
        }),
      }),
    });
    expect(result).toMatchObject({
      agentRunId: 'run-1',
      status: 'succeeded',
      result: {
        summary: 'Increase margin',
      },
    });
  });

  it('runForecast creates a forecast row and marks the agent run as succeeded', async () => {
    const { AgentService } = await import('./agent.service');

    prisma.decisionCase.findFirst.mockResolvedValue({
      id: 'case-1',
      problemId: 'problem-1',
      title: 'Supplier strategy',
      stage: 'hypothesize',
      status: 'open',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      deletedAt: null,
    });
    prisma.hypothesis.findMany.mockResolvedValue([
      {
        id: 'hyp-1',
        caseId: 'case-1',
        content: 'Demand stays stable',
        evidenceScore: { toString: () => '71' },
        confidence: { toString: () => '65' },
        counterExample: null,
        status: 'proposed',
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
        deletedAt: null,
      },
    ]);
    prisma.agentRun.create.mockResolvedValue({
      id: 'run-forecast',
      agentType: 'forecast',
      triggerType: 'manual',
      status: 'running',
      input: {},
      output: null,
      toolCalls: null,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    });
    prisma.forecast.findFirst.mockResolvedValue({
      version: 2,
    });
    llmGateway.chat.mockResolvedValue({
      model: 'mock-gateway',
      usage: {
        promptTokens: 22,
        completionTokens: 10,
        totalTokens: 32,
      },
      content: JSON.stringify({
        scenarios: [
          {
            name: 'base',
            narrative: 'Steady demand',
            impact: 'medium',
          },
        ],
        confidence: 0.82,
      }),
    });
    prisma.forecast.create.mockResolvedValue({
      id: 'forecast-3',
      caseId: 'case-1',
      version: 3,
      scenarios: [
        {
          name: 'base',
          narrative: 'Steady demand',
          impact: 'medium',
        },
      ],
      confidence: { toString: () => '0.82' },
      modelSource: 'agent:mock-gateway',
      agentRunId: 'run-forecast',
      inputHypothesisIds: ['hyp-1'],
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      deletedAt: null,
    });
    prisma.decisionCase.update.mockResolvedValue({
      id: 'case-1',
      stage: 'evaluate',
    });
    prisma.agentRun.update.mockResolvedValue({
      id: 'run-forecast',
      status: 'succeeded',
    });

    const service = new AgentService(
      prisma as never,
      tenantContext as never,
      llmGateway as never,
    );

    const result = await service.runForecast('case-1', ['hyp-1']);

    expect(prisma.forecast.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        caseId: 'case-1',
        version: 3,
        modelSource: 'agent:mock-gateway',
        agentRunId: 'run-forecast',
        inputHypothesisIds: ['hyp-1'],
      }),
    });
    expect(prisma.agentRun.update).toHaveBeenCalledWith({
      where: { id: 'run-forecast' },
      data: expect.objectContaining({
        status: 'succeeded',
      }),
    });
    expect(result).toMatchObject({
      agentRunId: 'run-forecast',
      status: 'succeeded',
      result: {
        version: 3,
      },
    });
  });

  it('marks the agent run as failed when the gateway throws', async () => {
    const { AgentService } = await import('./agent.service');

    prisma.decisionCase.findFirst.mockResolvedValue({
      id: 'case-1',
      problemId: 'problem-1',
      title: 'Supplier strategy',
      stage: 'hypothesize',
      status: 'open',
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
      deletedAt: null,
    });
    prisma.hypothesis.findMany.mockResolvedValue([
      {
        id: 'hyp-1',
        caseId: 'case-1',
        content: 'Demand stays stable',
        evidenceScore: null,
        confidence: null,
        counterExample: null,
        status: 'proposed',
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        updatedAt: new Date('2026-06-01T00:00:00.000Z'),
        deletedAt: null,
      },
    ]);
    prisma.agentRun.create.mockResolvedValue({
      id: 'run-failed',
      agentType: 'forecast',
      triggerType: 'manual',
      status: 'running',
      input: {},
      output: null,
      toolCalls: null,
      createdAt: new Date('2026-06-01T00:00:00.000Z'),
      updatedAt: new Date('2026-06-01T00:00:00.000Z'),
    });
    llmGateway.chat.mockRejectedValue(new Error('gateway unavailable'));

    const service = new AgentService(
      prisma as never,
      tenantContext as never,
      llmGateway as never,
    );

    const result = await service.runForecast('case-1', ['hyp-1']);

    expect(prisma.agentRun.update).toHaveBeenCalledWith({
      where: { id: 'run-failed' },
      data: expect.objectContaining({
        status: 'failed',
        output: expect.objectContaining({
          error: 'gateway unavailable',
        }),
      }),
    });
    expect(prisma.forecast.create).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      agentRunId: 'run-failed',
      status: 'failed',
    });
  });
});
