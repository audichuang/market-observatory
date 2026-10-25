import { defineHandler } from "void";
import { outlookView } from "../../../src/server/outlook.ts";

export const GET = defineHandler(async (c) => outlookView(c));
