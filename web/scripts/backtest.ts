// 預測模型回測：在本機用 Cboe 日線跑 forecast.ts 的 walk-forward，所有模型邏輯都來自 src/lib，這裡只負責取資料與排版。
//   node scripts/backtest.ts [--variant base,...] [--target up] [--since YYYY-MM-DD] [--prod-window] [--as-of YYYY-MM-DD] [--offline] [--json] [--null]
// --prod-window：起點 = as-of 往前 3660 天，與正式站（jobs.ts backfill）目前保存的歷史一致。
// 事前登記已合併，可跑全歷史（docs/forecast.md）。第一個變體是參考；SENSITIVITY 內的變體只印在「敏感度（不用於決策）」。
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { Series } from "../src/lib/analytics.ts";
import { addDays } from "../src/lib/calendar.ts";
import { EVAL_SEED, DEFAULT_MODEL, SEASON_MODEL, VRP_MODEL, HORIZON, MIN_EFFECTIVE_N, MIN_EPISODES, VIX_STRESS, buildObservations, buildOutlook, evaluateRows, type ModelConfig, type WalkRow } from "../src/lib/forecast.ts";
import { EVAL_DEFAULTS, PHASES, bootstrapCI, brierOf, bssOf, intersectRegimes, mcStdErr, nullPairedBss, pairedBrierDiffMcStdErr, pairedBrierDiffPhase, pairedMcStdErr, pairedPhaseAveraged, phaseAverageFromCells, phaseCells, phaseGrid, pointInTimeCalls } from "../src/lib/forecast-eval.ts";
import { CBOE_URLS, parseCboeCsv } from "../src/lib/sources/cboe.ts";

// 變體登錄：base／shrink40 = 現行 DEFAULT_MODEL（G01 k=40 + G03 + G08）；hard = G01 之前的硬切換；shrink20／shrink80 只做敏感度；
// pre-g03 = G03／G08 之前的預設（同一組 p；舊區塊 bootstrap 3/1000；方向閘門用舊規則：distinct 且全域 bssLow > 0，見 legacyCalls），只供記錄對照。
const VARIANTS: Record<string, ModelConfig> = {
  base: DEFAULT_MODEL,
  vrp: VRP_MODEL,
  season: SEASON_MODEL,
  "pre-g03": { ...DEFAULT_MODEL, version: "2026-10-g01", bootstrap: { kind: "block", blockSize: 3, resamples: 1000 } },
  hard: { ...DEFAULT_MODEL, version: "2026-10-g04", shrinkK: null },
  shrink40: DEFAULT_MODEL,
  shrink20: { ...DEFAULT_MODEL, version: "2026-10-g04+shrink20", shrinkK: 20 },
  shrink80: { ...DEFAULT_MODEL, version: "2026-10-g04+shrink80", shrinkK: 80 },
};
/** G03 之前的方向閘門（point-in-time）：distinct 且 prior 列（至少 12 列）的全域 bssLow > 0；只用在 pre-g03 對照。 */
function legacyCalls(rows: WalkRow[], knownOn: Map<string, string | null>, cfg: ModelConfig): ("up" | "down" | "inconclusive")[] {
  return rows.map((r) => {
    const prior = rows.filter((x) => {
      const k = knownOn.get(x.date);
      return k !== null && k !== undefined && k <= r.date;
    });
    if (prior.length < 12 || !r.distinct) return "inconclusive";
    const low = evaluateRows(prior, cfg.bootstrap).bssLow;
    return low !== null && low > 0 ? (r.p >= 0.5 ? "up" : "down") : "inconclusive";
  });
}
const SENSITIVITY = new Set(["shrink20", "shrink80"]);
// 目標登錄：up = 21 日後收高；dd5 = D4 回撤標籤（forecast.ts 的 label 選項）。dd5 的方向計數沒有意義，略過。
const TARGETS = ["up", "dd5"] as const;

const { values: args } = parseArgs({
  options: {
    variant: { type: "string", default: "base" },
    target: { type: "string", default: "up" },
    since: { type: "string" },
    "prod-window": { type: "boolean", default: false },
    "as-of": { type: "string" },
    offline: { type: "boolean", default: false },
    json: { type: "boolean", default: false },
    null: { type: "boolean", default: false },
  },
});

const target = args.target as (typeof TARGETS)[number];
if (!TARGETS.includes(target)) throw new Error(`目標 ${args.target} 尚未支援（可用：${TARGETS.join("、")}）`);
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
    bootstrap: { evaluateRows: "依 cfg.bootstrap（DEFAULT = G08 stationary；pre-g03 = 舊區塊法）；cell／MDE 一律 G08 stationary", stationary: boot },
    mcSeeds: [1, 2, 3, 4, 5],
  },
};

