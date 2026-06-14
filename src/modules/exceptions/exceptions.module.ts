import { Module } from '@nestjs/common';
import { TenantModule } from '../../common/tenant/tenant.module';
import { ExceptionsController } from './exceptions.controller';
import { ExceptionsService } from './exceptions.service';

@Module({
  imports: [TenantModule],
  controllers: [ExceptionsController],
  providers: [ExceptionsService],
})
export class ExceptionsModule {}
