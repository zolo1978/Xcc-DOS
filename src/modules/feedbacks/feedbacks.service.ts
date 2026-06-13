import {
  ConflictException,
  ForbiddenException,
  Injectable,
  HttpException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { errorBody } from '../../common/http/api-error';
import { OutboxService } from '../../common/outbox/outbox.service';
import { TenantContext } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ReviseFeedbackDto } from './dto/revise-feedback.dto';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';

type FeedbackRecord = {
  id: string;
  taskId: string;
  userId: string;
  todayGoal: string | null;
  result: string | null;
  blocker: string | null;
  nextAction: string | null;
  qualityScore: { toString(): string } | number | null;
  businessDate: Date;
  revision: number;
  supersededBy: string | null;
  submittedAt: Date;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class FeedbacksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
    private readonly outboxService: OutboxService,
  ) {}

  async submit(taskId: string, dto: SubmitFeedbackDto, idempotencyKey?: string) {
    const tenantId = this.tenantContext.getTenantId();
    const userId = this.tenantContext.getUserId();
    const businessDate = this.resolveBusinessDate(dto.timezone);

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const task = await tx.task.findFirst({
        where: {
          id: taskId,
          deletedAt: null,
          plan: {
            decisionCase: {
              problem: {
                goal: {
                  orgId: tenantId,
                  deletedAt: null,
                },
              },
            },
          },
        },
      });

      if (!task) {
        throw new NotFoundException('TASK_NOT_FOUND');
      }

      if (idempotencyKey) {
        const fingerprint = this.feedbackFingerprint(taskId, userId, dto, businessDate);
        const existingKey = await tx.idempotencyKey.findUnique({
          where: {
            idempotencyKey,
          },
        });

        if (existingKey?.responseSnapshot) {
          return existingKey.responseSnapshot;
        }

        if (!existingKey) {
          await tx.idempotencyKey.create({
            data: {
              idempotencyKey,
              requestFingerprint: fingerprint,
              expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
            },
          });
        } else if (existingKey.requestFingerprint !== fingerprint) {
          throw new ConflictException(
            errorBody('IDEMPOTENCY_KEY_REUSED', 'Idempotency key fingerprint mismatch'),
          );
        }
      }

      const current = await tx.feedback.findFirst({
        where: {
          taskId,
          userId,
          businessDate,
          supersededBy: null,
        },
      });

      if (current) {
        throw new ConflictException(
          errorBody(
            'DUPLICATE_FEEDBACK',
            'Current-day feedback already exists; create a revision instead',
          ),
        );
      }

      const created = await tx.feedback.create({
        data: {
          taskId,
          userId,
          todayGoal: dto.todayGoal,
          result: dto.result,
          blocker: dto.blocker,
          nextAction: dto.nextAction,
          qualityScore: dto.qualityScore,
          businessDate,
          revision: 1,
        },
      });

      await this.outboxService.enqueue(tx, {
        tenantId,
        eventType: 'feedback.submitted',
        aggregateType: 'task',
        aggregateId: taskId,
        payload: {
          feedbackId: created.id,
          revision: created.revision,
        },
      });

      const response = this.toResponse(created);

      if (idempotencyKey) {
        await tx.idempotencyKey.update({
          where: {
            idempotencyKey,
          },
          data: {
            status: 'completed',
            responseSnapshot: response,
          },
        });
      }

      return response;
    });
  }

  async getTaskFeedback(taskId: string) {
    const tenantId = this.tenantContext.getTenantId();
    const task = await this.prisma.task.findFirst({
      where: {
        id: taskId,
        deletedAt: null,
        plan: {
          decisionCase: {
            problem: {
              goal: {
                orgId: tenantId,
                deletedAt: null,
              },
            },
          },
        },
      },
    });

    if (!task) {
      throw new NotFoundException('TASK_NOT_FOUND');
    }

    const history = (await this.prisma.feedback.findMany({
      where: {
        taskId,
      },
      orderBy: [
        { businessDate: 'desc' },
        { revision: 'desc' },
      ],
    })) as FeedbackRecord[];
    const current = history.find((item: FeedbackRecord) => item.supersededBy === null) ?? null;

    return {
      current: current ? this.toResponse(current) : null,
      history: history.map((item: FeedbackRecord) => this.toResponse(item)),
    };
  }

  async revise(id: string, dto: ReviseFeedbackDto) {
    const tenantId = this.tenantContext.getTenantId();
    const userId = this.tenantContext.getUserId();

    return this.prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const current = await tx.feedback.findFirst({
        where: {
          id,
        },
        include: {
          task: {
            include: {
              plan: {
                include: {
                  decisionCase: {
                    include: {
                      problem: {
                        include: {
                          goal: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!current || current.task.plan.decisionCase.problem.goal.orgId !== tenantId) {
        throw new NotFoundException('FEEDBACK_NOT_FOUND');
      }

      if (current.userId !== userId) {
        throw new ForbiddenException(
          errorBody('FORBIDDEN_FEEDBACK_REVISION', 'Only the author can revise feedback'),
        );
      }

      if (current.supersededBy) {
        throw new ConflictException(
          errorBody('FEEDBACK_ALREADY_SUPERSEDED', 'Feedback has already been superseded'),
        );
      }

      if (this.isBusinessDateLocked(current.businessDate)) {
        throw new HttpException(
          errorBody('FEEDBACK_LOCKED', 'Feedback business date is already locked'),
          423,
        );
      }

      const created = await tx.feedback.create({
        data: {
          taskId: current.taskId,
          userId: current.userId,
          todayGoal: dto.todayGoal ?? current.todayGoal,
          result: dto.result ?? current.result,
          blocker: dto.blocker ?? current.blocker,
          nextAction: dto.nextAction ?? current.nextAction,
          qualityScore: dto.qualityScore ?? current.qualityScore,
          businessDate: current.businessDate,
          revision: current.revision + 1,
        },
      });

      await tx.feedback.update({
        where: {
          id: current.id,
        },
        data: {
          supersededBy: created.id,
        },
      });

      await this.outboxService.enqueue(tx, {
        tenantId,
        eventType: 'feedback.revised',
        aggregateType: 'feedback',
        aggregateId: current.id,
        payload: {
          feedbackId: created.id,
          previousFeedbackId: current.id,
          revision: created.revision,
        },
      });

      return this.toResponse(created);
    });
  }

  private resolveBusinessDate(timezone: string): Date {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    const parts = formatter.formatToParts(new Date());
    const year = parts.find((part) => part.type === 'year')?.value;
    const month = parts.find((part) => part.type === 'month')?.value;
    const day = parts.find((part) => part.type === 'day')?.value;

    if (!year || !month || !day) {
      throw new RangeError('Invalid time value');
    }

    return new Date(`${year}-${month}-${day}T00:00:00.000Z`);
  }

  private isBusinessDateLocked(businessDate: Date): boolean {
    const today = new Date();
    const normalizedToday = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()),
    );
    return businessDate.getTime() < normalizedToday.getTime();
  }

  private feedbackFingerprint(
    taskId: string,
    userId: string,
    dto: SubmitFeedbackDto,
    businessDate: Date,
  ): string {
    return JSON.stringify({
      taskId,
      userId,
      todayGoal: dto.todayGoal ?? null,
      result: dto.result ?? null,
      blocker: dto.blocker ?? null,
      nextAction: dto.nextAction ?? null,
      qualityScore: dto.qualityScore ?? null,
      businessDate: businessDate.toISOString().slice(0, 10),
    });
  }

  private toResponse(feedback: FeedbackRecord) {
    return {
      id: feedback.id,
      taskId: feedback.taskId,
      revision: feedback.revision,
      supersededBy: feedback.supersededBy,
      qualityScore:
        feedback.qualityScore === null
          ? null
          : Number(
              typeof feedback.qualityScore === 'number'
                ? feedback.qualityScore
                : feedback.qualityScore.toString(),
            ),
      submittedAt: feedback.submittedAt.toISOString(),
      todayGoal: feedback.todayGoal,
      result: feedback.result,
      blocker: feedback.blocker,
      nextAction: feedback.nextAction,
      businessDate: feedback.businessDate.toISOString().slice(0, 10),
    };
  }
}
