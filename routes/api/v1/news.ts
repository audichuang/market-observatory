import { defineHandler } from "void";
import { requireViewer } from "../../../src/server/account.ts";
import { newsView } from "../../../src/server/views.ts";

// ?symbol=NVDA 只看一家；不帶時是自己名單上的公司加大盤（SPY）。
export const GET = defineHandler(async (c) => newsView(c, requireViewer(c)));
