import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/tenant/jwt-auth.guard';
import { AgentService } from '../agent-runs/agent.service';
import { ListForecastsDto } from './dto/list-forecasts.dto';
import { RunForecastDto } from './dto/run-forecast.dto';
import { ForecastsService } from './forecasts.service';

@Controller('decision-cases/:id')
@UseGuards(JwtAuthGuard)
export class ForecastsController {
  constructor(
    private readonly forecastsService: ForecastsService,
    private readonly agentService: AgentService,
  ) {}

  @Post('forecast')
  async createForecast(@Param('id') id: string, @Body() dto: RunForecastDto) {
    const result = await this.agentService.runForecast(id, dto.hypothesisIds ?? []);
    return result.status === 'succeeded' ? result.result : result;
  }

  @Get('forecasts')
  async listForecasts(@Param('id') id: string, @Query() query: ListForecastsDto) {
    return this.forecastsService.list(id, query);
  }
}
