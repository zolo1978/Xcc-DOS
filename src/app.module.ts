import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { TenantModule } from './common/tenant/tenant.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { DecisionCasesModule } from './modules/decision-cases/decision-cases.module';
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
    HealthModule,
    AuthModule,
    GoalsModule,
    DecisionCasesModule,
    PlansModule,
    TasksModule,
  ],
})
export class AppModule {}
