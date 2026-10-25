import { defineHandler, defineHead, type InferProps } from "void";
import { requireViewer } from "../src/server/account.ts";
import { PlanSchema, etfsView, savePlan } from "../src/server/views.ts";

export type Props = InferProps<typeof loader>;
export { DEFAULT_PLAN, type Plan } from "../src/server/views.ts";

export const loader = defineHandler(async (c) => etfsView(c, requireViewer(c)));

export const action = defineHandler.withValidator({ body: PlanSchema })(async (c, { body }) => {
  await savePlan(c.env.DB, requireViewer(c), body);
});

export const head = defineHead(() => ({ title: "ETF 與定投" }));
