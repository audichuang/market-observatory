import { useEffect, useMemo, useRef, useState } from "react";
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
  /** 在 y=0 畫一條基準線（報酬率圖用） */
  zeroLine?: boolean;
  /** 伺服器端算圖時的預設寬度；瀏覽器端會改用容器的實際寬度 */
  width?: number;
}

const PAD = { top: 12, right: 64, bottom: 26, left: 8 };

export default function LineChart({ lines, height: maxHeight = 300, digits = 2, suffix = "", zeroLine = false, width: defaultWidth = 900 }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  // 依容器實際寬度畫圖：viewBox 跟顯示寬度一樣，手機上座標文字才會是真的 11px，不會被等比例縮到看不見。
  const box = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(defaultWidth);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const update = () => el.clientWidth > 0 && setW(Math.round(el.clientWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const height = Math.min(maxHeight, Math.max(200, Math.round(W * 0.62)));
  const dates = useMemo(() => {
    const set = new Set<string>();
    for (const l of lines) for (const p of l.points) set.add(p.date);
    return [...set].sort();
  }, [lines]);
  const lookup = useMemo(() => lines.map((l) => new Map(l.points.map((p) => [p.date, p.value]))), [lines]);
  const values = lines.flatMap((l) => l.points.map((p) => p.value)).filter((v): v is number => v !== null && Number.isFinite(v));
  if (dates.length < 2 || !values.length) return <div ref={box}><p className="sub">資料不足，無法繪圖。</p></div>;

  let min = Math.min(...values, ...(zeroLine ? [0] : []));
  let max = Math.max(...values, ...(zeroLine ? [0] : []));
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  min -= span * 0.05;
  max += span * 0.05;
  const innerW = W - PAD.left - PAD.right;
  const innerH = height - PAD.top - PAD.bottom;
  const x = (i: number) => PAD.left + (i / (dates.length - 1)) * innerW;
  const y = (v: number) => PAD.top + (1 - (v - min) / (max - min)) * innerH;

  const ticks = Array.from({ length: 5 }, (_, i) => min + ((max - min) * i) / 4);
  const xTickEvery = Math.max(1, Math.round(dates.length / (W < 500 ? 4 : 6)));
  // 不到半年的區間用「月-日」，否則用「年-月」，避免整排標籤都一樣。
  const shortSpan = Date.parse(dates.at(-1)!) - Date.parse(dates[0]) < 183 * 86400000;

  const paths = lines.map((l, li) => {
    let d = "";
    let pen = false;
    dates.forEach((date, i) => {
      const v = lookup[li].get(date);
      if (v === null || v === undefined) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  });

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((px - PAD.left) / innerW) * (dates.length - 1));
    setHover(Math.max(0, Math.min(dates.length - 1, i)));
  };

  const hi = hover ?? dates.length - 1;
  return (
    <div ref={box}>
      <div className="tooltip">
        <strong>{dates[hi]}</strong>{" "}
        {lines.map((l, li) => {
          const v = lookup[li].get(dates[hi]);
          return (
            <span key={l.name} style={{ marginLeft: ".7rem", color: l.color }}>
              {l.name} {v === null || v === undefined ? "—" : `${num(v, digits)}${suffix}`}
            </span>
          );
        })}
      </div>
      <svg className="chart" viewBox={`0 0 ${W} ${height}`} onPointerMove={onMove} onPointerLeave={() => setHover(null)} role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line className="grid-line" x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} />
            <text x={W - PAD.right + 6} y={y(t) + 4}>{num(t, digits)}{suffix}</text>
          </g>
        ))}
        {zeroLine && <line x1={PAD.left} x2={W - PAD.right} y1={y(0)} y2={y(0)} stroke="currentColor" strokeOpacity={0.35} />}
        {dates.map((d, i) =>
          i % xTickEvery === 0 ? (
            <text key={d} x={x(i)} y={height - 6} textAnchor={i === 0 ? "start" : i >= dates.length - xTickEvery ? "end" : "middle"}>
              {shortSpan ? d.slice(5) : d.slice(2, 7)}
            </text>
          ) : null,
        )}
        {paths.map((d, li) => (
          <path key={lines[li].name} d={d} fill="none" stroke={lines[li].color} strokeWidth={lines[li].dashed ? 1.3 : 1.8} strokeDasharray={lines[li].dashed ? "5 4" : undefined} />
        ))}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={height - PAD.bottom} stroke="currentColor" strokeOpacity={0.3} />}
      </svg>
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
