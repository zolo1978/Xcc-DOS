import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { JwtAuthGuard } from './jwt-auth.guard';
import { TenantContext } from './tenant-context.service';

@Global()
@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'change-me',
    }),
  ],
  providers: [JwtAuthGuard, TenantContext],
  exports: [JwtAuthGuard, TenantContext, JwtModule],
})
export class TenantModule {}
