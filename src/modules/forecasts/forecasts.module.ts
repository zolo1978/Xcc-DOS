import { Module } from '@nestjs/common';
import { TenantModule } from '../../common/tenant/tenant.module';
import { ForecastsController } from './forecasts.controller';
import { ForecastsService } from './forecasts.service';

@Module({
  imports: [TenantModule],
  controllers: [ForecastsController],
  providers: [ForecastsService],
  exports: [ForecastsService],
})
export class ForecastsModule {}
