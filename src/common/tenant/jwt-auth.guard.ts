import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ClsService } from 'nestjs-cls';
import { AuthTokenStoreService } from './auth-token-store.service';
import { JwtPayload } from './jwt-payload';
import { TENANT_CLAIM_KEY } from './tenant.constants';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly cls: ClsService,
    private readonly authTokenStore: AuthTokenStoreService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | string[] | undefined>;
      header(name: string): string | undefined;
      user?: JwtPayload;
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
      payload = await this.jwtService.verifyAsync<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('INVALID_JWT');
    }

    const tenantId = payload[TENANT_CLAIM_KEY];
    if (!tenantId) {
      throw new UnauthorizedException('MISSING_TENANT_CLAIM');
    }

    if (payload.tokenType && payload.tokenType !== 'access') {
      throw new UnauthorizedException('INVALID_JWT');
    }

    if (await this.authTokenStore.isTokenBlacklisted(payload.jti)) {
      throw new UnauthorizedException('INVALID_JWT');
    }

    const headerTenantId = request.header('X-Tenant-Id');
    if (headerTenantId && headerTenantId !== tenantId) {
      throw new ForbiddenException('TENANT_HEADER_MISMATCH');
    }

    request.user = payload;
    this.cls.set('tenantId', tenantId);
    this.cls.set('jwtPayload', payload);
    return true;
  }
}
