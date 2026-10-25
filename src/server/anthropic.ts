// Anthropic API 的呼叫（只在使用者打開畫面／點開文章時用，不在排程裡跑；見 src/server/news-ai.ts）。
// 官方 SDK 的 fetch 換成 fetchWithTimeout：每個請求（含 SDK 的重試、轉址）都先扣這次執行的 budget。
import Anthropic from "@anthropic-ai/sdk";
import { type Budget, fetchWithTimeout } from "../lib/sources/http.ts";

/** 標題翻譯與分類 */
export const HAIKU = "claude-haiku-5-5";
/** 單篇文章重點、每日公司重點 */
export const SONNET = "claude-sonnet-5-5";
export type AiModel = typeof HAIKU | typeof SONNET;

export interface AiRequest {
  model: AiModel;
  system: string;
  user: string;
  /** 結構化輸出的 JSON schema（物件要 additionalProperties: false） */
  schema: Record<string, unknown>;
  maxTokens: number;
}

/** 呼叫一次模型、回傳解析好的 JSON。 */
export interface Ai {
  json(req: AiRequest): Promise<unknown>;
}

/** 模型已經回應（HTTP 200）才發生的錯：拒絕、被截斷、空白、JSON 壞掉。這次呼叫已經計費，額度不能退回。 */
export class AiModelError extends Error {}

export class AiRefusalError extends AiModelError {
  constructor() {
    super("模型拒絕回答這則內容");
  }
}

const REQUEST_TIMEOUT_MS = 60_000;

export function createAi(apiKey: string, budget: Budget): Ai {
  const client = new Anthropic({
    apiKey,
    maxRetries: 1,
    fetch: (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const headers = init?.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : (init?.headers as Record<string, string> | undefined);
      return fetchWithTimeout("anthropic", url, { ...init, headers, budget, timeoutMs: REQUEST_TIMEOUT_MS, errorBody: true });
    },
  });
  return {
    async json(req) {
      const res = await client.messages.create({
        model: req.model,
        max_tokens: req.maxTokens,
        system: req.system,
        messages: [{ role: "user", content: req.user }],
        // 不送 temperature／top_p（新模型會 400）。Sonnet 5.5 不能送 thinking: disabled，只有 Haiku 可以。
        ...(req.model === HAIKU ? { thinking: { type: "disabled" as const } } : {}),
        output_config: { effort: "low", format: { type: "json_schema", schema: req.schema } },
      });
      if (res.stop_reason === "refusal") throw new AiRefusalError();
      if (res.stop_reason === "max_tokens") throw new AiModelError("模型回應被截斷");
      const text = res.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
      if (!text) throw new AiModelError("模型沒有回傳內容");
      try {
        return JSON.parse(text);
      } catch {
        throw new AiModelError("模型回傳的不是 JSON");
      }
    },
  };
}

export function aiFromEnv(env: { ANTHROPIC_API_KEY?: string }, budget: Budget): Ai | null {
  return env.ANTHROPIC_API_KEY ? createAi(env.ANTHROPIC_API_KEY, budget) : null;
}
