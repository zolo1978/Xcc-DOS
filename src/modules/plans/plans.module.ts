import { Module } from '@nestjs/common';
import { TenantModule } from '../../common/tenant/tenant.module';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

@Module({
  imports: [TenantModule],
  controllers: [PlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
