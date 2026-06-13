import { Module } from '@nestjs/common';
import { TenantModule } from '../../common/tenant/tenant.module';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

@Module({
  imports: [TenantModule],
  controllers: [TasksController],
  providers: [TasksService],
})
export class TasksModule {}
