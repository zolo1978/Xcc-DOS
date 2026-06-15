import {
  LlmChatOptions,
  LlmChatResult,
  LlmGatewayPort,
  LlmMessage,
} from './llm-gateway.port';

type OpenAiUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type OpenAiResponse = {
  model?: string;
  usage?: OpenAiUsage;
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

export class Sub2ApiAdapter implements LlmGatewayPort {
  constructor(
    private readonly url = process.env.LLM_GATEWAY_URL || '',
    private readonly apiKey = process.env.LLM_GATEWAY_KEY || '',
    private readonly model = process.env.LLM_MODEL || 'gpt-4o-mini',
    private readonly defaultTimeoutMs = 15_000,
  ) {}

  async chat(messages: LlmMessage[], opts?: LlmChatOptions): Promise<LlmChatResult> {
    if (!this.url) {
      throw new Error('LLM_GATEWAY_URL_MISSING');
    }

    if (!this.apiKey) {
      throw new Error('LLM_GATEWAY_KEY_MISSING');
    }

    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      opts?.timeoutMs ?? this.defaultTimeoutMs,
    );

    try {
      const response = await fetch(`${this.url.replace(/\/$/, '')}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: opts?.model || this.model,
          messages,
          temperature: opts?.temperature ?? 0.2,
          response_format: {
            type: 'json_object',
          },
        }),
        signal: controller.signal,
      });

      const payload = (await response.json().catch(() => ({}))) as OpenAiResponse;

      if (!response.ok) {
        throw new Error(payload.error?.message || `LLM_GATEWAY_HTTP_${response.status}`);
      }

      const content = this.extractContent(payload);

      if (!content) {
        throw new Error('LLM_GATEWAY_EMPTY_RESPONSE');
      }

      return {
        model: payload.model || opts?.model || this.model,
        usage: {
          promptTokens: payload.usage?.prompt_tokens ?? 0,
          completionTokens: payload.usage?.completion_tokens ?? 0,
          totalTokens: payload.usage?.total_tokens ?? 0,
        },
        content,
      };
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('LLM_GATEWAY_TIMEOUT');
      }

      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractContent(payload: OpenAiResponse) {
    const content = payload.choices?.[0]?.message?.content;

    if (typeof content === 'string') {
      return content;
    }

    if (Array.isArray(content)) {
      return content
        .map((item) => item.text || '')
        .join('')
        .trim();
    }

    return '';
  }
}
