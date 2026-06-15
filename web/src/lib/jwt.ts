export type JwtPayload = {
  sub?: string;
  tenant?: string;
  role?: string;
  tokenType?: 'access' | 'refresh';
  exp?: number;
  iat?: number;
  jti?: string;
};

function decodeBase64Url(segment: string) {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');

  if (typeof window !== 'undefined' && typeof window.atob === 'function') {
    return window.atob(padded);
  }

  return Buffer.from(padded, 'base64').toString('utf8');
}

export function decodeJwtPayload(token: string | null | undefined): JwtPayload | null {
  if (!token) {
    return null;
  }

  const [, payloadSegment] = token.split('.');
  if (!payloadSegment) {
    return null;
  }

  try {
    return JSON.parse(decodeBase64Url(payloadSegment)) as JwtPayload;
  } catch {
    return null;
  }
}
