import {
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { RedisService } from '../common/redis/redis.service';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      const redisStatus = await this.redis.ping();

      return {
        status: 'ok',
        checks: {
          database: 'up',
          redis: redisStatus,
        },
      };
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'HEALTH_CHECK_FAILED',
        message: error instanceof Error ? error.message : 'Health check failed',
      });
    }
  }
}
