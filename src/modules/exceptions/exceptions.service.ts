import { Injectable, NotFoundException } from '@nestjs/common';
import { TenantContext } from '../../common/tenant/tenant-context.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ListExceptionsDto } from './dto/list-exceptions.dto';
import { UpdateExceptionStatusDto } from './dto/update-exception-status.dto';

@Injectable()
export class ExceptionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantContext: TenantContext,
  ) {}

  async list(query: ListExceptionsDto) {
    const tenantId = this.tenantContext.getTenantId();
    return this.prisma.exception.findMany({
      where: {
        deletedAt: null,
        ...(query.severity ? { severity: query.severity } : {}),
        ...(query.status ? { status: query.status } : {}),
        owner: {
          is: {
            orgId: tenantId,
            deletedAt: null,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async updateStatus(id: string, dto: UpdateExceptionStatusDto) {
    const tenantId = this.tenantContext.getTenantId();
    const exception = await this.prisma.exception.findFirst({
      where: {
        id,
        deletedAt: null,
        owner: {
          is: {
            orgId: tenantId,
            deletedAt: null,
          },
        },
      },
    });

    if (!exception) {
      throw new NotFoundException('EXCEPTION_NOT_FOUND');
    }

    return this.prisma.exception.update({
      where: { id },
      data: {
        status: dto.status,
      },
    });
  }
}
