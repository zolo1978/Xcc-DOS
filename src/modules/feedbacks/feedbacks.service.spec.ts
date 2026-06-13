import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('FeedbacksService', () => {
  const tx = {
    task: {
      findFirst: vi.fn(),
    },
    feedback: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    idempotencyKey: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
  };

  const prisma = {
    $transaction: vi.fn(),
  };

  const tenantContext = {
    getTenantId: vi.fn(),
    getUserId: vi.fn(),
  };

  const outboxService = {
    enqueue: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tenantContext.getTenantId.mockReturnValue('tenant-1');
    tenantContext.getUserId.mockReturnValue('user-1');
    outboxService.enqueue.mockResolvedValue(undefined);
    prisma.$transaction.mockImplementation(async (callback: (client: typeof tx) => unknown) =>
      callback(tx as never),
    );
  });

  it('submit throws 409 when current-day effective feedback already exists', async () => {
    const { FeedbacksService } = await import('./feedbacks.service');
    tx.task.findFirst.mockResolvedValue({
      id: 'task-1',
      ownerId: 'user-1',
      deletedAt: null,
      plan: {
        decisionCase: {
          problem: {
            goal: {
              orgId: 'tenant-1',
            },
          },
        },
      },
    });
    tx.feedback.findFirst.mockResolvedValue({
      id: 'feedback-1',
      supersededBy: null,
    });

    const service = new FeedbacksService(
      prisma as never,
      tenantContext as never,
      outboxService as never,
    );

    await expect(
      service.submit(
        'task-1',
        {
          todayGoal: 'Close gap',
          result: 'Done',
          blocker: 'None',
          nextAction: 'Review',
          qualityScore: 98,
          timezone: 'Asia/Shanghai',
        },
        'idem-1',
      ),
    ).rejects.toMatchObject({
      response: {
        code: 'DUPLICATE_FEEDBACK',
      },
      status: 409,
    });
  });

  it('revise creates a new row and links superseded_by to the new revision', async () => {
    const { FeedbacksService } = await import('./feedbacks.service');
    tx.feedback.findFirst.mockResolvedValue({
      id: 'feedback-1',
      taskId: 'task-1',
      userId: 'user-1',
      todayGoal: 'T1',
      result: 'R1',
      blocker: 'B1',
      nextAction: 'N1',
      qualityScore: 80,
      businessDate: new Date('2026-06-14T00:00:00.000Z'),
      revision: 1,
      supersededBy: null,
      submittedAt: new Date('2026-06-14T03:00:00.000Z'),
      createdAt: new Date('2026-06-14T03:00:00.000Z'),
      updatedAt: new Date('2026-06-14T03:00:00.000Z'),
      task: {
        ownerId: 'user-1',
        plan: {
          decisionCase: {
            problem: {
              goal: {
                orgId: 'tenant-1',
              },
            },
          },
        },
      },
    });
    tx.feedback.create.mockResolvedValue({
      id: 'feedback-2',
      taskId: 'task-1',
      userId: 'user-1',
      todayGoal: 'T2',
      result: 'R2',
      blocker: 'B2',
      nextAction: 'N2',
      qualityScore: 88,
      businessDate: new Date('2026-06-14T00:00:00.000Z'),
      revision: 2,
      supersededBy: null,
      submittedAt: new Date('2026-06-14T04:00:00.000Z'),
      createdAt: new Date('2026-06-14T04:00:00.000Z'),
      updatedAt: new Date('2026-06-14T04:00:00.000Z'),
    });

    const service = new FeedbacksService(
      prisma as never,
      tenantContext as never,
      outboxService as never,
    );

    const revision = await service.revise('feedback-1', {
      todayGoal: 'T2',
      result: 'R2',
      blocker: 'B2',
      nextAction: 'N2',
      qualityScore: 88,
    });

    expect(tx.feedback.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        taskId: 'task-1',
        userId: 'user-1',
        revision: 2,
      }),
    });
    expect(tx.feedback.update).toHaveBeenCalledWith({
      where: {
        id: 'feedback-1',
      },
      data: {
        supersededBy: 'feedback-2',
      },
    });
    expect(revision).toMatchObject({
      id: 'feedback-2',
      revision: 2,
      supersededBy: null,
    });
  });
});
