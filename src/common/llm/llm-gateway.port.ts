export type LlmMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type LlmUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type LlmChatOptions = {
  model?: string;
  temperature?: number;
  timeoutMs?: number;
  metadata?: Record<string, unknown>;
};

export type LlmChatResult = {
  content: string;
  usage: LlmUsage;
  model: string;
};

export interface LlmGatewayPort {
  chat(messages: LlmMessage[], opts?: LlmChatOptions): Promise<LlmChatResult>;
}

export const LLM_GATEWAY = Symbol('LLM_GATEWAY');
