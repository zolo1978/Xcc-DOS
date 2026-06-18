import { api } from "@/lib/api";
import { clearAuthSession, getAuthSession, setAuthSession } from "@/lib/auth-session";
import type { LoginPayload } from "@/lib/types";
import { defineStore } from "pinia";

export const useAuthStore = defineStore("auth", {
  state: () => ({
    session: getAuthSession(),
    busy: false
  }),
  getters: {
    isAuthenticated: (state) => Boolean(state.session?.accessToken),
    tenantCode: (state) => state.session?.tenantCode ?? "",
    username: (state) => state.session?.username ?? ""
  },
  actions: {
    async login(payload: LoginPayload) {
      this.busy = true;
      try {
        const tokens = await api.login(payload);
        const session = {
          ...tokens,
          tenantCode: payload.tenantCode,
          username: payload.username
        };
        setAuthSession(session);
        this.session = session;
      } finally {
        this.busy = false;
      }
    },
    logout() {
      clearAuthSession();
      this.session = null;
    }
  }
});
