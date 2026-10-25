import { defineHandler, defineHead, type InferProps } from "void";
import { requireViewer } from "../src/server/account.ts";
import { newsView } from "../src/server/views.ts";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => newsView(c, requireViewer(c)));

export const head = defineHead(() => ({ title: "新聞與日曆" }));
