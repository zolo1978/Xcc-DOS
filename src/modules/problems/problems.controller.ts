import { Body, Controller, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/tenant/jwt-auth.guard';
import { AgentService } from '../agent-runs/agent.service';
import { CreateProblemDto } from './dto/create-problem.dto';
import { ProblemsService } from './problems.service';

@Controller('problems')
@UseGuards(JwtAuthGuard)
export class ProblemsController {
  constructor(
    private readonly problemsService: ProblemsService,
    private readonly agentService: AgentService,
  ) {}

  @Post()
  async createProblem(@Body() dto: CreateProblemDto) {
    return this.problemsService.create(dto);
  }

  @Post(':id/decompose')
  @HttpCode(200)
  async decomposeProblem(@Param('id') id: string) {
    const result = await this.agentService.runDecompose(id);
    return result.status === 'succeeded' ? result.result : result;
  }
}
