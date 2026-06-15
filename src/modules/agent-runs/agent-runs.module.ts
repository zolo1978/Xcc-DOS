import { Module } from '@nestjs/common';
import { LLM_GATEWAY } from '../../common/llm/llm-gateway.port';
import { MockLlmAdapter } from '../../common/llm/mock.adapter';
import { Sub2ApiAdapter } from '../../common/llm/sub2api.adapter';
import { TenantModule } from '../../common/tenant/tenant.module';
import { AgentRunsController } from './agent-runs.controller';
import { AgentService } from './agent.service';
import { AgentRunsService } from './agent-runs.service';

@Module({
  imports: [TenantModule],
  controllers: [AgentRunsController],
  providers: [
    AgentRunsService,
    AgentService,
    {
      provide: LLM_GATEWAY,
      useFactory: () =>
        process.env.LLM_GATEWAY_URL
          ? new Sub2ApiAdapter()
          : new MockLlmAdapter(),
    },
  ],
  exports: [AgentRunsService, AgentService],
})
export class AgentRunsModule {}
