// 預測模型回測：在本機用 Cboe 日線跑 forecast.ts 的 walk-forward，所有模型邏輯都來自 src/lib，這裡只負責取資料與排版。
//   node scripts/backtest.ts [--variant base,...] [--target up] [--since YYYY-MM-DD] [--prod-window] [--as-of YYYY-MM-DD] [--offline] [--json]
// --prod-window：起點 = as-of 往前 3660 天，與正式站（jobs.ts backfill）目前保存的歷史一致。
// 事前登記期間只允許用 --prod-window 驗證；全歷史回測要等登記合併後（docs/forecast.md）。
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { Series } from "../src/lib/analytics.ts";
import { addDays } from "../src/lib/calendar.ts";
import { DEFAULT_MODEL, HORIZON, MIN_EFFECTIVE_N, VIX_STRESS, buildObservations, callOf, evaluateRows, walkForwardRows, type ModelConfig } from "../src/lib/forecast.ts";
import { EVAL_DEFAULTS, PHASES, bootstrapCI, bssOf, brierOf, mcStdErr, pairedBrierDiff, phaseAveraged, summarizeByBasis } from "../src/lib/forecast-eval.ts";
import { CBOE_URLS, parseCboeCsv } from "../src/lib/sources/cboe.ts";

// 變體登錄：目前只有 base；新變體在登記合併後的票裡加。
const VARIANTS: Record<string, ModelConfig> = { base: DEFAULT_MODEL };
// 目標登錄：dd5 的標籤與計分在之後的票接上（forecast.ts 的 label 選項）。
const TARGETS = ["up"] as const;

const { values: args } = parseArgs({
  options: {
    variant: { type: "string", default: "base" },
    target: { type: "string", default: "up" },
    since: { type: "string" },
    "prod-window": { type: "boolean", default: false },
    "as-of": { type: "string" },
    offline: { type: "boolean", default: false },
    json: { type: "boolean", default: false },
  },
});

const target = args.target as (typeof TARGETS)[number];
if (!TARGETS.includes(target)) throw new Error(`目標 ${args.target} 尚未支援（目前只有 ${TARGETS.join("、")}；dd5 之後再接）`);
const names = args.variant!.split(",");
for (const n of names) if (!VARIANTS[n]) throw new Error(`沒有變體 ${n}（可用：${Object.keys(VARIANTS).join("、")}）`);

// 取資料並快取到 .backtest/
const CACHE = new URL("../.backtest/", import.meta.url);
mkdirSync(CACHE, { recursive: true });
async function load(which: keyof typeof CBOE_URLS): Promise<{ text: string; sha: string }> {
  const file = new URL(`${which}.csv`, CACHE);
  if (!args.offline) {
    const res = await fetch(CBOE_URLS[which], { headers: { "User-Agent": "market-observatory-backtest" } });
    if (!res.ok) throw new Error(`${which} CSV HTTP ${res.status}`);
    writeFileSync(file, await res.text());
  } else if (!existsSync(file)) throw new Error(`--offline 但沒有快取 ${file.pathname}`);
  const text = readFileSync(file, "utf8");
  return { text, sha: createHash("sha256").update(text).digest("hex") };
}
const [spxCsv, vixCsv] = [await load("SPX"), await load("VIX")];
const spxAll = parseCboeCsv(spxCsv.text);
const vixAll = parseCboeCsv(vixCsv.text);
const range = (bars: { date: string }[]) => `${bars[0].date}..${bars.at(-1)!.date}`;

const asOf = args["as-of"] ?? spxAll.at(-1)!.date;
const since = args.since ?? (args["prod-window"] ? addDays(asOf, -3660) : "0000-00-00");
const inWin = <T extends { date: string }>(bars: T[]) => bars.filter((b) => b.date >= since && b.date <= asOf);
const spx = new Series(inWin(spxAll).map((b) => ({ date: b.date, close: b.close })));
const vix = new Series(inWin(vixAll).map((b) => ({ date: b.date, close: b.close })));

const boot = { ...EVAL_DEFAULTS };
const out: Record<string, unknown> = {
  header: {
    csv: { SPX: { range: range(spxAll), sha256: spxCsv.sha }, VIX: { range: range(vixAll), sha256: vixCsv.sha } },
    models: names.map((n) => `${n}=${VARIANTS[n].version}`),
    window: { since, asOf, prodWindow: args["prod-window"], target },
    constants: { HORIZON, MIN_EFFECTIVE_N, VIX_STRESS, burnInDays: 504, phases: PHASES },
    bootstrap: { existing: "區塊 bootstrap（evaluateRows，區塊長依 cfg，種子依列數）", stationary: boot },
    mcSeeds: [1, 2, 3, 4, 5],
  },
};

