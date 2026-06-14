import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateProblemDto } from './dto/create-problem.dto';

@Injectable()
export class ProblemsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async create(dto: CreateProblemDto) {
    if (dto.goalId) {
      const goal = await this.prisma.goal.findFirst({
        where: {
          id: dto.goalId,
          orgId: this.tenantContext.getTenantId(),
          deletedAt: null,
        },
      });

      if (!goal) {
        throw new NotFoundException('GOAL_NOT_FOUND');
      }
    }

    return this.prisma.problem.create({
      data: {
        goalId: dto.goalId ?? null,
        title: dto.title,
        description: dto.description ?? null,
      },
    });
  }

  async decompose(id: string) {
    const problem = await this.prisma.problem.findFirst({
      where: {
        id,
        deletedAt: null,
        goal: {
          is: {
            orgId: this.tenantContext.getTenantId(),
            deletedAt: null,
          },
        },
      },
    });

    if (!problem) {
      throw new NotFoundException('PROBLEM_NOT_FOUND');
    }

    const decomposition = {
      problemId: problem.id,
      summary: problem.title,
      factors: [problem.description ?? problem.title],
      generatedBy: 'manual',
    };

    return decomposition;
  }
}
