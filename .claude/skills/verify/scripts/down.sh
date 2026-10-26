#!/usr/bin/env bash
# 收掉這次驗證自己啟動的東西：dev server 整棵程序樹、這次建的模擬器、DerivedData、密碼與 cookie。
# 證據（$RUN/evidence/）保留，最後印出它的位置與檔案數。
#   down.sh <run-id>
source "$(dirname "$0")/lib.sh"
RUN="$(run_dir "${1:-}")"
source "$RUN/state.env"

if kill -0 "$DEV_PID" 2>/dev/null; then kill_tree "$DEV_PID"; ok "dev server PID $DEV_PID 已停"; fi
if [ -f "$RUN/sim.udid" ]; then
  UDID=$(cat "$RUN/sim.udid")
  xcrun simctl shutdown "$UDID" 2>/dev/null || true
  xcrun simctl delete "$UDID" && ok "模擬器 $UDID 已刪"
  rm -f "$RUN/sim.udid"
fi
rm -rf "$RUN/dd" "$RUN/owner.pw" "$RUN/owner.cj" "$RUN"/*.pw "$RUN"/*.cj
mv "$RUN/state.env" "$RUN/state.env.down"
# 本機 D1 留在 checkout 的 web/.void 裡（含這次註冊的帳號）；這個 worktree 不再驗證時連同 worktree 一起刪。

n=$(find "$RUN/evidence" -type f | wc -l | tr -d ' ')
if [ "$n" -gt 0 ]; then ok "證據保留在 $RUN/evidence（$n 個檔案）"; else echo "! $RUN/evidence 是空的：這次沒有留下任何證據（失敗的嘗試才會這樣）"; fi
