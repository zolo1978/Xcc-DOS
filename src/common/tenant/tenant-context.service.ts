import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

@Injectable()
export class TenantContext {
  constructor(private readonly cls: ClsService) {}

  getTenantId(): string {
    const tenantId = this.cls.get<string>('tenantId');
    if (!tenantId) {
      throw new UnauthorizedException('TENANT_CONTEXT_MISSING');
    }

    return tenantId;
  }
}
