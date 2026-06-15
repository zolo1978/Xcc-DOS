import { Module } from '@nestjs/common';
import { AgentRunsModule } from '../agent-runs/agent-runs.module';
import { TenantModule } from '../../common/tenant/tenant.module';
import { ForecastsController } from './forecasts.controller';
import { ForecastsService } from './forecasts.service';

@Module({
  imports: [TenantModule, AgentRunsModule],
  controllers: [ForecastsController],
  providers: [ForecastsService],
  exports: [ForecastsService],
})
export class ForecastsModule {}
