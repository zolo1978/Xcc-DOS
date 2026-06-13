import { UnauthorizedException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { errorBody } from '../../common/http/api-error';
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

type JwtPayload = {
  sub: string;
  tenant: string;
  role: string;
  tokenType: 'access' | 'refresh';
};

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async login(dto: LoginDto) {
    const user = await this.findUserByEmail(dto.email);
    if (!user) {
      throw this.invalidCredentials();
    }

    const isValidPassword = await argon2.verify(user.passwordHash, dto.password);
    if (!isValidPassword) {
      throw this.invalidCredentials();
    }

    return this.issueTokenPair(user);
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

    const user = await this.findUserById(payload.sub);
    if (!user) {
      throw this.invalidCredentials();
    }

    return {
      accessToken: await this.signAccessToken(user),
    };
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

  private async issueTokenPair(user: AuthUserRecord) {
    return {
      accessToken: await this.signAccessToken(user),
      refreshToken: await this.signRefreshToken(user),
    };
  }

  private async signAccessToken(user: AuthUserRecord): Promise<string> {
    return this.jwtService.signAsync(this.toPayload(user, 'access'), {
      expiresIn: process.env.JWT_ACCESS_TTL || '15m',
    });
  }

  private async signRefreshToken(user: AuthUserRecord): Promise<string> {
    return this.jwtService.signAsync(this.toPayload(user, 'refresh'), {
      expiresIn: process.env.JWT_REFRESH_TTL || '7d',
    });
  }

  private toPayload(
    user: AuthUserRecord,
    tokenType: JwtPayload['tokenType'],
  ): JwtPayload {
    return {
      sub: user.id,
      tenant: user.orgId,
      role: user.role?.name ?? 'unknown',
      tokenType,
    };
  }

  private invalidCredentials(): UnauthorizedException {
    return new UnauthorizedException(
      errorBody('INVALID_CREDENTIALS', 'Invalid email or password'),
    );
  }
}
