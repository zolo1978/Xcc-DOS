import { Injectable } from '@nestjs/common';
import { TenantContext } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async getBossDashboard() {
    const tenantId = this.tenantContext.getTenantId();
    const [goals, openCases, approvedPlans, openExceptions] = await Promise.all([
      this.prisma.goal.count({
        where: { orgId: tenantId, deletedAt: null },
      }),
      this.prisma.decisionCase.count({
        where: {
          deletedAt: null,
          status: 'open',
          problem: {
            is: {
              deletedAt: null,
              goal: {
                is: {
                  orgId: tenantId,
                  deletedAt: null,
                },
              },
            },
          },
        },
      }),
      this.prisma.plan.count({
        where: {
          deletedAt: null,
          status: 'approved',
          decisionCase: {
            is: {
              deletedAt: null,
              problem: {
                is: {
                  deletedAt: null,
                  goal: {
                    is: {
                      orgId: tenantId,
                      deletedAt: null,
                    },
                  },
                },
              },
            },
          },
        },
      }),
      this.prisma.exception.count({
        where: {
          deletedAt: null,
          status: {
            in: ['open', 'acknowledged'],
          },
          owner: {
            is: {
              orgId: tenantId,
              deletedAt: null,
            },
          },
        },
      }),
    ]);

    return {
      tenantId,
      metrics: {
        goals,
        openCases,
        approvedPlans,
        openExceptions,
      },
    };
  }
}
