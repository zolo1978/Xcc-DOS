import { Module } from '@nestjs/common';
import { TenantModule } from '../../common/tenant/tenant.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  imports: [TenantModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
