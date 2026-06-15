import { Module } from '@nestjs/common';
import { AgentRunsModule } from '../agent-runs/agent-runs.module';
import { TenantModule } from '../../common/tenant/tenant.module';
import { ProblemsController } from './problems.controller';
import { ProblemsService } from './problems.service';

@Module({
  imports: [TenantModule, AgentRunsModule],
  controllers: [ProblemsController],
  providers: [ProblemsService],
  exports: [ProblemsService],
})
export class ProblemsModule {}
