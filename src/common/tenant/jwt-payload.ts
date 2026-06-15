export type JwtPayload = {
  sub?: string;
  tenant?: string;
  role?: string;
  tokenType?: 'access' | 'refresh' | string;
  jti?: string;
  iat?: number;
  exp?: number;
};
