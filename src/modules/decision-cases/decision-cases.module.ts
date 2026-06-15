import { Module } from '@nestjs/common';
import { TenantModule } from '../../common/tenant/tenant.module';
import { DecisionCasesController } from './decision-cases.controller';
import { DecisionCasesService } from './decision-cases.service';

@Module({
  imports: [TenantModule],
  controllers: [DecisionCasesController],
  providers: [DecisionCasesService],
  exports: [DecisionCasesService],
})
export class DecisionCasesModule {}
