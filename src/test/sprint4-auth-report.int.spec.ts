import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { RedisService } from '../common/redis/redis.service';
import {
  authHeaders,
  createIntApp,
  drainQueues,
  login,
  seedTenant,
  truncateAll,
} from './test-utils.int';

describe('Sprint 4 auth lifecycle and report integration', () => {
  let app: Awaited<ReturnType<typeof createIntApp>>['app'];
  let prisma: Awaited<ReturnType<typeof createIntApp>>['prisma'];
  let redis: RedisService;
  let seed: Awaited<ReturnType<typeof seedTenant>>;

  beforeAll(async () => {
    ({ app, prisma } = await createIntApp());
    redis = app.get(RedisService);
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    await drainQueues();
    await redis.flushdb();
    seed = await seedTenant(prisma);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('revokes the current access token on logout', async () => {
    const ownerTokens = await login(app, 'owner@example.com', 'password123', 'logout-agent');

    await request(app.getHttpServer())
      .get('/api/goals')
      .set(authHeaders(ownerTokens.accessToken, seed.org.id))
      .expect(200);

    await request(app.getHttpServer())
      .post('/api/auth/logout')
      .set(authHeaders(ownerTokens.accessToken, seed.org.id))
      .expect(204);

    await request(app.getHttpServer())
      .get('/api/goals')
      .set(authHeaders(ownerTokens.accessToken, seed.org.id))
      .expect(401);
  });

  it('lists refresh sessions and supports remote logout by refresh jti', async () => {
    const sessionATokens = await login(
      app,
      'owner@example.com',
      'password123',
      'session-agent-a',
    );
    const sessionBTokens = await login(
      app,
      'owner@example.com',
      'password123',
      'session-agent-b',
    );

    const sessionsResponse = await request(app.getHttpServer())
      .get('/api/auth/sessions')
      .set(authHeaders(sessionATokens.accessToken, seed.org.id))
      .expect(200);

    expect(sessionsResponse.body).toHaveLength(2);
    expect(sessionsResponse.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userAgent: 'session-agent-a' }),
        expect.objectContaining({ userAgent: 'session-agent-b' }),
      ]),
    );

    const revokedSession = sessionsResponse.body.find(
      (session: { userAgent: string; jti: string }) =>
        session.userAgent === 'session-agent-b',
    );

    await request(app.getHttpServer())
      .delete(`/api/auth/sessions/${revokedSession.jti}`)
      .set(authHeaders(sessionATokens.accessToken, seed.org.id))
      .expect(204);

    await request(app.getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken: sessionBTokens.refreshToken })
      .expect(401);

    const remainingSessions = await request(app.getHttpServer())
      .get('/api/auth/sessions')
      .set(authHeaders(sessionATokens.accessToken, seed.org.id))
      .expect(200);

    expect(remainingSessions.body).toHaveLength(1);
    expect(remainingSessions.body[0].userAgent).toBe('session-agent-a');
  });

  it('keeps the case unresolved without an approved plan but resolves it once a plan is approved', async () => {
    const ownerTokens = await login(app, 'owner@example.com');
    const approverTokens = await login(app, 'approver@example.com');

    const goalResponse = await request(app.getHttpServer())
      .post('/api/goals')
      .set(authHeaders(ownerTokens.accessToken, seed.org.id))
      .send({
        ownerId: seed.owner.id,
        title: 'Increase gross margin',
        startDate: '2026-06-01',
        deadline: '2026-12-31',
      })
      .expect(201);

    const problemResponse = await request(app.getHttpServer())
      .post('/api/problems')
      .set(authHeaders(ownerTokens.accessToken, seed.org.id))
      .send({
        goalId: goalResponse.body.id,
        title: 'Material cost is unstable',
        description: 'Need sourcing decision',
      })
      .expect(201);

    const caseResponse = await request(app.getHttpServer())
      .post('/api/decision-cases')
      .set(authHeaders(ownerTokens.accessToken, seed.org.id))
      .send({
        problemId: problemResponse.body.id,
        title: 'Select supplier strategy',
      })
      .expect(201);

    await prisma.hypothesis.create({
      data: {
        caseId: caseResponse.body.id,
        content: 'Demand remains stable',
        evidenceScore: 75,
        confidence: 60,
      },
    });

    await prisma.forecast.createMany({
      data: [
        {
          caseId: caseResponse.body.id,
          version: 1,
          inputHypothesisIds: [],
          scenarios: [{ name: 'base-v1' }],
          modelSource: 'planner',
          confidence: 78,
          revisedBy: seed.owner.id,
        },
        {
          caseId: caseResponse.body.id,
          version: 2,
          inputHypothesisIds: [],
          scenarios: [{ name: 'base-v2' }],
          modelSource: 'planner',
          confidence: 82,
          revisedBy: seed.owner.id,
        },
      ],
    });

    await request(app.getHttpServer())
      .post(`/api/decision-cases/${caseResponse.body.id}/evaluate`)
      .set(authHeaders(ownerTokens.accessToken, seed.org.id))
      .send({
        resourceScore: 82,
        timeScore: 70,
        riskScore: 55,
        feasibilityScore: 77,
        comment: 'Initial assessment',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/decision-cases/${caseResponse.body.id}/simulate-roi`)
      .set(authHeaders(ownerTokens.accessToken, seed.org.id))
      .send({
        cost: 100,
        revenue: 180,
        paybackDays: 90,
        assumptions: { volume: 'stable' },
      })
      .expect(200);

    const blockedReport = await request(app.getHttpServer())
      .post(`/api/decision-cases/${caseResponse.body.id}/report`)
      .set(authHeaders(ownerTokens.accessToken, seed.org.id))
      .expect(409);

    expect(blockedReport.body.code).toBe('NO_APPROVED_PLAN');
    expect(blockedReport.body.report.forecast.version).toBe(2);
    expect(blockedReport.body.report.hypotheses).toHaveLength(1);
    expect(blockedReport.body.report.case.stage).toBe('report');
    expect(blockedReport.body.report.case.status).toBe('open');

    const planResponse = await request(app.getHttpServer())
      .post(`/api/decision-cases/${caseResponse.body.id}/plans`)
      .set(authHeaders(ownerTokens.accessToken, seed.org.id))
      .send({
        title: 'Dual supplier rollout',
        description: 'Pilot and expand',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/plans/${planResponse.body.id}/submit`)
      .set(authHeaders(ownerTokens.accessToken, seed.org.id))
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/plans/${planResponse.body.id}/approve`)
      .set(authHeaders(approverTokens.accessToken, seed.org.id))
      .send({})
      .expect(200);

    const resolvedReport = await request(app.getHttpServer())
      .post(`/api/decision-cases/${caseResponse.body.id}/report`)
      .set(authHeaders(ownerTokens.accessToken, seed.org.id))
      .expect(200);

    expect(resolvedReport.body.case.stage).toBe('report');
    expect(resolvedReport.body.case.status).toBe('resolved');
    expect(resolvedReport.body.resolved).toBe(true);
    expect(resolvedReport.body.forecast.version).toBe(2);
  });
});
