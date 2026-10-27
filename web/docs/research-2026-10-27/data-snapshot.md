# 計分所用資料快照

下載於 2026-10-27，來源 Cboe 官方 CSV（`src/lib/sources/cboe.ts` 的 `CBOE_URLS`）。

```text
SPX_History.csv sha256 9a2d92ae30eb4d440de1475c1ea1218881f93ace4c315bba86c33ffe55c47f98 rows 13063 range 01/02/1975..10/26/2026
VIX_History.csv sha256 8e67801e46bab11ab543ac8d575544db4e8cd6fd7e4c7e9dc419b498de8a77ff rows 9302 range 01/02/1990..10/26/2026
```

重現：`node scripts/score-calls.mjs <SPX_History.csv>`（`web/.backtest/SPX.csv` 是同一份檔案）。
