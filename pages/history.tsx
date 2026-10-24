import { Link, useRouter } from "@void/react";
import { MAG7 } from "../src/lib/universe.ts";
import LineChart from "../src/ui/LineChart.tsx";
import { Delta } from "../src/ui/bits.tsx";
import { num } from "../src/ui/format.ts";
import type { Props } from "./history.server";

const COLORS = ["#2456d6", "#d1343b", "#12884e", "#b26b00", "#7b3fd1", "#0f8a9d", "#c2417f", "#5c6b7a", "#8a6d00", "#333"];

export default function HistoryPage({ symbol, months, ranges, symbols, priceLine, mainStats, rebased, stats, contribution }: Props) {
  const router = useRouter();
  const label = Object.fromEntries(symbols)[symbol];
  const go = (s: string, m: number) => router.visit(`/history?symbol=${s}&months=${m}`);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>走勢與均線</h1>
          <p className="sub">日收盤（拆股調整、不含股息）。均線用更早的資料暖機後再截圖，不會因區間起點而失真。</p>
        </div>
        <label className="field" style={{ maxWidth: 220 }}>
          標的
          <select value={symbol} onChange={(e) => go(e.target.value, months)}>
            {symbols.map(([s, l]) => <option key={s} value={s}>{l === s ? s : `${l}（${s}）`}</option>)}
          </select>
        </label>
      </div>

      <div className="chips" style={{ marginBottom: "1rem" }}>
        {ranges.map((m) => (
          <Link key={m} href={`/history?symbol=${symbol}&months=${m}`} className={`chip ${m === months ? "active" : ""}`}>
            {m < 12 ? `${m} 個月` : `${m / 12} 年`}
          </Link>
        ))}
      </div>

      <div className="panel">
        <h2>
          {label} <span className="sub">{mainStats.first} ～ {mainStats.last}</span>
        </h2>
        <p className="sub">
          區間報酬 <Delta value={mainStats.ret} percent /> · 最大回撤 <Delta value={mainStats.mdd} percent />
        </p>
        <LineChart
          lines={[
            { name: label, color: "#2456d6", points: priceLine.map((p) => ({ date: p.date, value: p.close })) },
            { name: "SMA20", color: "#d1343b", dashed: true, points: priceLine.map((p) => ({ date: p.date, value: p.sma20 })) },
            { name: "SMA60", color: "#12884e", dashed: true, points: priceLine.map((p) => ({ date: p.date, value: p.sma60 })) },
            { name: "SMA200", color: "#b26b00", dashed: true, points: priceLine.map((p) => ({ date: p.date, value: p.sma200 })) },
          ]}
        />
      </div>

      <div className="panel section">
        <h2>七巨頭 vs S&amp;P 500 相對報酬</h2>
        <LineChart
          zeroLine
          suffix="%"
          digits={1}
          lines={rebased.map((r, i) => ({ name: r.symbol === "SPX" ? "S&P 500" : r.symbol, color: COLORS[i % COLORS.length], dashed: r.symbol === "RSP", points: r.points }))}
        />
        <div className="table-wrap" style={{ marginTop: "1rem" }}>
          <table>
            <thead>
              <tr><th>標的</th><th className="num">最新收盤</th><th className="num">區間報酬</th><th className="num">最大回撤</th><th className="num">年化波動</th></tr>
            </thead>
            <tbody>
              {stats.map((s) => (
                <tr key={s.symbol}>
                  <td><Link href={`/history?symbol=${s.symbol}&months=${months}`}>{s.label}</Link></td>
                  <td className="num">{num(s.close)}</td>
                  <td className="num"><Delta value={s.ret} percent /></td>
                  <td className="num"><Delta value={s.mdd} percent /></td>
                  <td className="num">{s.vol === null ? "—" : `${num(s.vol, 1)}%`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel section">
        <h2>近 {contribution.length} 個交易日：指數漲跌點數拆解</h2>
        <p className="sub">七巨頭（{MAG7.map((m) => m.key).join("、")}）貢獻 vs 其餘成分股；取每天最新版快照。</p>
        <LineChart
          zeroLine
          digits={1}
          lines={[
            { name: "指數漲跌", color: "#5c6b7a", points: contribution.map((c) => ({ date: c.date, value: c.index })) },
            { name: "七巨頭貢獻", color: "#d1343b", points: contribution.map((c) => ({ date: c.date, value: c.mag7 })) },
            { name: "其餘成分股", color: "#2456d6", dashed: true, points: contribution.map((c) => ({ date: c.date, value: c.rest })) },
          ]}
        />
      </div>
    </>
  );
}