const fmt = (x: number | null | undefined, d = 3) => (x === null || x === undefined || Number.isNaN(x) ? "n/a" : x.toFixed(d));
const ci = (p: number, l: number, h: number) => `${fmt(p)} [${fmt(l)}, ${fmt(h)}]`;
const lines: string[] = [];
const mainLines: string[] = [];
const sensLines: string[] = [];
const h = out.header as { csv: Record<string, { range: string; sha256: string }> };
lines.push(`SPX ${h.csv.SPX.range} sha256 ${h.csv.SPX.sha256}`, `VIX ${h.csv.VIX.range} sha256 ${h.csv.VIX.sha256}`);
lines.push(`模型 ${names.map((n) => `${n}=${VARIANTS[n].version}`).join(" ")}`);
lines.push(`as-of ${asOf}；窗口起點 ${since}${args["prod-window"] ? "（prod-window）" : ""}；目標 ${target}`);
lines.push(`常數 HORIZON=${HORIZON} MIN_EFFECTIVE_N=${MIN_EFFECTIVE_N} VIX_STRESS=${VIX_STRESS} burnIn=504 相位=${PHASES}`);
lines.push(`stationary bootstrap：平均區塊 ${boot.meanBlock}、${boot.resamples} 次、種子 ${boot.seed}；MC 種子 1..5`);

