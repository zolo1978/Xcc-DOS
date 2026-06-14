import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthTokenStoreService } from './auth-token-store.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TenantContext } from './tenant-context.service';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'change-me',
    }),
  ],
  providers: [AuthTokenStoreService, JwtAuthGuard, TenantContext],
  exports: [AuthTokenStoreService, JwtAuthGuard, TenantContext, JwtModule],
})
export class TenantModule {}
