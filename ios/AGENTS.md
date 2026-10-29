## 模擬器

這台 Mac 也有 CodexBar（`CB …`）與 OkiBus（`OKI …`）的驗證模擬器；本 App 只重用自己的兩台既有機型：

| 代稱 | 裝置 | 用途 |
| --- | --- | --- |
| `18-pro-max` | `MO iPhone 18 Pro Max` | 大螢幕 |
| `16-plus` | `MO iPhone 16 Plus` | 較小螢幕 |

- 一次只開一台，開機與收尾走 `/verify`：`ios-up.sh <run-id> 16-plus|18-pro-max` 開機，同一 run 換機重跑它會先關前一台；`down.sh` 只關機、保留裝置。
- 不新增、不刪除、不 erase 模擬器，也不改用 SE 或一般 Pro；同名裝置找不到或不只一台時停下問使用者。
- 不碰 `CB …`、`OKI …` 與實機，不用 `booted` 別名，不用 `killall` 收 CoreSimulatorService。自己跑 `xcodebuild` 時用 `-destination id=<本輪 sim.udid>` 並加 `-parallel-testing-enabled NO`，免得 Xcode 另外 clone 模擬器。
- 在 Device Hub 手動操作前，先確認側欄選的是本輪 `sim.udid` 那台 MO；選到其他專案的裝置就重選，不在上面點。