const results: Record<string, unknown>[] = [];
const refName = names[0];
const refCfg = VARIANTS[refName];
const refObsRaw = buildObservations(spx, vix, refCfg);
const fixedSeed = boot.seed;
for (const name of names) {
  const cfg = VARIANTS[name];
  // 配對時訓練樣本取兩者 regime 的交集；參考變體本身不動。
  const rawObs = name === refName ? refObsRaw : buildObservations(spx, vix, cfg);
  const obs = name === refName ? rawObs : intersectRegimes(refObsRaw, rawObs)[1];
  const historyStart = obs.find((o) => o.regime)?.date ?? null;
  // 主序列 = 相位 0 的格點（固定交易日格，與其他相位同一組格）
  const grid = phaseGrid(name === refName ? obs : intersectRegimes(refObsRaw, rawObs)[0]);
  const cells = phaseCells(obs, cfg, grid, target);
  const rows = cells[0].filter((r): r is NonNullable<typeof r> => r !== null);
  const ev = evaluateRows(rows, cfg.bootstrap);
  const st = bootstrapCI(rows, bssOf, boot);
  const phase = phaseAverageFromCells(cells, boot);
  const mc = mcStdErr((seed) => phaseAverageFromCells(cells, { ...boot, seed }).ci.low);
  // 方向計數：與 buildOutlook 同一個 G03 閘門（pre-g03 除外），每列只用當時已知的 walk-forward 列（point-in-time）。
  const knownOn = new Map(obs.map((o) => [o.date, o.knownOn]));
  const calls = { up: 0, down: 0, inconclusive: 0 };
  if (target === "up") for (const c of name === "pre-g03" ? legacyCalls(rows, knownOn, cfg) : pointInTimeCalls(rows, knownOn)) calls[c]++;
  const cellsSummary = ev.byCell;
  const paired = name === refName ? null : pairedPhaseAveraged(refObsRaw, rawObs, refCfg, cfg, { ...boot, label: target });
  const pairedMc = paired && pairedMcStdErr(refObsRaw, rawObs, refCfg, cfg, { ...boot, label: target });
  const entry: Record<string, unknown> = { variant: name, version: cfg.version, historyStart, rows: rows.length, first: ev.firstDate, last: ev.lastDate, evaluation: ev, stationary: st, brier: brierOf(rows), hitRate: ev.hitRate, calls, phase: { mean: phase.mean, min: phase.min, max: phase.max, ci: phase.ci, byPhase: phase.bssByPhase, cycles: phase.cycles }, mc, pairedMc, cells: cellsSummary, paired: paired && { mean: paired.mean, ci: paired.ci, min: paired.min, max: paired.max, cycles: paired.cycles } };
  if (args.null && paired) {
    const nul = nullPairedBss(refObsRaw, rawObs, refCfg, cfg, { label: target });
    entry.nullThreshold = nul;
  }
  const pairedDiff = name === refName ? null : pairedBrierDiffPhase(refObsRaw, rawObs, refCfg, cfg, { ...boot, label: target });
  const pairedDiffMc = pairedDiff && pairedBrierDiffMcStdErr(refObsRaw, rawObs, refCfg, cfg, { ...boot, label: target });
  entry.pairedBrierDiff = pairedDiff && { mean: pairedDiff.mean, ci: pairedDiff.ci, cycles: pairedDiff.cycles, mc: pairedDiffMc };
  results.push(entry);

  const lines = SENSITIVITY.has(name) ? sensLines : mainLines;
  lines.push("", `== 變體 ${name}（${cfg.version}）history_start ${historyStart}`);
  lines.push(`列數 ${rows.length}（${ev.firstDate} .. ${ev.lastDate}）`);
  lines.push(`BSS evaluateRows（${cfg.bootstrap.kind}）${ci(ev.bss ?? NaN, ev.bssLow ?? NaN, ev.bssHigh ?? NaN)}；stationary ${ci(st.point, st.low, st.high)}；MDE ${fmt(ev.mde)}`);
  lines.push(`Brier ${fmt(ev.brier, 4)}（基準 ${fmt(ev.brierBase, 4)}）；命中率 ${fmt(ev.hitRate)}（永遠看漲 ${fmt(ev.baseHitRate)}）`);
  if (target === "up") lines.push(`方向（point-in-time）up ${calls.up} / down ${calls.down} / inconclusive ${calls.inconclusive}`);
  if (target === "dd5") {
    // G09 採用判定的輸入（機械判定）：dd5 walk-forward 全域 bssLow > 0 且今天所用 cell nEff ≥ 30、段數 ≥ 8。
    const o = buildOutlook(spx, vix, cfg);
    if (!o) lines.push("G09 判定輸入：buildOutlook 算不出來（資料不足）");
    else {
      const d = o.drawdown;
      const used = d.pick.conditional ?? d.pick.base;
      lines.push(`G09 判定輸入（as-of ${o.asOf}，正式版 walkForward）：全域 bssLow ${fmt(d.evaluation.bssLow)}（BSS ${fmt(d.evaluation.bss)}，列數 ${d.evaluation.points}）；格點相位 0 的 bssLow ${fmt(ev.bssLow)}`);
      lines.push(`  今天所用 cell ${d.pick.cell}：nEff ${fmt(used.nEff, 1)}、段數 ${used.episodes}（門檻 ${MIN_EFFECTIVE_N}／${MIN_EPISODES}）；P(dd5) ${fmt(d.pick.p, 4)}（基準 ${fmt(d.pick.base.p, 4)}，條件 ${fmt(d.pick.conditional?.p, 4)}）`);
      lines.push(`  cellGate 列數 ${d.cellGate.rows} 段數 ${d.cellGate.runs} bssLow ${fmt(d.cellGate.bssLow)}（G03，僅參考）；scored = ${d.scored}`);
      const q = o.returnQuantiles;
      if (q.cell) lines.push(`  21 日報酬分位數 cell：p10 ${fmt(q.cell.p10, 4)} p50 ${fmt(q.cell.p50, 4)} p90 ${fmt(q.cell.p90, 4)}（n ${q.cell.n}）`);
      if (q.all) lines.push(`  21 日報酬分位數 全部：p10 ${fmt(q.all.p10, 4)} p50 ${fmt(q.all.p50, 4)} p90 ${fmt(q.all.p90, 4)}（n ${q.all.n}）`);
    }
  }
  lines.push(`相位平均 BSS ${ci(phase.mean, phase.ci.low, phase.ci.high)}（各相位 ${fmt(phase.min)} ~ ${fmt(phase.max)}）；格 ${phase.cycles.used}/${phase.cycles.total}，捨去 ${phase.cycles.dropped}`);
  lines.push(`下界 MC 標準誤（standalone，相位平均 BSS 的下界）${fmt(mc.se, 4)}（種子 1..5：${mc.values.map((v) => fmt(v)).join(", ")}；決策用種子 ${fixedSeed}）`);
  lines.push("cell                                  列數  段數  BSS [CI]                      MDE    有效重抽");
  for (const b of cellsSummary) lines.push(`${b.cell.padEnd(36)} ${String(b.rows).padStart(4)} ${String(b.runs).padStart(5)}  ${ci(b.bss, b.bssLow ?? NaN, b.bssHigh ?? NaN).padEnd(28)} ${fmt(b.mde)}  ${b.validReplicates}`);
  if (paired) lines.push(`配對相位平均 BSS（${name} vs ${refName}）${ci(paired.mean, paired.ci.low, paired.ci.high)}；格 ${paired.cycles.used}/${paired.cycles.total}，捨去 ${paired.cycles.dropped}`);
  if (pairedDiff) lines.push(`配對相位平均 Brier 差（${name} − ${refName}，> 0 表示 ${name} 較差）${fmt(pairedDiff.mean, 5)} [${fmt(pairedDiff.ci.low, 5)}, ${fmt(pairedDiff.ci.high, 5)}]；格 ${pairedDiff.cycles.used}/${pairedDiff.cycles.total}；差的下界 MC 標準誤（種子 1..5 的 sd）${fmt(pairedDiffMc!.se, 5)}（${pairedDiffMc!.values.map((v) => fmt(v, 5)).join(", ")}）`);
  if (pairedMc) lines.push(`配對下界 MC 標準誤（決策用，種子 1..5 的 sd）${fmt(pairedMc.se, 4)}（${pairedMc.values.map((v) => fmt(v)).join(", ")}）；|下界| < 2×SE 視為不確定`);
  if (entry.nullThreshold) {
    const nt = entry.nullThreshold as { values: number[]; threshold: number };
    lines.push(`L08 虛無值（${nt.values.length} 組，種子 ${EVAL_SEED}+j）${nt.values.map((v) => fmt(v, 4)).join(", ")}`);
    lines.push(`L08 虛無門檻（20 組最大值）${fmt(nt.threshold)}`);
  }
}
if (args.null && names.length < 2) mainLines.push("", "--null 需要至少兩個變體（參考 + 候選）；略過");
lines.push(...mainLines, "", "== 敏感度（不用於決策）", ...(sensLines.length ? sensLines : ["（本次未跑）"]));
out.results = results;

console.log(args.json ? JSON.stringify(out, null, 2) : lines.join("\n"));
