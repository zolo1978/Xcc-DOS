import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ClsModule } from 'nestjs-cls';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { GoalsModule } from './modules/goals/goals.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ClsModule.forRoot({
      global: true,
      middleware: { mount: true },
    }),
    PrismaModule,
    HealthModule,
    GoalsModule,
  ],
})
export class AppModule {}
