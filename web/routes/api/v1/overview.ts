import { defineHandler } from "void";
import { requireViewer } from "../../../src/server/account.ts";
import { overviewView } from "../../../src/server/views.ts";

// ?date=YYYY-MM-DD&rev=N 看指定交易日與版本，跟網頁總覽一樣。
export const GET = defineHandler(async (c) => overviewView(c, requireViewer(c)));
