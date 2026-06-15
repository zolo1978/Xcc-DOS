import { Module } from '@nestjs/common';
import { AgentRunsModule } from '../agent-runs/agent-runs.module';
import { TenantModule } from '../../common/tenant/tenant.module';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';

@Module({
  imports: [TenantModule, AgentRunsModule],
  controllers: [GoalsController],
  providers: [GoalsService],
})
export class GoalsModule {}
