import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/tenant/jwt-auth.guard';
import { CreateGoalDto } from './dto/create-goal.dto';
import { ListGoalsDto } from './dto/list-goals.dto';
import { UpdateGoalStatusDto } from './dto/update-goal-status.dto';
import { GoalsService } from './goals.service';

@Controller('goals')
@UseGuards(JwtAuthGuard)
export class GoalsController {
  constructor(private readonly goalsService: GoalsService) {}

  @Post()
  async createGoal(@Body() dto: CreateGoalDto) {
    return this.goalsService.create(dto);
  }

  @Get()
  async listGoals(@Query() query: ListGoalsDto) {
    return this.goalsService.findAll(query);
  }

  @Get(':id')
  async getGoal(@Param('id') id: string) {
    return this.goalsService.findOne(id);
  }

  @Patch(':id/status')
  async updateGoalStatus(
    @Param('id') id: string,
    @Body() dto: UpdateGoalStatusDto,
    @Headers('if-match') ifMatchHeader?: string,
  ) {
    const ifMatchVersion = Number(ifMatchHeader);
    if (!Number.isInteger(ifMatchVersion)) {
      throw new BadRequestException('INVALID_IF_MATCH');
    }

    return this.goalsService.updateStatus(id, dto, ifMatchVersion);
  }

  @Delete(':id')
  @HttpCode(204)
  async deleteGoal(@Param('id') id: string) {
    await this.goalsService.softDelete(id);
  }
}
