import { decodeJwtPayload } from './jwt';

const REFRESH_TOKEN_KEY = 'xcdos.refresh-token';
const TENANT_ID_KEY = 'xcdos.tenant-id';

let accessToken: string | null = null;
let refreshToken: string | null = null;

function canUseStorage() {
  return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
}

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken() {
  if (refreshToken) {
    return refreshToken;
  }

  if (!canUseStorage()) {
    return null;
  }

  refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
  return refreshToken;
}

export function getTenantId() {
  const tokenTenant = decodeJwtPayload(accessToken)?.tenant;
  if (tokenTenant) {
    return tokenTenant;
  }

  if (!canUseStorage()) {
    return null;
  }

  return window.localStorage.getItem(TENANT_ID_KEY);
}

export function getCurrentUserId() {
  return decodeJwtPayload(accessToken)?.sub ?? null;
}

export function setSession(session: {
  accessToken: string;
  refreshToken: string;
  tenantId?: string | null;
}) {
  accessToken = session.accessToken;
  refreshToken = session.refreshToken;

  if (!canUseStorage()) {
    return;
  }

  window.localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);

  const tenantId = session.tenantId ?? decodeJwtPayload(session.accessToken)?.tenant ?? null;
  if (tenantId) {
    window.localStorage.setItem(TENANT_ID_KEY, tenantId);
  }
}

export function setAccessToken(nextAccessToken: string | null) {
  accessToken = nextAccessToken;

  if (!canUseStorage()) {
    return;
  }

  const tenantId = decodeJwtPayload(nextAccessToken)?.tenant;
  if (tenantId) {
    window.localStorage.setItem(TENANT_ID_KEY, tenantId);
  }
}

export function clearSession() {
  accessToken = null;
  refreshToken = null;

  if (!canUseStorage()) {
    return;
  }

  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  window.localStorage.removeItem(TENANT_ID_KEY);
}
