import { clearAuthSession, getAuthSession, setAuthSession } from "@/lib/auth-session";
import type {
  AuthTokens,
  GeneratedRule,
  ListResponse,
  LoginPayload,
  Rule,
  RuleDraft,
  Synonym,
  SynonymDraft,
  Tenant
} from "@/lib/types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api/v1";

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

let refreshPromise: Promise<boolean> | null = null;

function buildUrl(path: string) {
  return `${API_BASE_URL}${path}`;
}

async function parseResponse<T>(response: Response) {
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  const data = text ? (JSON.parse(text) as T | { message?: string }) : undefined;

  if (!response.ok) {
    const message = typeof data === "object" && data && "message" in data && data.message
      ? data.message
      : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return data as T;
}

async function refreshTokens() {
  const current = getAuthSession();
  if (!current?.refreshToken) {
    clearAuthSession();
    return false;
  }

  if (!refreshPromise) {
    refreshPromise = fetch(buildUrl("/auth/refresh"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Tenant-Id": current.tenantCode
      },
      body: JSON.stringify({ refreshToken: current.refreshToken })
    })
      .then(parseResponse<AuthTokens>)
      .then((tokens) => {
        setAuthSession({
          ...current,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken
        });
        return true;
      })
      .catch(() => {
        clearAuthSession();
        return false;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

export async function request<T>(
  path: string,
  init: RequestInit = {},
  retryOn401 = true
) {
  const current = getAuthSession();
  const headers = new Headers(init.headers);
  const isJsonBody = init.body && !(init.body instanceof FormData);

  if (isJsonBody && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  if (current?.accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${current.accessToken}`);
  }

  if (current?.tenantCode && !headers.has("X-Tenant-Id")) {
    headers.set("X-Tenant-Id", current.tenantCode);
  }

  const response = await fetch(buildUrl(path), {
    ...init,
    headers
  });

  if (
    response.status === 401 &&
    retryOn401 &&
    path !== "/auth/login" &&
    path !== "/auth/refresh"
  ) {
    const refreshed = await refreshTokens();
    if (refreshed) {
      return request<T>(path, init, false);
    }
  }

  return parseResponse<T>(response);
}

export const api = {
  login(payload: LoginPayload) {
    return request<AuthTokens>("/auth/login", {
      method: "POST",
      body: JSON.stringify({
        username: payload.username,
        password: payload.password,
        tenantCode: payload.tenantCode
      })
    });
  },
  listRules() {
    return request<ListResponse<Rule>>("/rules");
  },
  createRule(payload: RuleDraft) {
    return request<Rule>("/rules", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateRule(id: string, payload: RuleDraft) {
    return request<Rule>(`/rules/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  publishGray(id: string, grayRate: number) {
    return request<Rule>(`/rules/${id}/publish/gray`, {
      method: "PATCH",
      body: JSON.stringify({ grayRate })
    });
  },
  rollbackRule(id: string, version: number) {
    return request<Rule>(`/rules/${id}/rollback`, {
      method: "POST",
      body: JSON.stringify({ version })
    });
  },
  listGeneratedRules(reviewStatus = "pending_review") {
    return request<ListResponse<GeneratedRule>>(`/evolution/generated-rules?reviewStatus=${reviewStatus}`);
  },
  approveGeneratedRule(id: string) {
    return request<Rule>(`/evolution/generated-rules/${id}/approve`, {
      method: "POST"
    });
  },
  rejectGeneratedRule(id: string, reason: string) {
    return request<GeneratedRule>(`/evolution/generated-rules/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason })
    });
  },
  listSynonyms() {
    return request<ListResponse<Synonym>>("/synonyms");
  },
  createSynonym(payload: SynonymDraft) {
    return request<Synonym>("/synonyms", {
      method: "POST",
      body: JSON.stringify(payload)
    });
  },
  updateSynonym(id: string, payload: SynonymDraft) {
    return request<Synonym>(`/synonyms/${id}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  },
  deleteSynonym(id: string) {
    return request<void>(`/synonyms/${id}`, {
      method: "DELETE"
    });
  },
  listTenants() {
    return request<ListResponse<Tenant>>("/tenants");
  }
};
