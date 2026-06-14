import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/tenant/jwt-auth.guard';
import { ListExceptionsDto } from './dto/list-exceptions.dto';
import { UpdateExceptionStatusDto } from './dto/update-exception-status.dto';
import { ExceptionsService } from './exceptions.service';

@Controller('exceptions')
@UseGuards(JwtAuthGuard)
export class ExceptionsController {
  constructor(private readonly exceptionsService: ExceptionsService) {}

  @Get()
  async listExceptions(@Query() query: ListExceptionsDto) {
    return this.exceptionsService.list(query);
  }

  @Patch(':id/status')
  async updateExceptionStatus(
    @Param('id') id: string,
    @Body() dto: UpdateExceptionStatusDto,
  ) {
    return this.exceptionsService.updateStatus(id, dto);
  }
}
