import { Body, Controller, Get, Headers, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/tenant/jwt-auth.guard';
import { ReviseFeedbackDto } from './dto/revise-feedback.dto';
import { SubmitFeedbackDto } from './dto/submit-feedback.dto';
import { FeedbacksService } from './feedbacks.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class FeedbacksController {
  constructor(private readonly feedbacksService: FeedbacksService) {}

  @Post('tasks/:id/feedback')
  async submitFeedback(
    @Param('id') id: string,
    @Body() dto: SubmitFeedbackDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.feedbacksService.submit(id, dto, idempotencyKey);
  }

  @Get('tasks/:id/feedback')
  async getTaskFeedback(@Param('id') id: string) {
    return this.feedbacksService.getTaskFeedback(id);
  }

  @Post('feedbacks/:id/revisions')
  @HttpCode(201)
  async reviseFeedback(@Param('id') id: string, @Body() dto: ReviseFeedbackDto) {
    return this.feedbacksService.revise(id, dto);
  }
}
