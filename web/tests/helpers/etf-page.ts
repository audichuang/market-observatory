import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { transformSync } from "oxc-transform-react";
import type { Props } from "../../pages/etfs.server.ts";
import * as etfCopy from "../../src/lib/etf-copy.ts";
import { planIssue } from "../../src/lib/plan.ts";
import { DEFAULT_PLAN } from "../../src/server/views.ts";
import { compactUsd, num, pctText } from "../../src/ui/format.ts";

export interface Element { type: unknown; props: Record<string, unknown> & { children: unknown[] } }
const h = (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]): Element => ({ type, props: { ...props, children } });
export const nodes = (value: unknown): Element[] => {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Element;
  return [node, ...nodes(node.props.children)];
};

export function pageText(value: unknown): string {
  if (Array.isArray(value)) return value.map(pageText).join("");
  if (value && typeof value === "object" && "props" in value) return pageText((value as Element).props.children);
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

export function pageWithAction(action: () => Promise<unknown> = async () => ({ ok: true }), props: Partial<Props> = {}) {
  // Execute the actual page and its click handler; only framework hooks and transport are supplied by the test.
  const source = readFileSync(new URL("../../pages/etfs.tsx", import.meta.url), "utf8");
  const compiled = transformSync("etfs.tsx", source, { reactCompiler: false, jsx: { runtime: "classic", pragma: "h", pragmaFrag: "Fragment" } });
  assert.deepEqual(compiled.errors, []);
  const code = compiled.code.replace(/^import[^;]+;\s*/gm, "").replace("export default function EtfPage", "function EtfPage");
  const state: unknown[] = [];
  let index = 0;
  const visits: unknown[] = [];
  const useState = (initial: unknown) => {
    const slot = index++;
    if (!(slot in state)) state[slot] = initial;
    return [state[slot], (value: unknown) => { state[slot] = value; }];
  };
  const defaults: Props = {
    asOf: "2026-10-28", catalogAsOf: "2026-10-24", rows: [], periods: [], plan: DEFAULT_PLAN,
    sim: { etf: "VOO", years: 3, monthlyTwd: 1500, startDate: "2023-10-29" }, dca: null, fxLast: null,
  };
  let currentProps = { ...defaults, ...props };
  // Keep every runtime import in pages/etfs.tsx available to the compiled page.
  const imports = {
    h, Fragment: Symbol("Fragment"), useState, useEffect: () => {},
    useRouter: () => ({ visit: (url: unknown) => visits.push(url) }),
    useForm: () => ({ data: currentProps.plan, pending: false, hasChanges: false }),
    action, Form: "form", Link: "a", LineChart: "chart", Delta: "delta", num, compactUsd, pctText, planIssue,
    ...etfCopy,
  };
  const factory = new Function(...Object.keys(imports), `${code}\nreturn EtfPage;`);
  const page = factory(...Object.values(imports)) as (props: Props) => Element;
  return {
    visits,
    render(overrides: Partial<Props> = {}) {
      index = 0;
      currentProps = { ...defaults, ...props, ...overrides };
      return page(currentProps);
    },
  };
}
