import { useState } from "react";
import { RESEARCH_FIELDS, RESEARCH_NOTE, IR_URLS, edgarFilingsUrl, researchTemplate } from "../lib/research.ts";

export default function ResearchPanel({ company, ticker }: { company: string; ticker: string }) {
  const [message, setMessage] = useState("");
  const irUrl = IR_URLS[ticker];
  const copy = async () => {
    try {
      const now = new Date();
      const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      await navigator.clipboard.writeText(researchTemplate({ company, ticker, date }));
      setMessage("已複製，可貼到你自己的筆記保存");
    } catch {
      setMessage("無法複製，請手動選取上方文字");
    }
  };

  return (
    <div className="panel section">
      <h2>研究表與原始資料</h2>
      <p>
        <a href={edgarFilingsUrl(ticker)} target="_blank" rel="noreferrer">SEC EDGAR 申報清單</a>
        {irUrl && <> · <a href={irUrl} target="_blank" rel="noreferrer">公司投資人關係（IR）</a></>}
      </p>
      {!irUrl && <p className="sub">這家公司未收錄 IR 網址；可從 EDGAR 的年報（10-K）找到公司網站。</p>}
      <details>
        <summary>研究表範本（7 題）</summary>
        <ol>
          {RESEARCH_FIELDS.map(({ label, prompt }) => <li key={label}>{label}：{prompt}</li>)}
        </ol>
        <button type="button" className="button secondary small" onClick={copy}>複製範本</button>
        {message && <p role="status" className="meta">{message}</p>}
      </details>
      <p className="meta" style={{ marginTop: ".75rem" }}>{RESEARCH_NOTE}</p>
    </div>
  );
}
