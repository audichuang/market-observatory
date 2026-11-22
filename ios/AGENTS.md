## 模擬器

這台 Mac 也有其他專案的模擬器（代號見全域 AGENTS.md 的 iOS 模擬器那條）；本 App 的常駐機是自己的兩台既有機型（iOS 27.2）：

| 代稱 | 裝置 | 用途 |
| --- | --- | --- |
| `18-pro-max` | `MO iPhone 18 Pro Max` | 大螢幕 |
| `16-plus` | `MO iPhone 16 Plus` | 較小螢幕 |

- 開機與收尾走 `/verify`：`ios-up.sh <run-id> 16-plus|18-pro-max` 用 `sim-vault ensure` 取常駐機並登記 lease（收起的會自動還原）；`down.sh` 交還 lease、關機、保留常駐機。`park.sh <16-plus|18-pro-max|all>` 收進 NAS。結束碼與下一步看 `sim-vault --help`。
- 平行驗證（另一個 run 正在用同一台常駐機）時加 `tmp`：`ios-up.sh <run-id> <機型> tmp` 建同機型的臨時機 `MO tmp <run-id> <機型>`，`down.sh` 會刪掉它；worktree 收斂時用 `xcrun simctl list devices` 確認沒有殘留的 `MO tmp …`。
- 常駐機不改用 SE 或一般 Pro；不自己建常駐機（`ensure` 不帶 `--create`），沒有封存或 runtime 已移除就停下問使用者，結束碼見 `sim-vault --help`。
- 不碰實機。自己跑 `xcodebuild` 時用 `-destination id=<本輪 sim.udid>`。
