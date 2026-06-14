import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { errorBody } from '../../common/http/api-error';
import { TenantContext } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateTaskDto } from './dto/create-task.dto';

@Injectable()
export class TasksService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async create(dto: CreateTaskDto) {
    const tenantId = this.tenantContext.getTenantId();
    const plan = await this.prisma.plan.findFirst({
      where: {
        id: dto.planId,
        deletedAt: null,
        decisionCase: {
          is: {
            deletedAt: null,
            problem: {
              is: {
                deletedAt: null,
                goal: {
                  is: {
                    orgId: tenantId,
                    deletedAt: null,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!plan) {
      throw new NotFoundException('PLAN_NOT_FOUND');
    }

    if (plan.status !== 'approved') {
      throw new UnprocessableEntityException(
        errorBody('PLAN_NOT_APPROVED', 'Task plan must be approved'),
      );
    }

    return this.prisma.task.create({
      data: {
        planId: dto.planId,
        goalId: dto.goalId,
        ownerId: dto.ownerId,
        title: dto.title,
        description: dto.description,
        dueTime: new Date(dto.dueTime),
        standardId: dto.standardId,
      },
    });
  }
}
