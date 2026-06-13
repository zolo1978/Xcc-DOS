import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TenantContext } from '../../common/tenant/tenant-context.service';
import { CreateGoalDto } from './dto/create-goal.dto';
import { ListGoalsDto } from './dto/list-goals.dto';
import { UpdateGoalStatusDto } from './dto/update-goal-status.dto';
import { GoalResponseDto } from './dto/goal-response.dto';

type GoalRecord = {
  id: string;
  orgId: string;
  ownerId: string;
  parentId: string | null;
  title: string;
  metric: string | null;
  targetValue: { toString(): string } | null;
  currentValue: { toString(): string } | null;
  startDate: Date;
  deadline: Date;
  status: string;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

@Injectable()
export class GoalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async create(dto: CreateGoalDto): Promise<GoalResponseDto> {
    const goal = await this.prisma.goal.create({
      data: {
        orgId: this.tenantContext.getTenantId(),
        ownerId: dto.ownerId,
        parentId: dto.parentId,
        title: dto.title,
        metric: dto.metric,
        targetValue: dto.targetValue,
        currentValue: dto.currentValue,
        startDate: new Date(dto.startDate),
        deadline: new Date(dto.deadline),
      },
    });

    return this.toResponse(goal);
  }

  async findAll(query: ListGoalsDto): Promise<GoalResponseDto[]> {
    const tenantId = this.tenantContext.getTenantId();
    const goals = await this.prisma.goal.findMany({
      where: {
        orgId: tenantId,
        deletedAt: null,
        ...(query.status ? { status: query.status } : {}),
        ...(query.goalId ? { id: query.goalId } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return goals.map((goal: GoalRecord) => this.toResponse(goal));
  }

  async findOne(id: string): Promise<GoalResponseDto> {
    const goal = await this.prisma.goal.findFirst({
      where: {
        id,
        orgId: this.tenantContext.getTenantId(),
        deletedAt: null,
      },
    });

    if (!goal) {
      throw new NotFoundException('GOAL_NOT_FOUND');
    }

    return this.toResponse(goal);
  }

  async updateStatus(
    id: string,
    dto: UpdateGoalStatusDto,
    ifMatchVersion: number,
  ): Promise<GoalResponseDto> {
    const tenantId = this.tenantContext.getTenantId();
    const result = await this.prisma.goal.updateMany({
      where: {
        id,
        orgId: tenantId,
        version: ifMatchVersion,
        deletedAt: null,
      },
      data: {
        status: dto.status,
        version: {
          increment: 1,
        },
      },
    });

    if (result.count === 0) {
      throw new ConflictException({
        code: 'VERSION_CONFLICT',
        message: 'Goal version mismatch',
      });
    }

    const goal = await this.prisma.goal.findFirst({
      where: {
        id,
        orgId: tenantId,
        deletedAt: null,
      },
    });

    if (!goal) {
      throw new NotFoundException('GOAL_NOT_FOUND');
    }

    return this.toResponse(goal);
  }

  async softDelete(id: string): Promise<void> {
    const tenantId = this.tenantContext.getTenantId();
    const goal = await this.prisma.goal.findFirst({
      where: {
        id,
        orgId: tenantId,
        deletedAt: null,
      },
    });

    if (!goal) {
      throw new NotFoundException('GOAL_NOT_FOUND');
    }

    const activeTaskCount = await this.prisma.task.count({
      where: {
        goalId: id,
        deletedAt: null,
        status: {
          in: ['todo', 'in_progress', 'delayed'],
        },
      },
    });

    if (activeTaskCount > 0) {
      throw new ConflictException({
        code: 'GOAL_HAS_ACTIVE_TASKS',
        message: 'Goal has active tasks',
      });
    }

    await this.prisma.goal.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    });
  }

  private toResponse(goal: GoalRecord): GoalResponseDto {
    return {
      id: goal.id,
      orgId: goal.orgId,
      ownerId: goal.ownerId,
      parentId: goal.parentId,
      title: goal.title,
      metric: goal.metric,
      targetValue: goal.targetValue?.toString() ?? null,
      currentValue: goal.currentValue?.toString() ?? null,
      startDate: goal.startDate.toISOString().slice(0, 10),
      deadline: goal.deadline.toISOString().slice(0, 10),
      status: goal.status,
      version: goal.version,
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
      deletedAt: goal.deletedAt?.toISOString() ?? null,
    };
  }
}
