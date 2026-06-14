import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { JwtPayload } from './jwt-payload';

export type SessionRecord = {
  jti: string;
  issuedAt: string;
  userAgent: string | null;
};

@Injectable()
export class AuthTokenStoreService {
  constructor(private readonly redis: RedisService) {}

  async blacklistAccessToken(payload: JwtPayload): Promise<void> {
    await this.blacklistJti(payload.jti, this.secondsUntilExpiry(payload.exp));
  }

  async blacklistRefreshToken(userId: string, jti: string): Promise<void> {
    const ttlSeconds = await this.getSessionTtl(userId, jti);
    if (ttlSeconds <= 0) {
      return;
    }

    const sessionKey = this.sessionKey(userId, jti);
    await this.redis
      .multi()
      .set(this.blacklistKey(jti), '1', 'EX', ttlSeconds)
      .del(sessionKey)
      .exec();
  }

  async deleteSession(userId: string, jti: string): Promise<void> {
    await this.redis.del(this.sessionKey(userId, jti));
  }

  async getSession(userId: string, jti: string): Promise<SessionRecord | null> {
    const raw = await this.redis.get(this.sessionKey(userId, jti));
    return this.parseSession(raw);
  }

  async isTokenBlacklisted(jti?: string): Promise<boolean> {
    if (!jti) {
      return false;
    }

    return (await this.redis.exists(this.blacklistKey(jti))) === 1;
  }

  async listSessions(userId: string): Promise<SessionRecord[]> {
    const keys = await this.scanKeys(`session:${userId}:*`);
    if (keys.length === 0) {
      return [];
    }

    const values = await this.redis.mget(...keys);
    return values
      .map((value) => this.parseSession(value))
      .filter((session): session is SessionRecord => session !== null)
      .sort((left, right) => right.issuedAt.localeCompare(left.issuedAt));
  }

  async storeSession(
    userId: string,
    session: SessionRecord,
    ttlSeconds: number,
  ): Promise<void> {
    await this.redis.set(
      this.sessionKey(userId, session.jti),
      JSON.stringify(session),
      'EX',
      ttlSeconds,
    );
  }

  private async blacklistJti(
    jti: string | undefined,
    ttlSeconds: number,
  ): Promise<void> {
    if (!jti || ttlSeconds <= 0) {
      return;
    }

    await this.redis.set(this.blacklistKey(jti), '1', 'EX', ttlSeconds);
  }

  private blacklistKey(jti: string): string {
    return `token-blacklist:${jti}`;
  }

  private parseSession(raw: string | null): SessionRecord | null {
    if (!raw) {
      return null;
    }

    try {
      const parsed = JSON.parse(raw) as SessionRecord;
      if (!parsed?.jti || !parsed?.issuedAt) {
        return null;
      }

      return {
        jti: parsed.jti,
        issuedAt: parsed.issuedAt,
        userAgent: parsed.userAgent ?? null,
      };
    } catch {
      return null;
    }
  }

  private async scanKeys(pattern: string): Promise<string[]> {
    const keys: string[] = [];
    let cursor = '0';

    do {
      const [nextCursor, batch] = await this.redis.scan(
        cursor,
        'MATCH',
        pattern,
        'COUNT',
        100,
      );
      cursor = nextCursor;
      keys.push(...batch);
    } while (cursor !== '0');

    return keys;
  }

  private secondsUntilExpiry(exp?: number): number {
    if (!exp) {
      return 0;
    }

    return Math.max(exp - Math.floor(Date.now() / 1000), 0);
  }

  private async getSessionTtl(userId: string, jti: string): Promise<number> {
    const ttl = await this.redis.ttl(this.sessionKey(userId, jti));
    return ttl > 0 ? ttl : 0;
  }

  private sessionKey(userId: string, jti: string): string {
    return `session:${userId}:${jti}`;
  }
}
