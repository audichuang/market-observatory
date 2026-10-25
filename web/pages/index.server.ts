import { defineHandler, defineHead, type InferProps } from "void";
import { requireViewer } from "../src/server/account.ts";
import { overviewView } from "../src/server/views.ts";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => overviewView(c, requireViewer(c)));

export const head = defineHead<Props>((_c, p) => ({ title: `市場總覽 ${p.snapshot?.tradeDate ?? ""}` }));
