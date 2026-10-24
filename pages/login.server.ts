import { defineHandler, defineHead, type InferProps } from "void";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => {
  if (c.get("user")) return c.redirect(safeNext(c.req.query("next")));
  const row = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM user").first<{ n: number }>().catch(() => null);
  return { next: safeNext(c.req.query("next")), hasUser: (row?.n ?? 0) > 0 };
});

export const head = defineHead(() => ({ title: "登入｜市場觀測室" }));

function safeNext(next: string | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
}
