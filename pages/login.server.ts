import { defineHandler, defineHead, type InferProps } from "void";
import { safeNext } from "../src/lib/safe-next.ts";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => {
  if (c.get("user")) return c.redirect(safeNext(c.req.query("next")));
  const row = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM user").first<{ n: number }>().catch(() => null);
  return { next: safeNext(c.req.query("next")), hasUser: (row?.n ?? 0) > 0, needsCode: Boolean(String(c.env.OWNER_SIGNUP_CODE ?? "").trim()) };
});

export const head = defineHead(() => ({ title: "登入" }));
