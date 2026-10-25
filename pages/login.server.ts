import { defineHandler, defineHead, type InferProps } from "void";
import { safeNext } from "../src/lib/safe-next.ts";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => {
  if (c.get("user")) return c.redirect(safeNext(c.req.query("next")));
  return { next: safeNext(c.req.query("next")) };
});

export const head = defineHead(() => ({ title: "登入" }));
