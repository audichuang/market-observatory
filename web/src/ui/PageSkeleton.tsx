// 換分頁時、資料還沒回來前先顯示的骨架；形狀跟各頁實際版面大致相同，切換時版面不會跳動。

const Bar = ({ w = "100%", h = 14 }: { w?: string | number; h?: number }) => <div className="sk" style={{ width: w, height: h }} />;

function Cards({ n, tall = false }: { n: number; tall?: boolean }) {
  return (
    <div className="grid kpis">
      {Array.from({ length: n }, (_, i) => (
        <div key={i} className="panel">
          <Bar w="45%" h={11} />
          <div style={{ height: 10 }} />
          <Bar w="70%" h={tall ? 26 : 20} />
        </div>
      ))}
    </div>
  );
}

function Rows({ n }: { n: number }) {
  return (
    <div className="panel section">
      <Bar w="30%" h={18} />
      {Array.from({ length: n }, (_, i) => (
        <div key={i} style={{ display: "flex", gap: 12, marginTop: 14 }}>
          <Bar w="28%" />
          <Bar w="18%" />
          <Bar w="18%" />
          <Bar w="22%" />
        </div>
      ))}
    </div>
  );
}

const Chart = ({ h = 260 }: { h?: number }) => (
  <div className="panel section">
    <Bar w="35%" h={18} />
    <div style={{ height: 12 }} />
    <div className="sk" style={{ height: h, borderRadius: 8 }} />
  </div>
);

export default function PageSkeleton({ path }: { path: string }) {
  let body: React.ReactNode;
  if (path.startsWith("/history")) body = (<><div className="chips" style={{ marginBottom: "1rem" }}>{Array.from({ length: 6 }, (_, i) => <Bar key={i} w={64} h={34} />)}</div><Chart h={300} /><Chart h={300} /></>);
  else if (path.startsWith("/outlook")) body = (<><div className="panel"><Bar w="30%" h={14} /><div style={{ height: 10 }} /><Bar w="40%" h={44} /><div style={{ height: 12 }} /><Bar h={18} /></div><Cards n={3} /><Rows n={9} /></>);
  else if (path.startsWith("/etfs")) body = (<><Rows n={8} /><Chart h={220} /></>);
  else if (path.startsWith("/news") || path.startsWith("/sources")) body = (<><Rows n={6} /><Rows n={6} /></>);
  else body = (<><Cards n={4} tall /><div className="section" /><Cards n={6} /><Rows n={8} /></>);
  return (
    <div className="skeleton" role="status" aria-label="載入中">
      <div className="page-head">
        <div style={{ width: "60%" }}>
          <Bar w="70%" h={26} />
          <div style={{ height: 8 }} />
          <Bar w="45%" h={12} />
        </div>
      </div>
      {body}
    </div>
  );
}
