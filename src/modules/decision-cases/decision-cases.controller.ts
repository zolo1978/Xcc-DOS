import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/tenant/jwt-auth.guard';
import { AgentService } from '../agent-runs/agent.service';
import { CreateDecisionCaseDto } from './dto/create-decision-case.dto';
import { ListDecisionCasesDto } from './dto/list-decision-cases.dto';
import { DecisionCasesService } from './decision-cases.service';

@Controller('decision-cases')
@UseGuards(JwtAuthGuard)
export class DecisionCasesController {
  constructor(
    private readonly decisionCasesService: DecisionCasesService,
    private readonly agentService: AgentService,
  ) {}

  @Post()
  async createDecisionCase(@Body() dto: CreateDecisionCaseDto) {
    return this.decisionCasesService.create(dto);
  }

  @Get()
  async listDecisionCases(@Query() query: ListDecisionCasesDto) {
    return this.decisionCasesService.findAll(query);
  }

  @Get(':id')
  async getDecisionCase(@Param('id') id: string) {
    return this.decisionCasesService.findOne(id);
  }

  @Post(':id/report')
  @HttpCode(200)
  async generateReport(@Param('id') id: string) {
    return this.decisionCasesService.generateReport(id);
  }

  @Post(':id/evaluate')
  async evaluateCase(
    @Param('id') id: string,
    @Body() dto: {
      resourceScore?: number;
      timeScore?: number;
      riskScore?: number;
      feasibilityScore?: number;
      comment?: string;
    },
  ) {
    const result = await this.agentService.runEvaluate(id, dto);
    return result.status === 'succeeded' ? result.result : result;
  }

  @Post(':id/simulate-roi')
  @HttpCode(200)
  async simulateRoi(
    @Param('id') id: string,
    @Body() dto: {
      cost: number;
      revenue: number;
      paybackDays?: number;
      assumptions?: Record<string, unknown>;
    },
  ) {
    return this.decisionCasesService.simulateRoi(id, dto);
  }
}
