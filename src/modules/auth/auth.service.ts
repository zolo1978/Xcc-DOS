import { UnauthorizedException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { randomUUID } from 'node:crypto';
import { errorBody } from '../../common/http/api-error';
import { AuthTokenStoreService, SessionRecord } from '../../common/tenant/auth-token-store.service';
import { JwtPayload } from '../../common/tenant/jwt-payload';
import { PrismaService } from '../../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

type AuthUserRecord = {
  id: string;
  orgId: string;
  passwordHash: string;
  status: string;
  deletedAt: Date | null;
  role: { name: string } | null;
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly authTokenStore: AuthTokenStoreService,
  ) {}

  async login(dto: LoginDto, userAgent?: string) {
    const user = await this.findUserByEmail(dto.email);
    if (!user) {
      throw this.invalidCredentials();
    }

    const isValidPassword = await argon2.verify(user.passwordHash, dto.password);
    if (!isValidPassword) {
      throw this.invalidCredentials();
    }

    return this.issueTokenPair(user, userAgent);
  }

  async refresh(dto: RefreshTokenDto) {
    let payload: JwtPayload;

    try {
      payload = await this.jwtService.verifyAsync<JwtPayload>(dto.refreshToken);
    } catch {
      throw this.invalidCredentials();
    }

    if (payload.tokenType !== 'refresh') {
      throw this.invalidCredentials();
    }

    if (await this.authTokenStore.isTokenBlacklisted(payload.jti)) {
      throw this.invalidCredentials();
    }

    if (!payload.sub) {
      throw this.invalidCredentials();
    }

    const user = await this.findUserById(payload.sub);
    if (!user) {
      throw this.invalidCredentials();
    }

    return {
      accessToken: await this.signAccessToken(user),
    };
  }

  async logout(payload: JwtPayload): Promise<void> {
    await this.authTokenStore.blacklistAccessToken(payload);
  }

  async listSessions(userId: string): Promise<SessionRecord[]> {
    return this.authTokenStore.listSessions(userId);
  }

  async revokeSession(userId: string, jti: string): Promise<void> {
    await this.authTokenStore.blacklistRefreshToken(userId, jti);
  }

  private async findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        email,
        deletedAt: null,
      },
      include: {
        role: true,
      },
    });

    if (!user || user.status !== 'active') {
      return null;
    }

    return user;
  }

  private async findUserById(id: string): Promise<AuthUserRecord | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        id,
        deletedAt: null,
      },
      include: {
        role: true,
      },
    });

    if (!user || user.status !== 'active') {
      return null;
    }

    return user;
  }

  private async issueTokenPair(user: AuthUserRecord, userAgent?: string) {
    const accessToken = await this.signAccessToken(user);
    const refreshTokenPayload = this.toPayload(user, 'refresh');
    const refreshToken = await this.signToken(
      refreshTokenPayload,
      process.env.JWT_REFRESH_TTL || '7d',
    );

    await this.authTokenStore.storeSession(
      user.id,
      {
        jti: refreshTokenPayload.jti!,
        issuedAt: new Date().toISOString(),
        userAgent: userAgent ?? null,
      },
      this.parseDurationToSeconds(process.env.JWT_REFRESH_TTL || '7d'),
    );

    return {
      accessToken,
      refreshToken,
    };
  }

  private async signAccessToken(user: AuthUserRecord): Promise<string> {
    return this.signToken(
      this.toPayload(user, 'access'),
      process.env.JWT_ACCESS_TTL || '15m',
    );
  }

  private toPayload(
    user: AuthUserRecord,
    tokenType: JwtPayload['tokenType'],
  ): JwtPayload {
    return {
      jti: randomUUID(),
      sub: user.id,
      tenant: user.orgId,
      role: user.role?.name ?? 'unknown',
      tokenType,
    };
  }

  private parseDurationToSeconds(value: string): number {
    if (/^\d+$/.test(value)) {
      return Number(value);
    }

    const match = value.match(/^(\d+)([smhd])$/);
    if (!match) {
      throw new Error(`Unsupported JWT duration: ${value}`);
    }

    const [, amountRaw, unit] = match;
    const amount = Number(amountRaw);
    const unitMultiplier: Record<string, number> = {
      s: 1,
      m: 60,
      h: 60 * 60,
      d: 60 * 60 * 24,
    };

    return amount * unitMultiplier[unit];
  }

  private async signToken(payload: JwtPayload, expiresIn: string): Promise<string> {
    return this.jwtService.signAsync(payload, {
      expiresIn,
    });
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException(
      errorBody('INVALID_CREDENTIALS', 'Invalid email or password'),
    );
  }
}
