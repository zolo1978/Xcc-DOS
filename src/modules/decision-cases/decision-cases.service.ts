import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
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

type HypothesisRecord = {
  id: string;
  caseId: string;
  content: string;
  evidenceScore: Decimal | { toString(): string } | number | null;
  confidence: Decimal | { toString(): string } | number | null;
  counterExample: string | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type ForecastRecord = {
  id: string;
  caseId: string;
  version: number;
  scenarios: Prisma.JsonValue;
  confidence: Decimal | { toString(): string } | number | null;
  modelSource: string;
  agentRunId: string | null;
  inputHypothesisIds: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type EvaluationRecord = {
  id: string;
  caseId: string;
  resourceScore: Decimal | { toString(): string } | number | null;
  timeScore: Decimal | { toString(): string } | number | null;
  riskScore: Decimal | { toString(): string } | number | null;
  feasibilityScore: Decimal | { toString(): string } | number | null;
  comment: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type RoiSimulationRecord = {
  id: string;
  caseId: string;
  cost: Decimal | { toString(): string } | number;
  revenue: Decimal | { toString(): string } | number;
  roi: Decimal | { toString(): string } | number | null;
  paybackDays: number | null;
  assumptions: Prisma.JsonValue | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

export type DecisionCaseReportResponseDto = {
  case: DecisionCaseResponseDto;
  hypotheses: Array<{
    id: string;
    caseId: string;
    content: string;
    evidenceScore: number | null;
    confidence: number | null;
    counterExample: string | null;
    status: string;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
  }>;
  forecast: {
    id: string;
    caseId: string;
    version: number;
    scenarios: Prisma.JsonValue;
    confidence: number | null;
    modelSource: string;
    agentRunId: string | null;
    inputHypothesisIds: string[];
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
  } | null;
  evaluations: Array<{
    id: string;
    caseId: string;
    resourceScore: number | null;
    timeScore: number | null;
    riskScore: number | null;
    feasibilityScore: number | null;
    comment: string | null;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
  }>;
  roiSimulations: Array<{
    id: string;
    caseId: string;
    cost: number;
    revenue: number;
    roi: number | null;
    paybackDays: number | null;
    assumptions: Prisma.JsonValue | null;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
  }>;
  resolved: boolean;
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

  async generateReport(id: string): Promise<DecisionCaseReportResponseDto> {
    const decisionCase = await this.findScopedCase(id);
    const stagedDecisionCase = await this.prisma.decisionCase.update({
      where: {
        id: decisionCase.id,
      },
      data: {
        stage: this.maxStage(decisionCase.stage, 'report'),
      },
    });

    const approvedPlanCount = await this.prisma.plan.count({
      where: {
        caseId: id,
        deletedAt: null,
        status: 'approved',
      },
    });

    if (approvedPlanCount === 0) {
      throw new ConflictException({
        ...errorBody(
          'NO_APPROVED_PLAN',
          'Decision case requires an approved plan',
        ),
        report: await this.buildReport(stagedDecisionCase, false),
      });
    }

    const resolvedDecisionCase = await this.prisma.decisionCase.update({
      where: {
        id: decisionCase.id,
      },
      data: {
        status: 'resolved',
      },
    });

    return this.buildReport(resolvedDecisionCase, true);
  }

  async evaluate(id: string, dto: {
    resourceScore?: number;
    timeScore?: number;
    riskScore?: number;
    feasibilityScore?: number;
    comment?: string;
  }) {
    const decisionCase = await this.findScopedCase(id);
    const evaluation = await this.prisma.evaluation.create({
      data: {
        caseId: decisionCase.id,
        resourceScore: this.toDecimal(dto.resourceScore),
        timeScore: this.toDecimal(dto.timeScore),
        riskScore: this.toDecimal(dto.riskScore),
        feasibilityScore: this.toDecimal(dto.feasibilityScore),
        comment: dto.comment ?? null,
      },
    });

    await this.prisma.decisionCase.update({
      where: { id: decisionCase.id },
      data: {
        stage: this.maxStage(decisionCase.stage, 'evaluate'),
      },
    });

    return evaluation;
  }

  async simulateRoi(id: string, dto: {
    cost: number;
    revenue: number;
    paybackDays?: number;
    assumptions?: Record<string, unknown>;
  }) {
    const decisionCase = await this.findScopedCase(id);
    const roi = dto.cost === 0 ? null : (dto.revenue - dto.cost) / dto.cost;
    const simulation = await this.prisma.roiSimulation.create({
      data: {
        caseId: decisionCase.id,
        cost: new Decimal(dto.cost),
        revenue: new Decimal(dto.revenue),
        roi: roi === null ? null : new Decimal(roi),
        paybackDays: dto.paybackDays ?? null,
        assumptions:
          dto.assumptions === undefined
            ? Prisma.JsonNull
            : (dto.assumptions as Prisma.InputJsonObject),
      },
    });

    await this.prisma.decisionCase.update({
      where: { id: decisionCase.id },
      data: {
        stage: this.maxStage(decisionCase.stage, 'calculate'),
      },
    });

    return {
      ...simulation,
      roi: simulation.roi === null ? null : Number(simulation.roi.toString()),
      cost: Number(simulation.cost.toString()),
      revenue: Number(simulation.revenue.toString()),
    };
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

  private toDecimal(value?: number): Decimal | null {
    return typeof value === 'number' ? new Decimal(value) : null;
  }

  private async buildReport(
    decisionCase: DecisionCaseRecord,
    resolved: boolean,
  ): Promise<DecisionCaseReportResponseDto> {
    const [hypotheses, forecast, evaluations, roiSimulations] = await Promise.all([
      this.prisma.hypothesis.findMany({
        where: {
          caseId: decisionCase.id,
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'asc',
        },
      }) as Promise<HypothesisRecord[]>,
      this.prisma.forecast.findFirst({
        where: {
          caseId: decisionCase.id,
          deletedAt: null,
        },
        orderBy: {
          version: 'desc',
        },
      }) as Promise<ForecastRecord | null>,
      this.prisma.evaluation.findMany({
        where: {
          caseId: decisionCase.id,
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'asc',
        },
      }) as Promise<EvaluationRecord[]>,
      this.prisma.roiSimulation.findMany({
        where: {
          caseId: decisionCase.id,
          deletedAt: null,
        },
        orderBy: {
          createdAt: 'asc',
        },
      }) as Promise<RoiSimulationRecord[]>,
    ]);

    return {
      case: this.toResponse(decisionCase),
      hypotheses: hypotheses.map((hypothesis) => ({
        id: hypothesis.id,
        caseId: hypothesis.caseId,
        content: hypothesis.content,
        evidenceScore: this.toNumber(hypothesis.evidenceScore),
        confidence: this.toNumber(hypothesis.confidence),
        counterExample: hypothesis.counterExample,
        status: hypothesis.status,
        createdAt: hypothesis.createdAt.toISOString(),
        updatedAt: hypothesis.updatedAt.toISOString(),
        deletedAt: hypothesis.deletedAt?.toISOString() ?? null,
      })),
      forecast: forecast
        ? {
            id: forecast.id,
            caseId: forecast.caseId,
            version: forecast.version,
            scenarios: Array.isArray(forecast.scenarios) ? forecast.scenarios : [],
            confidence: this.toNumber(forecast.confidence),
            modelSource: forecast.modelSource,
            agentRunId: forecast.agentRunId,
            inputHypothesisIds: forecast.inputHypothesisIds,
            createdAt: forecast.createdAt.toISOString(),
            updatedAt: forecast.updatedAt.toISOString(),
            deletedAt: forecast.deletedAt?.toISOString() ?? null,
          }
        : null,
      evaluations: evaluations.map((evaluation) => ({
        id: evaluation.id,
        caseId: evaluation.caseId,
        resourceScore: this.toNumber(evaluation.resourceScore),
        timeScore: this.toNumber(evaluation.timeScore),
        riskScore: this.toNumber(evaluation.riskScore),
        feasibilityScore: this.toNumber(evaluation.feasibilityScore),
        comment: evaluation.comment,
        createdAt: evaluation.createdAt.toISOString(),
        updatedAt: evaluation.updatedAt.toISOString(),
        deletedAt: evaluation.deletedAt?.toISOString() ?? null,
      })),
      roiSimulations: roiSimulations.map((simulation) => ({
        id: simulation.id,
        caseId: simulation.caseId,
        cost: this.toNumber(simulation.cost) ?? 0,
        revenue: this.toNumber(simulation.revenue) ?? 0,
        roi: this.toNumber(simulation.roi),
        paybackDays: simulation.paybackDays,
        assumptions: simulation.assumptions,
        createdAt: simulation.createdAt.toISOString(),
        updatedAt: simulation.updatedAt.toISOString(),
        deletedAt: simulation.deletedAt?.toISOString() ?? null,
      })),
      resolved,
    };
  }

  private toNumber(
    value: Decimal | { toString(): string } | number | null | undefined,
  ): number | null {
    if (value === null || value === undefined) {
      return null;
    }

    return Number(typeof value === 'number' ? value : value.toString());
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
