import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/tenant/jwt-auth.guard';
import { JwtPayload } from '../../common/tenant/jwt-payload';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(200)
  // TODO: add request-level rate limiting for repeated failed logins.
  async login(@Body() dto: LoginDto, @Headers('user-agent') userAgent?: string) {
    return this.authService.login(dto, userAgent);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@Body() dto: RefreshTokenDto) {
    return this.authService.refresh(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async logout(
    @Req()
    request: {
      user: JwtPayload;
    },
  ) {
    await this.authService.logout(request.user);
  }

  @Get('sessions')
  @UseGuards(JwtAuthGuard)
  async listSessions(
    @Req()
    request: {
      user: JwtPayload;
    },
  ) {
    return this.authService.listSessions(request.user.sub!);
  }

  @Delete('sessions/:jti')
  @UseGuards(JwtAuthGuard)
  @HttpCode(204)
  async revokeSession(
    @Param('jti') jti: string,
    @Req()
    request: {
      user: JwtPayload;
    },
  ) {
    await this.authService.revokeSession(request.user.sub!, jti);
  }
}
