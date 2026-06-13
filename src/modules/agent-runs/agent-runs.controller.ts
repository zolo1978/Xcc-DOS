import { Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/tenant/jwt-auth.guard';
import { AgentRunsService } from './agent-runs.service';

@Controller('agent-runs')
@UseGuards(JwtAuthGuard)
export class AgentRunsController {
  constructor(private readonly agentRunsService: AgentRunsService) {}

  @Get()
  async listAgentRuns() {
    return this.agentRunsService.list();
  }

  @Get(':id/trace')
  async getAgentRunTrace(@Param('id') id: string) {
    return this.agentRunsService.trace(id);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  async cancelAgentRun(@Param('id') id: string) {
    return this.agentRunsService.cancel(id);
  }
}
