import { defineHandler, defineHead, type InferProps } from "void";
import { requireViewer } from "../src/server/account.ts";
import { historyView } from "../src/server/views.ts";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => historyView(c, requireViewer(c)));

export const head = defineHead<Props>((_c, p) => ({ title: `${p.label} 走勢` }));
