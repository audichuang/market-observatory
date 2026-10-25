import { defineHandler } from "void";
import { requireViewer } from "../../../src/server/account.ts";
import { PlanSchema, etfsView, savePlan } from "../../../src/server/views.ts";

// ?etf=VOO&years=3&monthly=10000 試算；不帶時用自己存的定投規劃。
export const GET = defineHandler(async (c) => etfsView(c, requireViewer(c)));

export const PUT = defineHandler.withValidator({ body: PlanSchema })(async (c, { body }) => {
  await savePlan(c.env.DB, requireViewer(c), body);
  return { saved: true };
});
