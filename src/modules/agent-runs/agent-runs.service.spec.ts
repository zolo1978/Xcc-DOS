import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('AgentRunsService', () => {
  const prisma = {
    agentRun: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      update: vi.fn(),
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('cancel is idempotent and returns the terminal state unchanged', async () => {
    const { AgentRunsService } = await import('./agent-runs.service');
    prisma.agentRun.findFirst.mockResolvedValue({
      id: 'run-1',
      agentType: 'report',
      triggerType: 'manual',
      status: 'cancelled',
      input: null,
      output: null,
      toolCalls: [],
      createdAt: new Date('2026-06-14T00:00:00.000Z'),
      updatedAt: new Date('2026-06-14T00:00:00.000Z'),
    });

    const service = new AgentRunsService(prisma as never);
    const result = await service.cancel('run-1');

    expect(prisma.agentRun.update).not.toHaveBeenCalled();
    expect(result.status).toBe('cancelled');
  });
});
