## 模擬器

這台 Mac 也有其他專案的模擬器（`CB …`、`DSA …`）；本 App 的常駐機是自己的兩台既有機型（iOS 27.2）：

| 代稱 | 裝置 | 用途 |
| --- | --- | --- |
| `18-pro-max` | `MO iPhone 18 Pro Max` | 大螢幕 |
| `16-plus` | `MO iPhone 16 Plus` | 較小螢幕 |

- 開機與收尾走 `/verify`：`ios-up.sh <run-id> 16-plus|18-pro-max` 開常駐機，同一 run 換機重跑它會先關前一台；`down.sh` 關機、保留常駐機。
- 平行驗證（另一個 run 正在用同一台常駐機）時加 `tmp`：`ios-up.sh <run-id> <機型> tmp` 建同機型的臨時機 `MO tmp <run-id> <機型>`，`down.sh` 會刪掉它；worktree 收斂時用 `xcrun simctl list devices` 確認沒有殘留的 `MO tmp …`。
- 常駐機不刪、不 erase，也不改用 SE 或一般 Pro；同名常駐機找不到或不只一台時停下問使用者。
- 不碰其他代號的模擬器與實機，不用 `booted` 別名，不用 `killall` 收 CoreSimulatorService。自己跑 `xcodebuild` 時用 `-destination id=<本輪 sim.udid>` 並加 `-parallel-testing-enabled NO`，免得 Xcode 另外 clone 模擬器。
- 在 Device Hub 手動操作前，先確認側欄選的是本輪 `sim.udid` 那台 MO；選到其他專案的裝置就重選，不在上面點。
