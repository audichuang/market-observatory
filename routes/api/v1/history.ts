import { defineHandler } from "void";
import { requireViewer } from "../../../src/server/account.ts";
import { historyView } from "../../../src/server/views.ts";

// ?symbol=SPX&months=12
export const GET = defineHandler(async (c) => historyView(c, requireViewer(c)));
