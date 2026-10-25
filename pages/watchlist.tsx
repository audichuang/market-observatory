import { Link, action, useRouter } from "@void/react";
import { useState } from "react";
import { num } from "../src/ui/format.ts";
import type { Props } from "./watchlist.server";

type Status = { kind: "idle" } | { kind: "busy"; text: string } | { kind: "ok"; text: string } | { kind: "error"; text: string };

const errorText = (e: unknown) => {
  const body = (e as { body?: unknown })?.body;
  if (body && typeof body === "object" && "error" in body) return String((body as { error: unknown }).error);
  return e instanceof Error ? e.message : "操作失敗";
};

export default function WatchlistPage({ members, candidates, asOf, totalWeight, max }: Props) {
  const router = useRouter();
  const [symbol, setSymbol] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const busy = status.kind === "busy";
  const full = members.length >= max;

  async function run(data: { op: "add"; symbol: string } | { op: "remove"; key: string }, busyText: string, okText: string) {
    setStatus({ kind: "busy", text: busyText });
    const res = await action("/watchlist", { data });
    if (!res.ok) return setStatus({ kind: "error", text: errorText(res.error) });
    setStatus({ kind: "ok", text: okText });
    if (data.op === "add") setSymbol("");
    router.refresh();
  }

  const add = (raw: string) => {
    const t = raw.trim().toUpperCase().split(/\s/)[0].replace(".", "-");
    if (!t) return;
    const name = candidates.find((c) => c.ticker === t)?.name ?? t;
    run({ op: "add", symbol: t }, `加入 ${name} 中…（第一次會抓十年股價，約幾秒）`, `已加入 ${name}`);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>觀察名單</h1>
          <p className="sub">
            名單裡的公司會在總覽拆開看對 S&amp;P 500 的貢獻點數、在走勢頁一起比較；「其餘成分股」＝指數減掉名單。可加入任何 S&amp;P 500 成分股，最多 {max} 家。
          </p>
        </div>
      </div>

      <div className="panel">
        <h2>加入公司</h2>
        <form
          className="watch-add"
          onSubmit={(e) => {
            e.preventDefault();
            add(symbol);
          }}
        >
          <input
            list="sp500"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            placeholder="代號或公司，例如 AVGO"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="go"
            aria-label="股票代號"
            disabled={busy || full}
          />
          <datalist id="sp500">
            {candidates.map((c) => (
              <option key={c.ticker} value={c.ticker}>{`${c.name} · ${num(c.weightPct, 2)}%`}</option>
            ))}
          </datalist>
          <button type="submit" disabled={busy || full || !symbol.trim()}>加入</button>
        </form>
        {full && <p className="sub">名單已滿 {max} 家，先移除一家才能再加。</p>}
        {!full && (
          <>
            <p className="meta" style={{ marginTop: ".8rem" }}>權重最大、還不在名單裡的：</p>
            <div className="chips">
              {candidates.slice(0, 8).map((c) => (
                <button key={c.ticker} type="button" className="chip" disabled={busy} onClick={() => add(c.ticker)}>
                  ＋ {c.ticker} <span className="meta">{num(c.weightPct, 1)}%</span>
                </button>
              ))}
            </div>
          </>
        )}
        {status.kind !== "idle" && (
          <p className={status.kind === "error" ? "error" : "sub"} role="status" style={{ marginTop: ".6rem" }}>
            {status.kind === "busy" && <span className="spinner" aria-hidden />}
            {status.text}
          </p>
        )}
      </div>

      <div className="panel section">
        <div className="head-row">
          <h2>
            目前 {members.length} 家 <span className="meta">合計權重 {num(totalWeight, 1)}%</span>
          </h2>
        </div>
        {members.length === 0 ? (
          <p className="sub">名單是空的；總覽的「其餘成分股」就是整個指數。</p>
        ) : (
          <ul className="list watch-list">
            {members.map((m) => (
              <li key={m.key}>
                <div className="watch-name">
                  <strong>{m.company}</strong>
                  <span className="meta mono">{m.tickers.join("＋")}</span>
                </div>
                <span className="num">{num(m.weightPct, 2)}%</span>
                <Link href={`/history?symbol=${m.key}`} className="button secondary small">走勢</Link>
                <button
                  type="button"
                  className="secondary small danger"
                  disabled={busy}
                  onClick={() => {
                    if (window.confirm(`從名單移除 ${m.company}？股價資料會保留，之後可以再加回來。`)) run({ op: "remove", key: m.key }, `移除 ${m.company} 中…`, `已移除 ${m.company}`);
                  }}
                >
                  移除
                </button>
              </li>
            ))}
          </ul>
        )}
        <p className="meta" style={{ marginTop: ".6rem" }}>
          權重來自 {asOf ?? "—"} 的 SPY 持股。改名單後，總覽與最近 45 個交易日的貢獻會立刻用新名單重算；更早的日子保留當時名單的數字。
        </p>
      </div>
    </>
  );
}
