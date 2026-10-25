import { defineHandler } from "void";
import { requireViewer } from "../../../../../src/server/account.ts";
import { Budget } from "../../../../../src/lib/sources/http.ts";
import { aiFromEnv } from "../../../../../src/server/anthropic.ts";
import { AiHttpError, POINTS_BUDGET, newsPoints } from "../../../../../src/server/news-ai.ts";

// 使用者點「AI 重點」時才抓原文、請 Sonnet 整理成 3～5 點繁中，存進 news.points_zh；之後所有人直接讀快取。
export const POST = defineHandler(async (c) => {
  const v = requireViewer(c);
  const budget = new Budget(POINTS_BUDGET); // 抓原文與 Anthropic 請求共用一份
  try {
    return await newsPoints(c.env.DB, aiFromEnv(c.env, budget), v, c.req.param("id") ?? "", budget);
  } catch (e) {
    if (e instanceof AiHttpError) return c.json({ error: e.message }, e.status);
    throw e;
  }
});
