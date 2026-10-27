import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { transformSync } from "oxc-transform-react";
import { planIssue } from "../src/lib/plan.ts";
import { DEFAULT_PLAN } from "../src/server/views.ts";

interface Element { type: unknown; props: Record<string, unknown> & { children: unknown[] } }
const h = (type: unknown, props: Record<string, unknown> | null, ...children: unknown[]): Element => ({ type, props: { ...props, children } });
const nodes = (value: unknown): Element[] => {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Element;
  return [node, ...nodes(node.props.children)];
};

function pageWithAction(action: () => Promise<unknown>) {
  // Execute the actual page and its click handler; only framework hooks and transport are supplied by the test.
  const source = readFileSync(new URL("../pages/etfs.tsx", import.meta.url), "utf8");
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
  const factory = new Function("h", "Fragment", "useState", "useEffect", "useRouter", "useForm", "action", "Form", "Link", "LineChart", "Delta", "num", "compactUsd", "pctText", "planIssue", `${code}\nreturn EtfPage;`);
  const page = factory(h, Symbol("Fragment"), useState, () => {}, () => ({ visit: (url: unknown) => visits.push(url) }), () => ({ data: DEFAULT_PLAN, pending: false, hasChanges: false }), action, "form", "a", "chart", "delta", String, String, String, planIssue) as (props: unknown) => Element;
  return {
    visits,
    render() {
      index = 0;
      return page({ asOf: "2026-10-28", catalogAsOf: "2026-10-24", rows: [], periods: [], plan: DEFAULT_PLAN, sim: { etf: "VOO", years: 3, monthlyTwd: 1500 }, dca: null, fxLast: null });
    },
  };
}

for (const [status, message] of [[400, "每月金額至少 1 元"], [401, "登入狀態已過期，請重新登入"]] as const) {
  test(`儲存預設的 HTTP ${status} 顯示伺服器具體錯誤`, async () => {
    const ui = pageWithAction(async () => ({ ok: false, error: { status, body: { error: message } } }));
    const button = nodes(ui.render()).find((n) => n.type === "button" && n.props.children.includes("設為我的預設"));
    assert.ok(button);
    await (button.props.onClick as () => Promise<void>)();
    const alert = nodes(ui.render()).find((n) => n.type === "p" && n.props.role === "alert");
    assert.equal(alert?.props.children.join(""), message);
    assert.deepEqual(ui.visits, [], "失敗時不能導覽或顯示已儲存");
  });
}

test("儲存預設拋出的網路錯誤仍解除 busy 並顯示可見錯誤", async () => {
  const ui = pageWithAction(async () => { throw new Error("連線中斷"); });
  const button = nodes(ui.render()).find((n) => n.type === "button" && n.props.children.includes("設為我的預設"));
  assert.ok(button);
  await (button.props.onClick as () => Promise<void>)();
  const result = nodes(ui.render());
  assert.equal(result.find((n) => n.type === "p" && n.props.role === "alert")?.props.children.join(""), "操作失敗：連線中斷");
  assert.equal(result.find((n) => n.type === "button" && n.props.children.includes("設為我的預設"))?.props.disabled, false);
});
