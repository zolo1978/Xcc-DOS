import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

type JwtPayload = {
  sub?: string;
  tenant?: string;
  role?: string;
  tokenType?: string;
};

@Injectable()
export class TenantContext {
  constructor(private readonly cls: ClsService) {}

  getJwtPayload(): JwtPayload {
    const jwtPayload = this.cls.get<JwtPayload>('jwtPayload');
    if (!jwtPayload) {
      throw new UnauthorizedException('JWT_CONTEXT_MISSING');
    }

    return jwtPayload;
  }

  getTenantId(): string {
    const tenantId = this.cls.get<string>('tenantId') ?? this.getJwtPayload().tenant;
    if (!tenantId) {
      throw new UnauthorizedException('TENANT_CONTEXT_MISSING');
    }

    return tenantId;
  }

  getUserId(): string {
    const userId = this.getJwtPayload().sub;
    if (!userId) {
      throw new UnauthorizedException('USER_CONTEXT_MISSING');
    }

    return userId;
  }

  getRole(): string | null {
    return this.getJwtPayload().role ?? null;
  }
}
