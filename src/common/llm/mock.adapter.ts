import {
  LlmChatOptions,
  LlmChatResult,
  LlmGatewayPort,
  LlmMessage,
} from './llm-gateway.port';

export class MockLlmAdapter implements LlmGatewayPort {
  constructor(private readonly model = process.env.LLM_MODEL || 'mock-llm') {}

  async chat(messages: LlmMessage[], opts?: LlmChatOptions): Promise<LlmChatResult> {
    const operation = String(opts?.metadata?.operation || 'generic');
    const payload = this.buildPayload(operation, opts?.metadata || {}, messages);

    return {
      model: opts?.model || this.model,
      usage: {
        promptTokens: 32,
        completionTokens: 24,
        totalTokens: 56,
      },
      content: JSON.stringify(payload),
    };
  }

  private buildPayload(
    operation: string,
    metadata: Record<string, unknown>,
    messages: LlmMessage[],
  ) {
    switch (operation) {
      case 'breakdown':
        return {
          summary: this.extractTitle(messages, 'Break down the goal'),
          dimensions: ['objective', 'constraint', 'owner'],
          constraints: ['budget', 'timebox'],
        };
      case 'decompose':
        return {
          summary: this.extractTitle(messages, 'Decompose the problem'),
          factors: ['root_cause', 'stakeholder', 'dependency'],
          assumptions: ['baseline remains stable'],
        };
      case 'forecast':
        return {
          scenarios: [
            {
              name: 'base',
              probability: 0.6,
              outcome: 'steady progress',
              impact: 'medium',
              assumptions: 'Demand remains stable',
            },
            {
              name: 'upside',
              probability: 0.25,
              outcome: 'faster adoption',
              impact: 'high',
              assumptions: 'Execution accelerates',
            },
          ],
          confidence: 0.82,
        };
      case 'evaluate': {
        const manual = (metadata.manualInput as Record<string, unknown> | undefined) || {};

        return {
          resourceScore: Number(manual.resourceScore ?? 82),
          timeScore: Number(manual.timeScore ?? 70),
          riskScore: Number(manual.riskScore ?? 55),
          feasibilityScore: Number(manual.feasibilityScore ?? 77),
          comment: String(manual.comment ?? 'Mock evaluation'),
        };
      }
      default:
        return {
          summary: this.extractTitle(messages, 'Mock response'),
        };
    }
  }

  private extractTitle(messages: LlmMessage[], fallback: string) {
    const text = messages.map((message) => message.content).join('\n');
    const titleMatch = text.match(/Title:\s*(.+)/i);

    return titleMatch?.[1]?.trim() || fallback;
  }
}
