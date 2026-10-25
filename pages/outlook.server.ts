import { defineHandler, defineHead, type InferProps } from "void";
import { outlookView } from "../src/server/outlook.ts";

export type Props = InferProps<typeof loader>;

export const loader = defineHandler(async (c) => outlookView(c));

export const head = defineHead(() => ({ title: "下月展望" }));
