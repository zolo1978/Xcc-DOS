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

describe('Sprint 7 agent runtime integration', () => {
  let app: Awaited<ReturnType<typeof createIntApp>>['app'];
  let prisma: Awaited<ReturnType<typeof createIntApp>>['prisma'];
  let redis: RedisService;
  let seed: Awaited<ReturnType<typeof seedTenant>>;

  beforeAll(async () => {
    process.env.LLM_GATEWAY_URL = '';
    process.env.LLM_GATEWAY_KEY = '';
    process.env.LLM_MODEL = 'mock-sprint7';
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

  it('creates an agent-backed forecast using the mock gateway and stores the run trace', async () => {
    const ownerTokens = await login(app, 'owner@example.com');

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

    const hypothesis = await prisma.hypothesis.create({
      data: {
        caseId: caseResponse.body.id,
        content: 'Demand remains stable',
        evidenceScore: 75,
        confidence: 60,
      },
    });

    const response = await request(app.getHttpServer())
      .post(`/api/decision-cases/${caseResponse.body.id}/forecast`)
      .set(authHeaders(ownerTokens.accessToken, seed.org.id))
      .send({
        hypothesisIds: [hypothesis.id],
      })
      .expect(201);

    expect(response.body.modelSource).toBe('agent:mock-sprint7');
    expect(response.body.agentRunId).toBeTruthy();
    expect(response.body.inputHypothesisIds).toEqual([hypothesis.id]);
    expect(response.body.scenarios.length).toBeGreaterThan(0);

    const persistedForecasts = await prisma.forecast.findMany({
      where: {
        caseId: caseResponse.body.id,
      },
      orderBy: {
        version: 'asc',
      },
    });
    expect(persistedForecasts).toHaveLength(1);
    expect(persistedForecasts[0]?.agentRunId).toBe(response.body.agentRunId);

    const agentRun = await prisma.agentRun.findFirst({
      where: {
        id: response.body.agentRunId,
      },
    });
    expect(agentRun?.status).toBe('succeeded');
    expect(agentRun?.output).toMatchObject({
      forecastId: persistedForecasts[0]?.id,
    });
  });
});
