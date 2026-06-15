import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DecisionCaseDetailPage } from '@/features/decision-cases/decision-case-detail-page';
import { clearSession, setSession } from '@/lib/session';

function createToken(payload: Record<string, unknown>) {
  const encoded = Buffer.from(JSON.stringify(payload))
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

  return `header.${encoded}.signature`;
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('DecisionCaseDetailPage', () => {
  beforeEach(() => {
    clearSession();
    vi.restoreAllMocks();
    setSession({
      accessToken: createToken({
        tenant: 'tenant-1',
        tokenType: 'access',
        sub: 'user-1',
      }),
      refreshToken: 'refresh-token',
      tenantId: 'tenant-1',
    });
  });

  it('renders the five-stage stepper for the decision workflow', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url === '/api/decision-cases/case-1') {
          return Promise.resolve(
            jsonResponse({
              id: 'case-1',
              title: '供应链交付恢复',
              stage: 'evaluate',
              status: 'open',
              ownerId: 'manager-1',
              hypotheses: [
                {
                  id: 'hyp-1',
                  content: '瓶颈来自二级供应商延误',
                  evidenceScore: 88,
                  confidence: 72,
                  counterExample: '主仓库存仍可支撑一周',
                },
              ],
              plans: [],
            }),
          );
        }

        if (url === '/api/decision-cases/case-1/forecasts') {
          return Promise.resolve(
            jsonResponse([
              {
                id: 'forecast-2',
                caseId: 'case-1',
                version: 2,
                scenarios: [
                  {
                    name: '切换备选供应商',
                    probability: 0.62,
                    outcome: '两周内恢复交付',
                    impact: '毛利率小幅下降',
                    assumptions: '物流优先级上调',
                  },
                ],
                confidence: 0.71,
                modelSource: 'agent:gpt',
              },
            ]),
          );
        }

        if (url === '/api/decision-cases/case-1/forecasts?version=2') {
          return Promise.resolve(
            jsonResponse({
              id: 'forecast-2',
              caseId: 'case-1',
              version: 2,
              scenarios: [
                {
                  name: '切换备选供应商',
                  probability: 0.62,
                  outcome: '两周内恢复交付',
                  impact: '毛利率小幅下降',
                  assumptions: '物流优先级上调',
                },
              ],
              confidence: 0.71,
              modelSource: 'agent:gpt',
            }),
          );
        }

        return Promise.reject(new Error(`Unhandled request: ${url}`));
      }),
    );

    render(<DecisionCaseDetailPage decisionCaseId="case-1" />);

    await waitFor(() => {
      expect(screen.getByText('供应链交付恢复')).toBeInTheDocument();
    });

    expect(screen.getByText('拆解')).toBeInTheDocument();
    expect(screen.getByText('推演')).toBeInTheDocument();
    expect(screen.getByText('评估')).toBeInTheDocument();
    expect(screen.getByText('测算')).toBeInTheDocument();
    expect(screen.getByText('报告')).toBeInTheDocument();
  });

  it('disables approve for the current plan owner and explains the separation rule', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        const url = String(input);

        if (url === '/api/decision-cases/case-1') {
          return Promise.resolve(
            jsonResponse({
              id: 'case-1',
              title: '华东试点涨价',
              stage: 'report',
              status: 'open',
              ownerId: 'manager-1',
              hypotheses: [],
              plans: [
                {
                  id: 'plan-1',
                  caseId: 'case-1',
                  ownerId: 'user-1',
                  title: '华东区域涨价试点',
                  description: '先对重点客户分层调价',
                  status: 'submitted',
                  version: 3,
                },
              ],
            }),
          );
        }

        if (url === '/api/plans/plan-1') {
          return Promise.resolve(
            jsonResponse({
              id: 'plan-1',
              caseId: 'case-1',
              ownerId: 'user-1',
              title: '华东区域涨价试点',
              description: '先对重点客户分层调价',
              status: 'submitted',
              version: 3,
            }),
          );
        }

        if (url === '/api/decision-cases/case-1/forecasts') {
          return Promise.resolve(jsonResponse([]));
        }

        return Promise.reject(new Error(`Unhandled request: ${url}`));
      }),
    );

    render(<DecisionCaseDetailPage decisionCaseId="case-1" />);

    await waitFor(() => {
      expect(screen.getByText('华东区域涨价试点')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: '审批通过' })).toBeDisabled();
    expect(screen.getByText('职责分离：不能审批自己的方案')).toBeInTheDocument();
  });

  it('shows the approved-plan guidance when report generation returns 409', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);

        if (url === '/api/decision-cases/case-1') {
          return Promise.resolve(
            jsonResponse({
              id: 'case-1',
              title: '仓储布局优化',
              stage: 'calculate',
              status: 'open',
              ownerId: 'manager-1',
              hypotheses: [],
              plans: [],
            }),
          );
        }

        if (url === '/api/decision-cases/case-1/forecasts') {
          return Promise.resolve(jsonResponse([]));
        }

        if (url === '/api/decision-cases/case-1/report' && init?.method === 'POST') {
          return Promise.resolve(
            jsonResponse(
              {
                code: 'NO_APPROVED_PLAN',
                message: 'need approved plan',
              },
              409,
            ),
          );
        }

        return Promise.reject(new Error(`Unhandled request: ${url}`));
      }),
    );

    render(<DecisionCaseDetailPage decisionCaseId="case-1" />);

    await waitFor(() => {
      expect(screen.getByText('仓储布局优化')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '生成报告' }));

    await waitFor(() => {
      expect(screen.getByText('需先有已批准方案')).toBeInTheDocument();
    });
  });
});