const fmt = (x: number | null | undefined, d = 3) => (x === null || x === undefined || Number.isNaN(x) ? "n/a" : x.toFixed(d));
const ci = (p: number, l: number, h: number) => `${fmt(p)} [${fmt(l)}, ${fmt(h)}]`;
const lines: string[] = [];
const h = out.header as { csv: Record<string, { range: string; sha256: string }> };
lines.push(`SPX ${h.csv.SPX.range} sha256 ${h.csv.SPX.sha256}`, `VIX ${h.csv.VIX.range} sha256 ${h.csv.VIX.sha256}`);
lines.push(`模型 ${names.map((n) => `${n}=${VARIANTS[n].version}`).join(" ")}`);
lines.push(`as-of ${asOf}；窗口起點 ${since}${args["prod-window"] ? "（prod-window）" : ""}；目標 ${target}`);
lines.push(`常數 HORIZON=${HORIZON} MIN_EFFECTIVE_N=${MIN_EFFECTIVE_N} VIX_STRESS=${VIX_STRESS} burnIn=504 相位=${PHASES}`);
lines.push(`stationary bootstrap：平均區塊 ${boot.meanBlock}、${boot.resamples} 次、種子 ${boot.seed}；MC 種子 1..5`);

const results: Record<string, unknown>[] = [];
let refRows: ReturnType<typeof walkForwardRows> | null = null;
for (const name of names) {
  const cfg = VARIANTS[name];
  const obs = buildObservations(spx, vix, cfg);
  const historyStart = obs.find((o) => o.regime)?.date ?? null;
  const rows = walkForwardRows(obs, cfg, { label: target });
  const ev = evaluateRows(rows, cfg.bootstrap);
  const st = bootstrapCI(rows, bssOf, boot);
  const phase = phaseAveraged(obs, cfg, target, boot);
  const mc = mcStdErr((seed) => bootstrapCI(rows, bssOf, { ...boot, seed }).low);
  // 方向計數：與 buildOutlook 同一個閘門（callOf），每列用該列的 distinct／p 與整段 walk-forward 的 bssLow。
  const calls = { up: 0, down: 0, inconclusive: 0 };
  for (const r of rows) calls[callOf(r, ev.bssLow)]++;
  const basis = summarizeByBasis(rows, boot);
  const paired = refRows && name !== names[0] ? pairedBrierDiff(rows, refRows, boot) : null;
  refRows ??= rows;
  results.push({ variant: name, version: cfg.version, historyStart, rows: rows.length, first: ev.firstDate, last: ev.lastDate, evaluation: ev, stationary: st, brier: brierOf(rows), hitRate: ev.hitRate, calls, phase: { mean: phase.mean, min: phase.min, max: phase.max, ci: phase.ci, byPhase: phase.bssByPhase }, mc, basis, paired });

  lines.push("", `== 變體 ${name}（${cfg.version}）history_start ${historyStart}`);
  lines.push(`列數 ${rows.length}（${ev.firstDate} .. ${ev.lastDate}）`);
  lines.push(`BSS 區塊 bootstrap ${ci(ev.bss ?? NaN, ev.bssLow ?? NaN, ev.bssHigh ?? NaN)}；stationary ${ci(st.point, st.low, st.high)}`);
  lines.push(`Brier ${fmt(ev.brier, 4)}（基準 ${fmt(ev.brierBase, 4)}）；命中率 ${fmt(ev.hitRate)}（永遠看漲 ${fmt(ev.baseHitRate)}）`);
  lines.push(`方向 up ${calls.up} / down ${calls.down} / inconclusive ${calls.inconclusive}`);
  lines.push(`相位平均 BSS ${ci(phase.mean, phase.ci.low, phase.ci.high)}（各相位 ${fmt(phase.min)} ~ ${fmt(phase.max)}）`);
  lines.push(`bssLow MC 標準誤 ${fmt(mc.se, 4)}（5 種子：${mc.values.map((v) => fmt(v)).join(", ")}）`);
  lines.push("basis        列數  段數  BSS [CI]                      MDE");
  for (const b of basis) lines.push(`${b.basis.padEnd(12)} ${String(b.rows).padStart(4)} ${String(b.runs).padStart(5)}  ${ci(b.bss.point, b.bss.low, b.bss.high).padEnd(28)} ${fmt(b.mde)}`);
  if (paired) lines.push(`配對 Brier 差（${name} − ${names[0]}）${ci(paired.point, paired.low, paired.high)}；配對 ${paired.n} 列、丟掉 ${paired.dropped} 個日期`);
}
lines.push("", "== 敏感度（不用於決策）", "（尚無）");
out.results = results;

console.log(args.json ? JSON.stringify(out, null, 2) : lines.join("\n"));
