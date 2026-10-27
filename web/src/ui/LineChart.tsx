import { useEffect, useMemo, useRef, useState } from "react";
import type { IChartApi, ISeriesApi, MouseEventParams, Time, DeepPartial, ChartOptions } from "lightweight-charts";
import { num } from "./format.ts";

export interface ChartLine {
  name: string;
  color: string;
  dashed?: boolean;
  /** 依日期遞增；value 為 null 代表該日不畫（例如均線暖機期） */
  points: { date: string; value: number | null }[];
}

interface Props {
  lines: ChartLine[];
  height?: number;
  digits?: number;
  suffix?: string;
  /** 在 y=0 畫一條基準線（報酬率圖用），且 y 軸範圍一定含 0 */
  zeroLine?: boolean;
  /** 舊 SVG 版的伺服器端預設寬度；canvas 版跟容器寬度走，保留只為相容 */
  width?: number;
}

type Lib = typeof import("./chartLib.ts");

// 從 CSS 變數取色，深淺色跟著 styles.css 的 prefers-color-scheme 走。
function themeOptions(el: HTMLElement, lib: Lib): DeepPartial<ChartOptions> {
  const css = getComputedStyle(el);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const line = v("--line", "#e3e6ea");
  return {
    layout: {
      background: { type: lib.ColorType.Solid, color: "transparent" },
      textColor: v("--muted", "#5f6873"),
      fontSize: 11,
    },
    grid: { vertLines: { visible: false }, horzLines: { color: line } },
    rightPriceScale: { borderColor: line },
    timeScale: { borderColor: line },
    crosshair: {
      vertLine: { color: v("--muted", "#5f6873"), labelBackgroundColor: v("--ink", "#161a1f") },
      horzLine: { color: v("--muted", "#5f6873"), labelBackgroundColor: v("--ink", "#161a1f") },
    },
  };
}

// 'YYYY-MM-DD' 字串進去，事件回來的 time 可能是字串或 BusinessDay 物件，兩種都轉回字串。
function timeKey(t: Time | undefined): string | null {
  if (t === undefined) return null;
  if (typeof t === "string") return t;
  if (typeof t === "number") return new Date(t * 1000).toISOString().slice(0, 10);
  return `${t.year}-${String(t.month).padStart(2, "0")}-${String(t.day).padStart(2, "0")}`;
}

