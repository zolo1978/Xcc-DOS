import { Body, Controller, Get, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/tenant/jwt-auth.guard';
import { CreatePlanDto } from './dto/create-plan.dto';
import { RejectPlanDto } from './dto/reject-plan.dto';
import { PlansService } from './plans.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Post('decision-cases/:id/plans')
  async createPlan(@Param('id') id: string, @Body() dto: CreatePlanDto) {
    return this.plansService.create(id, dto);
  }

  @Get('plans/:id')
  async getPlan(@Param('id') id: string) {
    return this.plansService.findOne(id);
  }

  @Post('plans/:id/submit')
  @HttpCode(200)
  async submitPlan(@Param('id') id: string) {
    return this.plansService.submit(id);
  }

  @Post('plans/:id/approve')
  @HttpCode(200)
  async approvePlan(@Param('id') id: string) {
    return this.plansService.approve(id);
  }

  @Post('plans/:id/reject')
  @HttpCode(200)
  async rejectPlan(@Param('id') id: string, @Body() dto: RejectPlanDto) {
    return this.plansService.reject(id, dto);
  }
}
