export interface AuthSession {
  accessToken: string;
  refreshToken: string;
  tenantCode: string;
  username: string;
}

const STORAGE_KEY = "prolog-web-admin-auth";

let session: AuthSession | null = null;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function getAuthSession() {
  if (session) {
    return session;
  }

  if (!canUseStorage()) {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    session = JSON.parse(raw) as AuthSession;
    return session;
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function setAuthSession(next: AuthSession | null) {
  session = next;
  if (!canUseStorage()) {
    return;
  }

  if (next) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } else {
    window.localStorage.removeItem(STORAGE_KEY);
  }
}

export function clearAuthSession() {
  setAuthSession(null);
}
