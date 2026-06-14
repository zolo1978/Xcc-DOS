import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Queue } from 'bullmq';
import * as argon2 from 'argon2';
import request from 'supertest';
import { AppModule } from '../app.module';
import { getOutboxDlqName, getOutboxQueueName } from '../common/redis/bullmq.config';
import { PrismaService } from '../prisma/prisma.service';

export async function createIntApp(): Promise<{
  app: INestApplication;
  prisma: PrismaService;
}> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  const app = moduleRef.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  await app.init();

  return {
    app,
    prisma: app.get(PrismaService),
  };
}

export async function truncateAll(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(`
    TRUNCATE TABLE
      outbox_consumed,
      outbox_events,
      idempotency_keys,
      feedbacks,
      tasks,
      plans,
      roi_simulations,
      evaluations,
      forecasts,
      hypotheses,
      decision_cases,
      problems,
      goals,
      exceptions,
      standards,
      agent_runs,
      users,
      roles,
      organizations
    RESTART IDENTITY CASCADE
  `);
}

export async function seedTenant(prisma: PrismaService) {
  const org = await prisma.organization.create({
    data: {
      name: 'Tenant A',
      type: 'company',
    },
  });

  const role = await prisma.role.create({
    data: {
      name: 'boss',
      permissions: ['*'],
    },
  });

  const approverRole = await prisma.role.create({
    data: {
      name: 'approver',
      permissions: ['approve'],
    },
  });

  const passwordHash = await argon2.hash('password123');

  const owner = await prisma.user.create({
    data: {
      orgId: org.id,
      roleId: role.id,
      name: 'Owner',
      email: 'owner@example.com',
      passwordHash,
    },
  });

  const approver = await prisma.user.create({
    data: {
      orgId: org.id,
      roleId: approverRole.id,
      name: 'Approver',
      email: 'approver@example.com',
      passwordHash,
    },
  });

  const otherOrg = await prisma.organization.create({
    data: {
      name: 'Tenant B',
      type: 'company',
    },
  });

  const outsider = await prisma.user.create({
    data: {
      orgId: otherOrg.id,
      roleId: role.id,
      name: 'Outsider',
      email: 'outsider@example.com',
      passwordHash,
    },
  });

  return { org, role, approverRole, owner, approver, otherOrg, outsider };
}

export async function login(
  app: INestApplication,
  email: string,
  password = 'password123',
) {
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ email, password });

  return response.body as { accessToken: string; refreshToken: string };
}

export function authHeaders(token: string, tenantId: string) {
  return {
    Authorization: `Bearer ${token}`,
    'X-Tenant-Id': tenantId,
  };
}

export async function drainQueues(): Promise<void> {
  const queue = new Queue(getOutboxQueueName(), {
    connection: {
      url: process.env.REDIS_URL,
      maxRetriesPerRequest: null,
    },
  } as never);
  const dlq = new Queue(getOutboxDlqName(), {
    connection: {
      url: process.env.REDIS_URL,
      maxRetriesPerRequest: null,
    },
  } as never);

  await Promise.all([
    queue.drain(true),
    queue.obliterate({ force: true }),
    dlq.drain(true),
    dlq.obliterate({ force: true }),
  ]);

  await Promise.all([queue.close(), dlq.close()]);
}
