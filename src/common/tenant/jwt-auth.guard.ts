import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClsService } from 'nestjs-cls';
import { TENANT_CLAIM_KEY } from './tenant.constants';

type JwtPayload = {
  sub?: string;
  tenant?: string;
};

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly cls: ClsService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      header(name: string): string | undefined;
    }>();
    const rawAuthHeader = request.headers.authorization;
    const authHeader = Array.isArray(rawAuthHeader)
      ? rawAuthHeader[0]
      : rawAuthHeader;

    if (!authHeader?.startsWith('Bearer ')) {
      throw new UnauthorizedException('MISSING_BEARER_TOKEN');
    }

    const token = authHeader.slice(7);
    let payload: JwtPayload;

    try {
      payload = this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('INVALID_JWT');
    }

    const tenantId = payload[TENANT_CLAIM_KEY];
    if (!tenantId) {
      throw new UnauthorizedException('MISSING_TENANT_CLAIM');
    }

    const headerTenantId = request.header('X-Tenant-Id');
    if (headerTenantId && headerTenantId !== tenantId) {
      throw new ForbiddenException('TENANT_HEADER_MISMATCH');
    }

    this.cls.set('tenantId', tenantId);
    this.cls.set('jwtPayload', payload);
    return true;
  }
}
