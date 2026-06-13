import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/tenant/jwt-auth.guard';
import { CreateDecisionCaseDto } from './dto/create-decision-case.dto';
import { ListDecisionCasesDto } from './dto/list-decision-cases.dto';
import { DecisionCasesService } from './decision-cases.service';

@Controller('decision-cases')
@UseGuards(JwtAuthGuard)
export class DecisionCasesController {
  constructor(private readonly decisionCasesService: DecisionCasesService) {}

  @Post()
  async createDecisionCase(@Body() dto: CreateDecisionCaseDto) {
    return this.decisionCasesService.create(dto);
  }

  @Get()
  async listDecisionCases(@Query() query: ListDecisionCasesDto) {
    return this.decisionCasesService.findAll(query);
  }

  @Get(':id')
  async getDecisionCase(@Param('id') id: string) {
    return this.decisionCasesService.findOne(id);
  }

  @Post(':id/report')
  @HttpCode(200)
  async generateReport(@Param('id') id: string) {
    return this.decisionCasesService.generateReport(id);
  }
}
