import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

type AgentRunRecord = {
  id: string;
  agentType: string;
  triggerType: string;
  status: string;
  input: unknown;
  output: unknown;
  toolCalls: unknown;
  createdAt: Date;
  updatedAt: Date;
};

@Injectable()
export class AgentRunsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const records = await this.prisma.agentRun.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });

    return records.map((record: AgentRunRecord) => this.toResponse(record));
  }

  async trace(id: string) {
    const record = await this.findOne(id);

    return {
      ...this.toResponse(record),
      trace: {
        input: record.input,
        output: record.output,
        toolCalls: record.toolCalls,
      },
    };
  }

  async cancel(id: string) {
    const record = await this.findOne(id);

    if (record.status !== 'running') {
      return this.toResponse(record);
    }

    const updated = await this.prisma.agentRun.update({
      where: {
        id,
      },
      data: {
        status: 'cancelled',
      },
    });

    return this.toResponse(updated);
  }

  private async findOne(id: string): Promise<AgentRunRecord> {
    const record = await this.prisma.agentRun.findFirst({
      where: {
        id,
      },
    });

    if (!record) {
      throw new NotFoundException('AGENT_RUN_NOT_FOUND');
    }

    return record;
  }

  private toResponse(record: AgentRunRecord) {
    return {
      id: record.id,
      agentType: record.agentType,
      triggerType: record.triggerType,
      status: record.status,
      input: record.input,
      output: record.output,
      toolCalls: record.toolCalls,
      createdAt: record.createdAt.toISOString(),
      updatedAt: record.updatedAt.toISOString(),
    };
  }
}
