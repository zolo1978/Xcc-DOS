import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import Decimal from 'decimal.js';
import {
  LLM_GATEWAY,
  LlmGatewayPort,
  LlmMessage,
  LlmUsage,
} from '../../common/llm/llm-gateway.port';
import { TenantContext } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../prisma/prisma.service';

const DECISION_STAGES = [
  'dismantle',
  'hypothesize',
  'evaluate',
  'calculate',
  'report',
] as const;

type DecisionStage = (typeof DECISION_STAGES)[number];

export enum AgentRiskLevel {
  L1 = 'L1',
  L2 = 'L2',
  L3 = 'L3',
  L4 = 'L4',
  L5 = 'L5',
}

type AgentRunStatus = 'succeeded' | 'failed' | 'pending_confirmation';

type AgentExecutionResult<T> = {
  agentRunId: string;
  status: AgentRunStatus;
  riskLevel: AgentRiskLevel;
  model?: string;
  usage?: LlmUsage;
  result?: T;
  error?: string;
};

type GoalRecord = {
  id: string;
  title: string;
  metric: string | null;
  targetValue: { toString(): string } | number | null;
  currentValue: { toString(): string } | number | null;
  startDate: Date;
  deadline: Date;
  status: string;
  version: number;
};

type ProblemRecord = {
  id: string;
  goalId: string | null;
  title: string;
  description: string | null;
};

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
  content: string;
  evidenceScore: { toString(): string } | number | null;
  confidence: { toString(): string } | number | null;
  counterExample: string | null;
  status: string;
};

