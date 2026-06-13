import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/tenant/jwt-auth.guard';
import { CreateForecastDto } from './dto/create-forecast.dto';
import { ListForecastsDto } from './dto/list-forecasts.dto';
import { ForecastsService } from './forecasts.service';

@Controller('decision-cases/:id')
@UseGuards(JwtAuthGuard)
export class ForecastsController {
  constructor(private readonly forecastsService: ForecastsService) {}

  @Post('forecast')
  async createForecast(@Param('id') id: string, @Body() dto: CreateForecastDto) {
    return this.forecastsService.create(id, dto);
  }

  @Get('forecasts')
  async listForecasts(@Param('id') id: string, @Query() query: ListForecastsDto) {
    return this.forecastsService.list(id, query);
  }
}
