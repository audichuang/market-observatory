// Workers AI 的模型呼叫（只在排程與後台 route 用；匯入 void/ai 讓部署時建立 AI 綁定）。
// 模型：GLM-5.3 Flash。2026-10-25 拿正式站的新聞比過 DeepSeek V4 Flash、Kimi K2.6、Qwen 3.8：
// 它的台灣用語自然、判斷「是否真的在講這家公司」最嚴格，成本只有 Kimi 的十分之一。關掉思考模式，否則 token 都花在推理上。
import { ai } from "void/ai";
import type { ChatMessage } from "../lib/news-ai.ts";
import type { Budget } from "../lib/sources/http.ts";
import type { Llm } from "./news-ai.ts";

export const NEWS_MODEL = "@cf/zai-org/glm-5.3-flash";

/** 有 AI 綁定（正式站、void dev）才回傳；本機單元測試沒有綁定，新聞 AI 工作會略過。 */
export function llmFromEnv(env: { AI?: unknown }): Llm | null {
  if (!env.AI) return null;
  return {
    model: NEWS_MODEL,
    async chat(messages: ChatMessage[], budget: Budget, maxTokens: number) {
      budget.take(`https://workers-ai.cloudflare/${NEWS_MODEL}`);
      const res = (await ai.run(NEWS_MODEL as never, {
        messages,
        max_tokens: maxTokens,
        temperature: 0.2,
        chat_template_kwargs: { enable_thinking: false, thinking: false },
      } as never)) as { response?: unknown; choices?: { message?: { content?: string | null } }[] };
      const text = typeof res.response === "string" ? res.response : (res.choices?.[0]?.message?.content ?? "");
      if (!text) throw new Error(`模型沒有回傳內容：${JSON.stringify(res).slice(0, 300)}`);
      return text;
    },
  };
}
