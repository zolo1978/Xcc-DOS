import { Module } from '@nestjs/common';
import { TenantModule } from '../../common/tenant/tenant.module';
import { GoalsController } from './goals.controller';
import { GoalsService } from './goals.service';

@Module({
  imports: [TenantModule],
  controllers: [GoalsController],
  providers: [GoalsService],
})
export class GoalsModule {}
