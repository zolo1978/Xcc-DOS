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

describe('Sprint 8 end-to-end smoke integration', () => {
  let app: Awaited<ReturnType<typeof createIntApp>>['app'];
  let prisma: Awaited<ReturnType<typeof createIntApp>>['prisma'];
  let redis: RedisService;
  let seed: Awaited<ReturnType<typeof seedTenant>>;

  beforeAll(async () => {
    process.env.LLM_GATEWAY_URL = '';
    process.env.LLM_GATEWAY_KEY = '';
    process.env.LLM_MODEL = 'mock-e2e-smoke';
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

  it('runs the full decision-to-execution chain against real postgres and redis', async () => {
    const ownerTokens = await login(app, 'owner@example.com');
    const approverTokens = await login(app, 'approver@example.com');
    const ownerHeaders = authHeaders(ownerTokens.accessToken, seed.org.id);
    const approverHeaders = authHeaders(approverTokens.accessToken, seed.org.id);

    const goalResponse = await request(app.getHttpServer())
      .post('/api/goals')
      .set(ownerHeaders)
      .send({
        ownerId: seed.owner.id,
        title: 'Raise operating margin',
        metric: 'margin',
        targetValue: 18,
        currentValue: 12,
        startDate: '2026-06-01',
        deadline: '2026-12-31',
      })
      .expect(201);

    const problemResponse = await request(app.getHttpServer())
      .post('/api/problems')
      .set(ownerHeaders)
      .send({
        goalId: goalResponse.body.id,
        title: 'Procurement costs are too high',
        description: 'Need a sourcing decision this quarter',
      })
      .expect(201);

    const decisionCaseResponse = await request(app.getHttpServer())
      .post('/api/decision-cases')
      .set(ownerHeaders)
      .send({
        problemId: problemResponse.body.id,
        title: 'Choose supplier consolidation strategy',
      })
      .expect(201);

    const hypothesis = await prisma.hypothesis.create({
      data: {
        caseId: decisionCaseResponse.body.id,
        content: 'Demand remains stable through Q4',
        evidenceScore: 78,
        confidence: 66,
      },
    });

    const forecastResponse = await request(app.getHttpServer())
      .post(`/api/decision-cases/${decisionCaseResponse.body.id}/forecast`)
      .set(ownerHeaders)
      .send({
        hypothesisIds: [hypothesis.id],
      })
      .expect(201);

    expect(forecastResponse.body.version).toBe(1);

    await request(app.getHttpServer())
      .post(`/api/decision-cases/${decisionCaseResponse.body.id}/evaluate`)
      .set(ownerHeaders)
      .send({
        resourceScore: 81,
        timeScore: 70,
        riskScore: 48,
        feasibilityScore: 76,
        comment: 'Manual evaluation for smoke',
      })
      .expect(201);

    const roiResponse = await request(app.getHttpServer())
      .post(`/api/decision-cases/${decisionCaseResponse.body.id}/simulate-roi`)
      .set(ownerHeaders)
      .send({
        cost: 100,
        revenue: 150,
        paybackDays: 90,
        assumptions: {
          rollout: 'single plant',
        },
      })
      .expect(200);

    expect(roiResponse.body.roi).toBeCloseTo(0.5);

    const approvedPlanResponse = await request(app.getHttpServer())
      .post(`/api/decision-cases/${decisionCaseResponse.body.id}/plans`)
      .set(ownerHeaders)
      .send({
        title: 'Consolidate approved supplier list',
        description: 'Shift volume to preferred vendors',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/plans/${approvedPlanResponse.body.id}/submit`)
      .set(ownerHeaders)
      .send({})
      .expect(200);

    await request(app.getHttpServer())
      .post(`/api/plans/${approvedPlanResponse.body.id}/approve`)
      .set(ownerHeaders)
      .send({})
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/plans/${approvedPlanResponse.body.id}/approve`)
      .set(approverHeaders)
      .send({})
      .expect(200);

    const draftPlanResponse = await request(app.getHttpServer())
      .post(`/api/decision-cases/${decisionCaseResponse.body.id}/plans`)
      .set(ownerHeaders)
      .send({
        title: 'Draft plan pending approval',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post('/api/tasks')
      .set(ownerHeaders)
      .send({
        planId: draftPlanResponse.body.id,
        goalId: goalResponse.body.id,
        ownerId: seed.owner.id,
        title: 'Should fail before approval',
        dueTime: '2026-07-01T09:00:00.000Z',
      })
      .expect(422);

    const taskResponse = await request(app.getHttpServer())
      .post('/api/tasks')
      .set(ownerHeaders)
      .send({
        planId: approvedPlanResponse.body.id,
        goalId: goalResponse.body.id,
        ownerId: seed.owner.id,
        title: 'Execute supplier migration',
        description: 'Complete procurement switch',
        dueTime: '2026-07-01T09:00:00.000Z',
      })
      .expect(201);

    const feedbackResponse = await request(app.getHttpServer())
      .post(`/api/tasks/${taskResponse.body.id}/feedback`)
      .set(ownerHeaders)
      .send({
        todayGoal: 'Kick off supplier migration',
        result: 'Vendor shortlist approved',
        blocker: 'Need final legal review',
        nextAction: 'Schedule review meeting',
        qualityScore: 88,
        timezone: 'Asia/Shanghai',
      })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/tasks/${taskResponse.body.id}/feedback`)
      .set(ownerHeaders)
      .send({
        todayGoal: 'Kick off supplier migration',
        result: 'Vendor shortlist approved',
        blocker: 'Need final legal review',
        nextAction: 'Schedule review meeting',
        qualityScore: 88,
        timezone: 'Asia/Shanghai',
      })
      .expect(409);

    const revisedFeedbackResponse = await request(app.getHttpServer())
      .post(`/api/feedbacks/${feedbackResponse.body.id}/revisions`)
      .set(ownerHeaders)
      .send({
        result: 'Vendor shortlist and legal review aligned',
        nextAction: 'Finalize contract amendments',
        qualityScore: 93,
      })
      .expect(201);

    const supersededFeedback = await prisma.feedback.findUnique({
      where: {
        id: feedbackResponse.body.id,
      },
    });

    expect(revisedFeedbackResponse.body.revision).toBe(2);
    expect(revisedFeedbackResponse.body.supersededBy).toBeNull();
    expect(supersededFeedback?.supersededBy).toBe(revisedFeedbackResponse.body.id);
  });
});