export default function LineChart({ lines, height: maxHeight = 300, digits = 2, suffix = "", zeroLine = false }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<{ api: IChartApi; lib: Lib; alive: { current: boolean } } | null>(null);
  const [hoverDate, setHoverDate] = useState<string | null>(null);

  const dates = useMemo(() => {
    const set = new Set<string>();
    for (const l of lines) for (const p of l.points) set.add(p.date);
    return [...set].sort();
  }, [lines]);
  const lookup = useMemo(() => lines.map((l) => new Map(l.points.map((p) => [p.date, p.value]))), [lines]);
  const enough = dates.length >= 2 && lookup.some((m) => [...m.values()].some((v) => v !== null && Number.isFinite(v)));

  // 1) 建圖：只在瀏覽器、只建一次。動態 import 讓 server bundle 與首屏 chunk 都不含這個套件。
  useEffect(() => {
    if (!enough) return;
    let api: IChartApi | null = null;
    let disposed = false;
    // 卸載時 React 先跑這個 effect 的 cleanup（api.remove()），再跑 series 那個；之後再 removeSeries 會丟例外、整頁變空白。
    const alive = { current: true };
    let mq: MediaQueryList | null = null;
    let onScheme: (() => void) | null = null;
    import("./chartLib.ts").then((lib) => {
      const el = box.current;
      if (disposed || !el) return;
      api = lib.createChart(el, {
        autoSize: true, // 內建 ResizeObserver，容器尺寸由 CSS 決定
        ...themeOptions(el, lib),
        localization: { locale: "zh-TW", dateFormat: "yyyy-MM-dd" },
        // 手機：不攔截拖曳／捏合／滾輪，讓頁面照常上下捲；點一下或長按才出十字線
        handleScroll: false,
        handleScale: false,
        timeScale: { fixLeftEdge: true, fixRightEdge: true, lockVisibleTimeRangeOnResize: true },
        rightPriceScale: { scaleMargins: { top: 0.08, bottom: 0.08 } },
        crosshair: { mode: lib.CrosshairMode.Magnet },
        // 授權要求：保留 TradingView 連結。要關掉就得在頁面別處放 NOTICE 文字＋ tradingview.com 連結。
        layout: { ...themeOptions(el, lib).layout, attributionLogo: false /* 歸屬文字與連結放在頁尾（layout.tsx） */ },
      });
      mq = window.matchMedia("(prefers-color-scheme: dark)");
      onScheme = () => api?.applyOptions(themeOptions(el, lib));
      mq.addEventListener("change", onScheme);
      setChart({ api, lib, alive });
    });
    return () => {
      disposed = true;
      alive.current = false;
      if (mq && onScheme) mq.removeEventListener("change", onScheme);
      api?.remove(); // 釋放 canvas、ResizeObserver 與事件監聽
      setChart(null);
    };
  }, [enough]);

  // 2) 換資料：拆掉上一批 series 再建新的；圖本身不重建。
  useEffect(() => {
    if (!chart) return;
    const { api, lib, alive } = chart;
    const fmt = (v: number) => `${num(v, digits)}${suffix}`;
    const series: ISeriesApi<"Line">[] = lines.map((l, i) => {
      const s = api.addSeries(lib.LineSeries, {
        color: l.color,
        lineWidth: l.dashed ? 1 : 2, // 只接受整數 1~4
        lineStyle: l.dashed ? lib.LineStyle.Dashed : lib.LineStyle.Solid,
        priceLineVisible: false,
        lastValueVisible: !l.dashed,
        crosshairMarkerRadius: 3,
        // 內建 'percent' 的 precision 實測不可靠（precision 2 印出 −12.1%），一律用自訂 formatter
        priceFormat: { type: "custom", formatter: fmt, minMove: 10 ** -digits },
        // 讓自動縮放一定包含 0，基準線才不會跑出畫面
        autoscaleInfoProvider:
          zeroLine && i === 0
            ? (orig: () => { priceRange: { minValue: number; maxValue: number } | null } | null) => {
                const r = orig();
                if (!r?.priceRange) return r;
                return { ...r, priceRange: { minValue: Math.min(r.priceRange.minValue, 0), maxValue: Math.max(r.priceRange.maxValue, 0) } };
              }
            : undefined,
      });
      // null／NaN 不能當 value（development build 會 assert、production 會畫壞），轉成 whitespace
      s.setData(
        [...l.points]
          .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
          .filter((p, k, arr) => k === 0 || arr[k - 1].date !== p.date)
          .map((p) => (p.value === null || !Number.isFinite(p.value) ? { time: p.date } : { time: p.date, value: p.value })),
      );
      return s;
    });
    if (zeroLine && series[0]) series[0].createPriceLine({ price: 0, color: "rgba(128,128,128,.6)", lineWidth: 1, lineStyle: lib.LineStyle.Solid, axisLabelVisible: false, title: "" });
    api.timeScale().fitContent();
    const onMove = (p: MouseEventParams<Time>) => setHoverDate(p.point ? timeKey(p.time) : null);
    // 手機點一下不會觸發 crosshairMove（要長按才進追蹤模式），用 click 補：更新圖例並畫出十字線。
    // setCrosshairPosition 不會回頭觸發 crosshairMove，所以不會跟 onMove 打架。
    const onTap = (p: MouseEventParams<Time>) => {
      const key = timeKey(p.time);
      if (!key || p.time === undefined) return;
      setHoverDate(key);
      const d = series[0] && p.seriesData.get(series[0]);
      if (d && "value" in d) api.setCrosshairPosition(d.value, p.time, series[0]);
    };
    api.subscribeCrosshairMove(onMove);
    api.subscribeClick(onTap);
    return () => {
      if (!alive.current) return; // 整張圖已經 remove，series 跟著釋放了
      api.unsubscribeCrosshairMove(onMove);
      api.unsubscribeClick(onTap);
      for (const s of series) api.removeSeries(s);
      setHoverDate(null);
    };
  }, [chart, lines, digits, suffix, zeroLine]);

  if (!enough) return <div ref={box}><p className="sub">資料不足，無法繪圖。</p></div>;

  const hi = hoverDate && dates.includes(hoverDate) ? hoverDate : dates[dates.length - 1];
  return (
    <div>
      <div className="tooltip">
        <strong>{hi}</strong>{" "}
        {lines.map((l, li) => {
          const v = lookup[li].get(hi);
          return (
            <span key={l.name} style={{ marginLeft: ".7rem", color: "var(--ink)" }}>
              <i style={{ background: l.color }} aria-hidden />
              {l.name} {v === null || v === undefined ? "—" : `${num(v, digits)}${suffix}`}
            </span>
          );
        })}
      </div>
      {/* 高度＝寬度 × 0.62，夾在 200px 與 height 之間；SSR 時就佔好位置，hydrate 後不跳版 */}
      <div ref={box} className="chart" style={{ width: "100%", aspectRatio: "1 / 0.62", minHeight: 200, maxHeight, position: "relative" }} />
      <div className="legend">
        {lines.map((l) => (
          <span key={l.name}>
            <i style={{ background: l.color, opacity: l.dashed ? 0.7 : 1 }} />
            {l.name}
          </span>
        ))}
      </div>
    </div>
  );
}
