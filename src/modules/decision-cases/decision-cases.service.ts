import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { errorBody } from '../../common/http/api-error';
import { TenantContext } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateDecisionCaseDto } from './dto/create-decision-case.dto';
import { DecisionCaseResponseDto } from './dto/decision-case-response.dto';
import { ListDecisionCasesDto } from './dto/list-decision-cases.dto';

type DecisionCaseRecord = {
  id: string;
  problemId: string;
  title: string;
  stage: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

const DECISION_STAGES = [
  'dismantle',
  'hypothesize',
  'evaluate',
  'calculate',
  'report',
] as const;

type DecisionStage = (typeof DECISION_STAGES)[number];

@Injectable()
export class DecisionCasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async create(dto: CreateDecisionCaseDto): Promise<DecisionCaseResponseDto> {
    const tenantId = this.tenantContext.getTenantId();
    const problem = await this.prisma.problem.findFirst({
      where: {
        id: dto.problemId,
        deletedAt: null,
        goal: {
          is: {
            orgId: tenantId,
            deletedAt: null,
          },
        },
      },
    });

    if (!problem) {
      throw new NotFoundException('PROBLEM_NOT_FOUND');
    }

    const decisionCase = await this.prisma.decisionCase.create({
      data: {
        problemId: dto.problemId,
        title: dto.title,
        stage: 'dismantle',
      },
    });

    return this.toResponse(decisionCase);
  }

  async findAll(query: ListDecisionCasesDto): Promise<DecisionCaseResponseDto[]> {
    const tenantId = this.tenantContext.getTenantId();
    const decisionCases = await this.prisma.decisionCase.findMany({
      where: {
        deletedAt: null,
        ...(query.problemId ? { problemId: query.problemId } : {}),
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
      orderBy: {
        createdAt: 'desc',
      },
    });

    return decisionCases.map((decisionCase: DecisionCaseRecord) =>
      this.toResponse(decisionCase),
    );
  }

  async findOne(id: string): Promise<DecisionCaseResponseDto> {
    const decisionCase = await this.findScopedCase(id);
    return this.toResponse(decisionCase);
  }

  async generateReport(id: string): Promise<DecisionCaseResponseDto> {
    const decisionCase = await this.findScopedCase(id);
    const approvedPlanCount = await this.prisma.plan.count({
      where: {
        caseId: id,
        deletedAt: null,
        status: 'approved',
      },
    });

    if (approvedPlanCount === 0) {
      throw new ConflictException(
        errorBody('NO_APPROVED_PLAN', 'Decision case requires an approved plan'),
      );
    }

    const updatedDecisionCase = await this.prisma.decisionCase.update({
      where: {
        id: decisionCase.id,
      },
      data: {
        stage: this.maxStage(decisionCase.stage, 'report'),
        status: 'resolved',
      },
    });

    return this.toResponse(updatedDecisionCase);
  }

  private async findScopedCase(id: string): Promise<DecisionCaseRecord> {
    const tenantId = this.tenantContext.getTenantId();
    const decisionCase = await this.prisma.decisionCase.findFirst({
      where: {
        id,
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

    return decisionCase;
  }

  private maxStage(currentStage: string, nextStage: DecisionStage): DecisionStage {
    const currentIndex = DECISION_STAGES.indexOf(
      currentStage as DecisionStage,
    );
    const nextIndex = DECISION_STAGES.indexOf(nextStage);

    if (currentIndex === -1 || nextIndex >= currentIndex) {
      return nextStage;
    }

    return currentStage as DecisionStage;
  }

  private toResponse(decisionCase: DecisionCaseRecord): DecisionCaseResponseDto {
    return {
      id: decisionCase.id,
      problemId: decisionCase.problemId,
      title: decisionCase.title,
      stage: decisionCase.stage,
      status: decisionCase.status,
      createdAt: decisionCase.createdAt.toISOString(),
      updatedAt: decisionCase.updatedAt.toISOString(),
      deletedAt: decisionCase.deletedAt?.toISOString() ?? null,
    };
  }
}
