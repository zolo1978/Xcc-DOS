import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { TenantModule } from './common/tenant/tenant.module';
import { OutboxModule } from './common/outbox/outbox.module';
import { HealthModule } from './health/health.module';
import { AgentRunsModule } from './modules/agent-runs/agent-runs.module';
import { AuthModule } from './modules/auth/auth.module';
import { DecisionCasesModule } from './modules/decision-cases/decision-cases.module';
import { FeedbacksModule } from './modules/feedbacks/feedbacks.module';
import { ForecastsModule } from './modules/forecasts/forecasts.module';
import { PrismaModule } from './prisma/prisma.module';
import { GoalsModule } from './modules/goals/goals.module';
import { PlansModule } from './modules/plans/plans.module';
import { TasksModule } from './modules/tasks/tasks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    TenantModule,
    PrismaModule,
    OutboxModule,
    HealthModule,
    AuthModule,
    GoalsModule,
    DecisionCasesModule,
    ForecastsModule,
    PlansModule,
    TasksModule,
    FeedbacksModule,
    AgentRunsModule,
  ],
})
export class AppModule {}
