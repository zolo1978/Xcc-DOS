'use client';

import { create } from 'zustand';
import type { LoginInput } from '@/types/api';
import { bootstrapSession, login as loginRequest, logout as logoutSession } from '@/lib/api';
import { decodeJwtPayload } from '@/lib/jwt';

type AuthStatus = 'booting' | 'authenticated' | 'unauthenticated';

type AuthState = {
  status: AuthStatus;
  accessToken: string | null;
  tenantId: string | null;
  loginError: string | null;
  submitting: boolean;
  bootstrap: () => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  status: 'booting',
  accessToken: null,
  tenantId: null,
  loginError: null,
  submitting: false,
  async bootstrap() {
    const session = await bootstrapSession();

    if (!session) {
      set({
        status: 'unauthenticated',
        accessToken: null,
        tenantId: null,
      });
      return;
    }

    set({
      status: 'authenticated',
      accessToken: session.accessToken,
      tenantId: session.tenantId,
    });
  },
  async login(input) {
    set({
      submitting: true,
      loginError: null,
    });

    try {
      const tokens = await loginRequest(input);
      const tenantId = decodeJwtPayload(tokens.accessToken)?.tenant ?? null;

      set({
        status: 'authenticated',
        accessToken: tokens.accessToken,
        tenantId,
        submitting: false,
      });
    } catch (error) {
      set({
        status: 'unauthenticated',
        accessToken: null,
        tenantId: null,
        submitting: false,
        loginError: error instanceof Error ? error.message : '登录失败，请重试。',
      });
      throw error;
    }
  },
  logout() {
    logoutSession();
    set({
      status: 'unauthenticated',
      accessToken: null,
      tenantId: null,
      loginError: null,
      submitting: false,
    });
  },
}));
