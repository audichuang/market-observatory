#!/usr/bin/env bash
# Stop this run's dev server tree, release its resident simulator (delete its tmp simulators); remove DerivedData, passwords and cookies.
# 證據（$RUN/evidence/）保留，最後印出它的位置與檔案數。
#   down.sh <run-id>
source "$(dirname "$0")/lib.sh"
RUN="$(run_dir "${1:-}")"
[ -f "$RUN/state.env" ] || { ok "${RUN} 已經收過（state.env.down）"; exit 0; }
source "$RUN/state.env"
RC=0

if kill -0 "$DEV_PID" 2>/dev/null; then kill_tree "$DEV_PID"; ok "dev server PID $DEV_PID 已停"; fi
# 常駐機：交還這個 run 的 lease，ensure 開的機由 sim-vault 關掉；機器保留。
if [ -f "$RUN/sim.lease" ]; then
  need_sim_vault
  sim-vault release "$(cat "$RUN/sim.lease")" --lease "mo:${RUN}" --shutdown
  rm -f "$RUN/sim.lease"
fi
# 這個 run 用 tmp 建的臨時機用完就刪；刪不掉的留在 sim.tmp，down.sh 回非 0，重跑會再刪。
if [ -f "$RUN/sim.tmp" ]; then
  : >"$RUN/sim.tmp.left"
  while read -r TMP_UDID; do
    [ -n "$TMP_UDID" ] || continue
    xcrun simctl shutdown "$TMP_UDID" 2>/dev/null || true
    if xcrun simctl delete "$TMP_UDID"; then
      ok "臨時機 $TMP_UDID 已刪除"
    elif ! xcrun simctl list devices -j | /usr/bin/jq -e --arg u "$TMP_UDID" 'any(.devices[][]; .udid == $u)' >/dev/null; then
      ok "臨時機 $TMP_UDID 已不在"
    else
      echo "$TMP_UDID" >>"$RUN/sim.tmp.left"
    fi
  done <"$RUN/sim.tmp"
  if [ -s "$RUN/sim.tmp.left" ]; then
    mv "$RUN/sim.tmp.left" "$RUN/sim.tmp"; RC=1
    echo "✗ 臨時機刪除失敗，留在 $RUN/sim.tmp：查原因後重跑 down.sh" >&2
  else
    rm -f "$RUN/sim.tmp" "$RUN/sim.tmp.left"
  fi
fi
rm -f "$RUN/sim.udid" "$RUN/sim.device"
# ego-browser 的 task space（SKILL.md 規定名字是 mo-verify-<run-id>）：drive 時忘了 finish 的話這裡收掉；已經 finish 過就什麼都不做。
if command -v ego-browser >/dev/null; then
  # 已經 finish 過的 space 有時會讓這個呼叫卡住：最多等 20 秒，逾時就放掉（space 本來就結束了）。
  ego-browser nodejs -e "const l = await listTaskSpaces(); const s = l.find(x => x.name === 'mo-verify-${RUN_ID}' && x.ownership !== 'user'); if (s) { const t = await taskSpace(s.id); await t.finish({ keep: [] }); console.log('ego task space ' + s.id + ' 已結束'); }" 2>/dev/null &
  EGO=$!
  for _ in $(seq 1 20); do kill -0 "$EGO" 2>/dev/null || break; sleep 1; done
  if kill -0 "$EGO" 2>/dev/null; then kill_tree "$EGO"; echo "! ego task space 收尾 20 秒沒回應，已略過"; fi
fi
rm -rf "$RUN/dd" "$RUN/owner.pw" "$RUN/owner.cj" "$RUN"/*.pw "$RUN"/*.cj
[ "$RC" -ne 0 ] || mv "$RUN/state.env" "$RUN/state.env.down"
# 本機 D1 留在 checkout 的 web/.void 裡（含這次註冊的帳號）；這個 worktree 不再驗證時連同 worktree 一起刪。

n=$(find "$RUN/evidence" -type f | wc -l | tr -d ' ')
if [ "$n" -gt 0 ]; then ok "證據保留在 $RUN/evidence（$n 個檔案）"; else echo "! $RUN/evidence 是空的：這次沒有留下任何證據（失敗的嘗試才會這樣）"; fi
exit "$RC"
