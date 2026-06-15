import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  authHeaders,
  createIntApp,
  drainQueues,
  login,
  seedTenant,
  truncateAll,
} from './test-utils.int';

describe('Sprint 3 API integration', () => {
  let app: Awaited<ReturnType<typeof createIntApp>>['app'];
  let prisma: Awaited<ReturnType<typeof createIntApp>>['prisma'];
  let seed: Awaited<ReturnType<typeof seedTenant>>;

  beforeAll(async () => {
    ({ app, prisma } = await createIntApp());
  });

  beforeEach(async () => {
    await truncateAll(prisma);
    await drainQueues();
    seed = await seedTenant(prisma);
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('runs the main e2e chain against real postgres and redis', async () => {
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

    const taskResponse = await request(app.getHttpServer())
      .post('/api/tasks')
      .set(authHeaders(ownerTokens.accessToken, seed.org.id))
      .send({
        planId: planResponse.body.id,
        goalId: goalResponse.body.id,
        ownerId: seed.owner.id,
        title: 'Execute supplier pilot',
        dueTime: '2026-06-30T00:00:00.000Z',
      })
      .expect(201);

    const feedbackResponse = await request(app.getHttpServer())
      .post(`/api/tasks/${taskResponse.body.id}/feedback`)
      .set(authHeaders(ownerTokens.accessToken, seed.org.id))
      .send({
        todayGoal: 'Finish shortlist',
        result: 'Three candidates selected',
        timezone: 'UTC',
      })
      .expect(201);

    const revisedResponse = await request(app.getHttpServer())
      .post(`/api/feedbacks/${feedbackResponse.body.id}/revisions`)
      .set(authHeaders(ownerTokens.accessToken, seed.org.id))
      .send({
        result: 'Four candidates selected',
      })
      .expect(201);

    const feedbackHistory = await request(app.getHttpServer())
      .get(`/api/tasks/${taskResponse.body.id}/feedback`)
      .set(authHeaders(ownerTokens.accessToken, seed.org.id))
      .expect(200);

    expect(feedbackHistory.body.current.id).toBe(revisedResponse.body.id);
    expect(feedbackHistory.body.history).toHaveLength(2);
    expect(feedbackHistory.body.history[1].supersededBy).toBe(revisedResponse.body.id);
  });

  it('verifies soft delete, optimistic lock, and tenant isolation against the real database', async () => {
    const ownerTokens = await login(app, 'owner@example.com');
    const outsiderTokens = await login(app, 'outsider@example.com');

    const goal = await request(app.getHttpServer())
      .post('/api/goals')
      .set(authHeaders(ownerTokens.accessToken, seed.org.id))
      .send({
        ownerId: seed.owner.id,
        title: 'Protect cash flow',
        startDate: '2026-06-01',
        deadline: '2026-12-31',
      })
      .expect(201);

    await request(app.getHttpServer())
      .patch(`/api/goals/${goal.body.id}/status`)
      .set(authHeaders(ownerTokens.accessToken, seed.org.id))
      .set('If-Match', '0')
      .send({ status: 'active' })
      .expect(200);

    await request(app.getHttpServer())
      .patch(`/api/goals/${goal.body.id}/status`)
      .set(authHeaders(ownerTokens.accessToken, seed.org.id))
      .set('If-Match', '0')
      .send({ status: 'completed' })
      .expect(409);

    await request(app.getHttpServer())
      .get(`/api/goals/${goal.body.id}`)
      .set(authHeaders(outsiderTokens.accessToken, seed.otherOrg.id))
      .expect(404);

    await request(app.getHttpServer())
      .delete(`/api/goals/${goal.body.id}`)
      .set(authHeaders(ownerTokens.accessToken, seed.org.id))
      .expect(204);

    await request(app.getHttpServer())
      .get(`/api/goals/${goal.body.id}`)
      .set(authHeaders(ownerTokens.accessToken, seed.org.id))
      .expect(404);
  });
});
