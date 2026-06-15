import type {
  ApiErrorBody,
  BossDashboard,
  CreateForecastInput,
  CreateGoalInput,
  CreateHypothesisInput,
  CreatePlanInput,
  CreateTaskInput,
  DecisionCase,
  EvaluateDecisionCaseInput,
  Feedback,
  FeedbackInput,
  Forecast,
  Goal,
  LoginInput,
  LoginResponse,
  Plan,
  RefreshResponse,
  RoiSimulation,
  SimulateRoiInput,
  Task,
} from '@/types/api';
import { decodeJwtPayload } from './jwt';
import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getTenantId,
  setAccessToken,
  setSession,
} from './session';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '/api';

type QueryValue = string | number | boolean | null | undefined;

type RequestConfig = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  headers?: Record<string, string>;
  requireAuth?: boolean;
  retryOnUnauthorized?: boolean;
};

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: ApiErrorBody | null,
  ) {
    super(body?.message ?? `Request failed with status ${status}`);
  }
}

function buildUrl(path: string, query?: Record<string, QueryValue>) {
  const url = new URL(`${API_BASE_URL}${path}`, 'http://localhost');

  if (query) {
    Object.entries(query).forEach(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return;
      }

      url.searchParams.set(key, String(value));
    });
  }

  return `${url.pathname}${url.search}`;
}

function normalizeBody(body: unknown) {
  if (
    body === undefined ||
    body === null ||
    typeof body === 'string' ||
    body instanceof FormData
  ) {
    return body;
  }

  return JSON.stringify(body);
}

function createIdempotencyKey(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function parseBody<T>(response: Response): Promise<T | null> {
  if (response.status === 204) {
    return null;
  }

  const contentType = response.headers.get('Content-Type') ?? '';
  if (!contentType.includes('application/json')) {
    return null;
  }

  return (await response.json()) as T;
}

async function refreshAccessToken() {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  const response = await fetch(buildUrl('/auth/refresh'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken }),
  });

  if (!response.ok) {
    clearSession();
    return null;
  }

  const body = await parseBody<RefreshResponse>(response);
  if (!body?.accessToken) {
    clearSession();
    return null;
  }

  if (body.refreshToken) {
    setSession({
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
      tenantId: decodeJwtPayload(body.accessToken)?.tenant ?? null,
    });
  } else {
    setAccessToken(body.accessToken);
  }

  return body.accessToken;
}

async function request<T>(path: string, config: RequestConfig = {}): Promise<T> {
  const {
    method = 'GET',
    body,
    query,
    headers = {},
    requireAuth = true,
    retryOnUnauthorized = true,
  } = config;

  const doFetch = async () => {
    const requestHeaders: Record<string, string> = { ...headers };
    const nextBody = normalizeBody(body);

    if (nextBody && !(nextBody instanceof FormData) && !requestHeaders['Content-Type']) {
      requestHeaders['Content-Type'] = 'application/json';
    }

    if (requireAuth) {
      const accessToken = getAccessToken();
      const tenantId = getTenantId();

      if (accessToken) {
        requestHeaders.Authorization = `Bearer ${accessToken}`;
      }

      if (tenantId) {
        requestHeaders['X-Tenant-Id'] = tenantId;
      }
    }

    return fetch(buildUrl(path, query), {
      method,
      headers: requestHeaders,
      body: nextBody,
    });
  };

  let response = await doFetch();

  if (response.status === 401 && requireAuth && retryOnUnauthorized && path !== '/auth/refresh') {
    const accessToken = await refreshAccessToken();
    if (accessToken) {
      response = await doFetch();
    }
  }

  if (!response.ok) {
    throw new ApiError(response.status, await parseBody<ApiErrorBody>(response));
  }

  return (await parseBody<T>(response)) as T;
}

export async function login(input: LoginInput) {
  const tokens = await request<LoginResponse>('/auth/login', {
    method: 'POST',
    body: input,
    requireAuth: false,
    retryOnUnauthorized: false,
  });
  const tenantId = decodeJwtPayload(tokens.accessToken)?.tenant ?? null;

  // Chosen trade-off for this slice: keep access token in memory and persist refresh
  // token in localStorage because the current backend contract does not set httpOnly cookies.
  setSession({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    tenantId,
  });

  return tokens;
}

export async function bootstrapSession() {
  const accessToken = getAccessToken();
  if (accessToken) {
    return {
      accessToken,
      tenantId: decodeJwtPayload(accessToken)?.tenant ?? null,
    };
  }

  const refreshedAccessToken = await refreshAccessToken();
  if (!refreshedAccessToken) {
    return null;
  }

  return {
    accessToken: refreshedAccessToken,
    tenantId: decodeJwtPayload(refreshedAccessToken)?.tenant ?? null,
  };
}

