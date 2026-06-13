import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateForecastDto } from './dto/create-forecast.dto';
import { ListForecastsDto } from './dto/list-forecasts.dto';

type ForecastRecord = {
  id: string;
  caseId: string;
  version: number;
  scenarios: unknown[];
  confidence: { toString(): string } | number | null;
  modelSource: string;
  agentRunId: string | null;
  inputHypothesisIds: string[];
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

@Injectable()
export class ForecastsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async create(caseId: string, dto: CreateForecastDto) {
    await this.findScopedCase(caseId);
    const latest = await this.prisma.forecast.findFirst({
      where: {
        caseId,
        deletedAt: null,
      },
      orderBy: {
        version: 'desc',
      },
    });

    const created = await this.prisma.forecast.create({
      data: {
        caseId,
        version: (latest?.version ?? 0) + 1,
        scenarios: dto.scenarios,
        confidence: dto.confidence,
        modelSource: dto.modelSource,
        inputHypothesisIds: dto.inputHypothesisIds,
        agentRunId: dto.agentRunId ?? null,
        revisedBy: this.tenantContext.getUserId(),
      },
    });

    return this.toResponse(created);
  }

  async list(caseId: string, query: ListForecastsDto) {
    await this.findScopedCase(caseId);
    const forecasts = (await this.prisma.forecast.findMany({
      where: {
        caseId,
        deletedAt: null,
        ...(query.version ? { version: query.version } : {}),
      },
      orderBy: {
        version: 'desc',
      },
    })) as ForecastRecord[];

    return forecasts.map((forecast: ForecastRecord) => this.toResponse(forecast));
  }

  private async findScopedCase(id: string) {
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

  private toResponse(forecast: ForecastRecord) {
    return {
      id: forecast.id,
      caseId: forecast.caseId,
      version: forecast.version,
      scenarios: forecast.scenarios,
      confidence:
        forecast.confidence === null
          ? null
          : Number(
              typeof forecast.confidence === 'number'
                ? forecast.confidence
                : forecast.confidence.toString(),
            ),
      modelSource: forecast.modelSource,
      agentRunId: forecast.agentRunId,
      inputHypothesisIds: forecast.inputHypothesisIds,
      createdAt: forecast.createdAt.toISOString(),
      updatedAt: forecast.updatedAt.toISOString(),
      deletedAt: forecast.deletedAt?.toISOString() ?? null,
    };
  }
}
