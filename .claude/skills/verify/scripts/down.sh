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
# ego-browser 的 task space（SKILL.md 規定名字是 mo-verify-<run-id>）：drive 時忘了 finish 的話這裡收掉；已經 finish 過就什麼都不做。
if command -v ego-browser >/dev/null; then
  # 已經 finish 過的 space 有時會讓這個呼叫卡住：最多等 20 秒，逾時就放掉（space 本來就結束了）。
  ego-browser nodejs -e "const l = await listTaskSpaces(); const s = l.find(x => x.name === 'mo-verify-${RUN_ID}' && x.ownership !== 'user'); if (s) { const t = await taskSpace(s.id); await t.finish({ keep: [] }); console.log('ego task space ' + s.id + ' 已結束'); }" 2>/dev/null &
  EGO=$!
  for _ in $(seq 1 20); do kill -0 "$EGO" 2>/dev/null || break; sleep 1; done
  if kill -0 "$EGO" 2>/dev/null; then kill_tree "$EGO"; echo "! ego task space 收尾 20 秒沒回應，已略過"; fi
fi
rm -rf "$RUN/dd" "$RUN/owner.pw" "$RUN/owner.cj" "$RUN"/*.pw "$RUN"/*.cj
mv "$RUN/state.env" "$RUN/state.env.down"
# 本機 D1 留在 checkout 的 web/.void 裡（含這次註冊的帳號）；這個 worktree 不再驗證時連同 worktree 一起刪。

n=$(find "$RUN/evidence" -type f | wc -l | tr -d ' ')
if [ "$n" -gt 0 ]; then ok "證據保留在 $RUN/evidence（$n 個檔案）"; else echo "! $RUN/evidence 是空的：這次沒有留下任何證據（失敗的嘗試才會這樣）"; fi