export function logout() {
  clearSession();
}

export function listGoals() {
  return request<Goal[]>('/goals');
}

export function createGoal(input: CreateGoalInput) {
  return request<Goal>('/goals', {
    method: 'POST',
    body: input,
  });
}

export function updateGoalStatus(goalId: string, status: Goal['status'], version: number) {
  return request<Goal>(`/goals/${goalId}/status`, {
    method: 'PATCH',
    body: { status },
    headers: {
      'If-Match': String(version),
    },
  });
}

export function getBossDashboard() {
  return request<BossDashboard>('/dashboard/boss');
}

export function listDecisionCases() {
  return request<DecisionCase[]>('/decision-cases');
}

export function getDecisionCase(decisionCaseId: string) {
  return request<DecisionCase>(`/decision-cases/${decisionCaseId}`);
}

export function addHypothesis(decisionCaseId: string, input: CreateHypothesisInput) {
  return request<DecisionCase['hypotheses'][number] | null>(
    `/decision-cases/${decisionCaseId}/hypotheses`,
    {
      method: 'POST',
      body: input,
    },
  );
}

export function createForecast(decisionCaseId: string, input: CreateForecastInput) {
  return request<Forecast>(`/decision-cases/${decisionCaseId}/forecast`, {
    method: 'POST',
    body: input,
  });
}

export function listForecasts(decisionCaseId: string, version?: number) {
  return request<Forecast[] | Forecast>(`/decision-cases/${decisionCaseId}/forecasts`, {
    query: {
      version,
    },
  });
}

export function evaluateDecisionCase(
  decisionCaseId: string,
  input: EvaluateDecisionCaseInput,
) {
  return request<DecisionCase['evaluation'] | null>(`/decision-cases/${decisionCaseId}/evaluate`, {
    method: 'POST',
    body: input,
  });
}

export function simulateDecisionCaseRoi(
  decisionCaseId: string,
  input: SimulateRoiInput,
) {
  return request<RoiSimulation>(`/decision-cases/${decisionCaseId}/simulate-roi`, {
    method: 'POST',
    body: input,
  });
}

export function generateDecisionReport(decisionCaseId: string) {
  return request<Record<string, unknown> | null>(`/decision-cases/${decisionCaseId}/report`, {
    method: 'POST',
  });
}

export function createPlan(decisionCaseId: string, input: CreatePlanInput) {
  return request<Plan>(`/decision-cases/${decisionCaseId}/plans`, {
    method: 'POST',
    body: input,
  });
}

export function getPlan(planId: string) {
  return request<Plan>(`/plans/${planId}`);
}

export function submitPlan(planId: string) {
  return request<Record<string, unknown> | null>(`/plans/${planId}/submit`, {
    method: 'POST',
  });
}

export function approvePlan(planId: string) {
  return request<Record<string, unknown> | null>(`/plans/${planId}/approve`, {
    method: 'POST',
  });
}

export function rejectPlan(planId: string, reason: string) {
  return request<Record<string, unknown> | null>(`/plans/${planId}/reject`, {
    method: 'POST',
    body: { reason },
  });
}

export function createTask(input: CreateTaskInput) {
  return request<Task>('/tasks', {
    method: 'POST',
    body: input,
    headers: {
      'Idempotency-Key': createIdempotencyKey('task'),
    },
  });
}

export function updateTaskStatus(taskId: string, status: Task['status'], version: number) {
  return request<Task>(`/tasks/${taskId}/status`, {
    method: 'PATCH',
    body: { status },
    headers: {
      'If-Match': String(version),
    },
  });
}

export function submitTaskFeedback(taskId: string, input: FeedbackInput) {
  return request<Feedback>(`/tasks/${taskId}/feedback`, {
    method: 'POST',
    body: input,
    headers: {
      'Idempotency-Key': createIdempotencyKey('feedback'),
    },
  });
}

export function getTaskFeedback(taskId: string) {
  return request<Feedback[] | Feedback>(`/tasks/${taskId}/feedback`);
}

export function reviseFeedback(feedbackId: string, input: FeedbackInput) {
  return request<Feedback>(`/feedbacks/${feedbackId}/revisions`, {
    method: 'POST',
    body: input,
  });
}

export type XcdosApiTypes = {
  DecisionCase: DecisionCase;
  Forecast: Forecast;
  Goal: Goal;
  Plan: Plan;
  Task: Task;
  Feedback: Feedback;
};
