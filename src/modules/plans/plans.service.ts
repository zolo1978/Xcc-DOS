import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { errorBody } from '../../common/http/api-error';
import { TenantContext } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreatePlanDto } from './dto/create-plan.dto';
import { PlanResponseDto } from './dto/plan-response.dto';
import { RejectPlanDto } from './dto/reject-plan.dto';
import { assertPlanState } from './plan-state.helper';

type PlanRecord = {
  id: string;
  caseId: string;
  ownerId: string;
  title: string;
  description: string | null;
  status: string;
  submittedAt: Date | null;
  approvedBy: string | null;
  approvedAt: Date | null;
  rejectedReason: string | null;
  version: number;
  deletedAt: Date | null;
};

@Injectable()
export class PlansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async create(caseId: string, dto: CreatePlanDto): Promise<PlanResponseDto> {
    const tenantId = this.tenantContext.getTenantId();
    const decisionCase = await this.prisma.decisionCase.findFirst({
      where: {
        id: caseId,
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
    });

    if (!decisionCase) {
      throw new NotFoundException('DECISION_CASE_NOT_FOUND');
    }

    const plan = await this.prisma.plan.create({
      data: {
        caseId,
        ownerId: this.tenantContext.getUserId(),
        title: dto.title,
        description: dto.description,
        status: 'draft',
      },
    });

    return this.toResponse(plan);
  }

  async findOne(id: string): Promise<PlanResponseDto> {
    const plan = await this.findScopedPlan(id);
    return this.toResponse(plan);
  }

  async submit(id: string): Promise<PlanResponseDto> {
    const plan = await this.findScopedPlan(id);
    assertPlanState(plan.status, ['draft', 'rejected'], 'submit');

    const updatedPlan = await this.prisma.plan.update({
      where: { id: plan.id },
      data: {
        status: 'submitted',
        submittedAt: new Date(),
        approvedBy: null,
        approvedAt: null,
        rejectedReason: null,
        version: {
          increment: 1,
        },
      },
    });

    return this.toResponse(updatedPlan);
  }

  async approve(id: string): Promise<PlanResponseDto> {
    const plan = await this.findScopedPlan(id);
    assertPlanState(plan.status, ['submitted'], 'approve');

    const approverId = this.tenantContext.getUserId();
    if (approverId === plan.ownerId) {
      throw new ForbiddenException(
        errorBody(
          'PLAN_APPROVER_MUST_NOT_BE_OWNER',
          'Approver must not be the plan owner',
        ),
      );
    }

    const updatedPlan = await this.prisma.plan.update({
      where: { id: plan.id },
      data: {
        status: 'approved',
        approvedBy: approverId,
        approvedAt: new Date(),
        rejectedReason: null,
        version: {
          increment: 1,
        },
      },
    });

    return this.toResponse(updatedPlan);
  }

  async reject(id: string, dto: RejectPlanDto): Promise<PlanResponseDto> {
    const plan = await this.findScopedPlan(id);
    assertPlanState(plan.status, ['submitted'], 'reject');

    const updatedPlan = await this.prisma.plan.update({
      where: { id: plan.id },
      data: {
        status: 'rejected',
        rejectedReason: dto.reason,
        approvedBy: null,
        approvedAt: null,
        version: {
          increment: 1,
        },
      },
    });

    return this.toResponse(updatedPlan);
  }

  private async findScopedPlan(id: string): Promise<PlanRecord> {
    const tenantId = this.tenantContext.getTenantId();
    const plan = await this.prisma.plan.findFirst({
      where: {
        id,
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

    return plan;
  }

  private toResponse(plan: PlanRecord): PlanResponseDto {
    return {
      id: plan.id,
      caseId: plan.caseId,
      title: plan.title,
      description: plan.description,
      status: plan.status,
      submittedAt: plan.submittedAt?.toISOString() ?? null,
      approvedBy: plan.approvedBy,
      approvedAt: plan.approvedAt?.toISOString() ?? null,
      rejectedReason: plan.rejectedReason,
      version: plan.version,
    };
  }
}