type ForecastRecord = {
  id: string;
  caseId: string;
  version: number;
  scenarios: Prisma.JsonValue;
  confidence: { toString(): string } | number | null;
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

type EvaluationInput = {
  resourceScore?: number;
  timeScore?: number;
  riskScore?: number;
  feasibilityScore?: number;
  comment?: string;
};

@Injectable()
export class AgentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
    @Inject(LLM_GATEWAY) private readonly llmGateway: LlmGatewayPort,
  ) {}

  async runBreakdown(
    goalId: string,
    riskLevel = AgentRiskLevel.L2,
  ): Promise<
    AgentExecutionResult<{
      summary: string;
      dimensions: string[];
      constraints: string[];
    }>
  > {
    const goal = await this.findScopedGoal(goalId);

    return this.executeRun({
      agentType: 'breakdown',
      riskLevel,
      input: {
        goalId,
        riskLevel,
        goal: {
          title: goal.title,
          metric: goal.metric,
          targetValue: this.toNumber(goal.targetValue),
          currentValue: this.toNumber(goal.currentValue),
          startDate: goal.startDate.toISOString().slice(0, 10),
          deadline: goal.deadline.toISOString().slice(0, 10),
          status: goal.status,
          version: goal.version,
        },
      },
      messages: [
        {
          role: 'system',
          content:
            'You are an enterprise decision agent. Return JSON with summary, dimensions, constraints.',
        },
        {
          role: 'user',
          content: [
            `Goal ID: ${goal.id}`,
            `Title: ${goal.title}`,
            `Metric: ${goal.metric ?? 'n/a'}`,
            `Target: ${this.toNumber(goal.targetValue) ?? 'n/a'}`,
            `Current: ${this.toNumber(goal.currentValue) ?? 'n/a'}`,
          ].join('\n'),
        },
      ],
      metadata: {
        operation: 'breakdown',
      },
      onSuccess: async (payload) => ({
        summary: String(payload.summary || goal.title),
        dimensions: this.toStringArray(payload.dimensions),
        constraints: this.toStringArray(payload.constraints),
      }),
    });
  }

  async runDecompose(
    problemId: string,
    riskLevel = AgentRiskLevel.L2,
  ): Promise<
    AgentExecutionResult<{
      problemId: string;
      summary: string;
      factors: string[];
      assumptions: string[];
      generatedBy: string;
      agentRunId: string;
    }>
  > {
    const problem = await this.findScopedProblem(problemId);

    return this.executeRun({
      agentType: 'decompose',
      riskLevel,
      input: {
        problemId,
        riskLevel,
        problem: {
          title: problem.title,
          description: problem.description,
          goalId: problem.goalId,
        },
      },
      messages: [
        {
          role: 'system',
          content:
            'You are an enterprise decision agent. Return JSON with summary, factors, assumptions.',
        },
        {
          role: 'user',
          content: [
            `Problem ID: ${problem.id}`,
            `Title: ${problem.title}`,
            `Description: ${problem.description ?? 'n/a'}`,
          ].join('\n'),
        },
      ],
      metadata: {
        operation: 'decompose',
      },
      onSuccess: async (payload, runId, model) => ({
        problemId,
        summary: String(payload.summary || problem.title),
        factors: this.toStringArray(payload.factors),
        assumptions: this.toStringArray(payload.assumptions),
        generatedBy: `agent:${model}`,
        agentRunId: runId,
      }),
    });
  }

  async runForecast(
    caseId: string,
    hypothesisIds: string[],
    riskLevel = AgentRiskLevel.L3,
  ): Promise<AgentExecutionResult<ReturnType<AgentService['toForecastResponse']>>> {
    const decisionCase = await this.findScopedCase(caseId);
    const hypotheses = await this.findScopedHypotheses(caseId, hypothesisIds);

    return this.executeRun({
      agentType: 'forecast',
      riskLevel,
      input: {
        caseId,
        riskLevel,
        hypothesisIds: hypotheses.map((hypothesis) => hypothesis.id),
      },
      messages: [
        {
          role: 'system',
          content:
            'You are an enterprise forecasting agent. Return JSON with scenarios and confidence.',
        },
        {
          role: 'user',
          content: [
            `Decision Case ID: ${decisionCase.id}`,
            `Title: ${decisionCase.title}`,
            'Hypotheses:',
            hypotheses
              .map((hypothesis) => `- ${hypothesis.id}: ${hypothesis.content}`)
              .join('\n'),
          ].join('\n'),
        },
      ],
      metadata: {
        operation: 'forecast',
      },
      onSuccess: async (payload, runId, model) => {
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
            scenarios: this.toScenarioArray(payload.scenarios) as Prisma.InputJsonArray,
            confidence: this.toDecimal(this.toNumber(payload.confidence)),
            modelSource: `agent:${model}`,
            agentRunId: runId,
            inputHypothesisIds: hypotheses.map((hypothesis) => hypothesis.id),
            revisedBy: this.tenantContext.getUserId(),
          },
        });

        await this.prisma.decisionCase.update({
          where: { id: caseId },
          data: {
            stage: this.maxStage(decisionCase.stage, 'evaluate'),
          },
        });

        return this.toForecastResponse(created as ForecastRecord);
      },
    });
  }

  async runEvaluate(
    caseId: string,
    manualInput: EvaluationInput = {},
    riskLevel = AgentRiskLevel.L2,
  ): Promise<AgentExecutionResult<ReturnType<AgentService['toEvaluationResponse']>>> {
    const decisionCase = await this.findScopedCase(caseId);

    return this.executeRun({
      agentType: 'evaluate',
      riskLevel,
      input: {
        caseId,
        riskLevel,
        manualInput,
      },
      messages: [
        {
          role: 'system',
          content:
            'You are an enterprise evaluation agent. Return JSON with resourceScore, timeScore, riskScore, feasibilityScore, comment.',
        },
        {
          role: 'user',
          content: [
            `Decision Case ID: ${decisionCase.id}`,
            `Title: ${decisionCase.title}`,
            `Manual Input: ${JSON.stringify(manualInput)}`,
          ].join('\n'),
        },
      ],
      metadata: {
        operation: 'evaluate',
        manualInput,
      },
      onSuccess: async (payload) => {
        const evaluation = await this.prisma.evaluation.create({
          data: {
            caseId,
            resourceScore: this.toDecimal(this.toNumber(payload.resourceScore)),
            timeScore: this.toDecimal(this.toNumber(payload.timeScore)),
            riskScore: this.toDecimal(this.toNumber(payload.riskScore)),
            feasibilityScore: this.toDecimal(this.toNumber(payload.feasibilityScore)),
            comment: this.toNullableString(payload.comment),
          },
        });

        await this.prisma.decisionCase.update({
          where: { id: caseId },
          data: {
            stage: this.maxStage(decisionCase.stage, 'evaluate'),
          },
        });

        return this.toEvaluationResponse(evaluation as EvaluationRecord);
      },
    });
  }

  private async executeRun<T>(params: {
    agentType: string;
    riskLevel: AgentRiskLevel;
    input: Record<string, unknown>;
    messages: LlmMessage[];
    metadata: Record<string, unknown>;
    onSuccess: (
      payload: Record<string, unknown>,
      runId: string,
      model: string,
      usage: LlmUsage,
    ) => Promise<T>;
  }): Promise<AgentExecutionResult<T>> {
    const run = await this.prisma.agentRun.create({
      data: {
        agentType: params.agentType,
        triggerType: 'manual',
        status:
          params.riskLevel === AgentRiskLevel.L5
            ? 'pending_confirmation'
            : 'running',
        input: params.input as Prisma.InputJsonObject,
        toolCalls: [] as Prisma.InputJsonArray,
      },
    });

    if (params.riskLevel === AgentRiskLevel.L5) {
      await this.prisma.agentRun.update({
        where: { id: run.id },
        data: {
          output: {
            riskLevel: params.riskLevel,
            requiresHumanConfirmation: true,
          } as Prisma.InputJsonObject,
        },
      });

      return {
        agentRunId: run.id,
        status: 'pending_confirmation',
        riskLevel: params.riskLevel,
      };
    }

    try {
      const llmResult = await this.llmGateway.chat(params.messages, {
        metadata: params.metadata,
      });
      const parsed = this.parseStructuredContent(llmResult.content);
      const result = await params.onSuccess(
        parsed,
        run.id,
        llmResult.model,
        llmResult.usage,
      );

      await this.prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: 'succeeded',
          output: {
            riskLevel: params.riskLevel,
            model: llmResult.model,
            usage: llmResult.usage,
            ...(typeof result === 'object' && result !== null
              ? (result as Record<string, unknown>)
              : { result }),
            ...(typeof result === 'object' && result !== null && 'id' in (result as object)
              ? { forecastId: (result as { id?: string }).id }
              : {}),
          } as Prisma.InputJsonObject,
        },
      });

      return {
        agentRunId: run.id,
        status: 'succeeded',
        riskLevel: params.riskLevel,
        model: llmResult.model,
        usage: llmResult.usage,
        result,
      };
    } catch (error) {
      const message = this.toErrorMessage(error);

      await this.prisma.agentRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          output: {
            riskLevel: params.riskLevel,
            error: message,
          } as Prisma.InputJsonObject,
        },
      });

      return {
        agentRunId: run.id,
        status: 'failed',
        riskLevel: params.riskLevel,
        error: message,
      };
    }
  }

  private parseStructuredContent(content: string): Record<string, unknown> {
    const parsed = JSON.parse(content) as unknown;

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('LLM_GATEWAY_INVALID_JSON');
    }

    return parsed as Record<string, unknown>;
  }

  private async findScopedGoal(id: string): Promise<GoalRecord> {
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

    return goal as GoalRecord;
  }

  private async findScopedProblem(id: string): Promise<ProblemRecord> {
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

    return problem as ProblemRecord;
  }

  private async findScopedCase(id: string): Promise<DecisionCaseRecord> {
    const decisionCase = await this.prisma.decisionCase.findFirst({
      where: {
        id,
        deletedAt: null,
        problem: {
          is: {
            deletedAt: null,
            goal: {
              is: {
                orgId: this.tenantContext.getTenantId(),
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

    return decisionCase as DecisionCaseRecord;
  }

  private async findScopedHypotheses(caseId: string, hypothesisIds: string[]) {
    const hypotheses = await this.prisma.hypothesis.findMany({
      where: {
        caseId,
        deletedAt: null,
        ...(hypothesisIds.length > 0 ? { id: { in: hypothesisIds } } : {}),
        decisionCase: {
          is: {
            deletedAt: null,
            problem: {
              is: {
                deletedAt: null,
                goal: {
                  is: {
                    orgId: this.tenantContext.getTenantId(),
                    deletedAt: null,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    if (hypothesisIds.length > 0 && hypotheses.length !== hypothesisIds.length) {
      throw new NotFoundException('HYPOTHESIS_NOT_FOUND');
    }

    return hypotheses as HypothesisRecord[];
  }

  private maxStage(currentStage: string, nextStage: DecisionStage): DecisionStage {
    const currentIndex = DECISION_STAGES.indexOf(currentStage as DecisionStage);
    const nextIndex = DECISION_STAGES.indexOf(nextStage);

    if (currentIndex === -1 || nextIndex >= currentIndex) {
      return nextStage;
    }

    return currentStage as DecisionStage;
  }

  private toStringArray(value: unknown) {
    return Array.isArray(value)
      ? value.map((item) => String(item)).filter((item) => item.length > 0)
      : [];
  }

  private toScenarioArray(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.map((scenario) => {
      const item =
        scenario && typeof scenario === 'object'
          ? (scenario as Record<string, unknown>)
          : {};

      return {
        name: String(item.name || 'scenario'),
        probability: this.toNumber(item.probability),
        outcome: this.toNullableString(item.outcome),
        impact: this.toNullableString(item.impact),
        assumptions: this.toNullableString(item.assumptions),
      };
    });
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }

    if (value && typeof value === 'object' && 'toString' in value) {
      const converted = Number((value as { toString(): string }).toString());
      return Number.isFinite(converted) ? converted : null;
    }

    if (typeof value === 'string' && value.trim().length > 0) {
      const converted = Number(value);
      return Number.isFinite(converted) ? converted : null;
    }

    return null;
  }

  private toDecimal(value: number | null) {
    return typeof value === 'number' ? new Decimal(value) : null;
  }

  private toNullableString(value: unknown) {
    return typeof value === 'string' && value.trim().length > 0 ? value : null;
  }

  private toErrorMessage(error: unknown) {
    return error instanceof Error ? error.message : 'AGENT_RUN_FAILED';
  }

  private toForecastResponse(forecast: ForecastRecord) {
    return {
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
    };
  }

  private toEvaluationResponse(evaluation: EvaluationRecord) {
    return {
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
    };
  }
}
