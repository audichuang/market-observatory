#!/usr/bin/env bash
# Park resident MO devices on the NAS with sim-vault (whole device: App, login, settings) and delete
# them locally; the next ios-up.sh restores the device automatically. Run it only after the whole batch
# of iOS work is done. tmp devices ("MO tmp …") are not parked: down.sh deletes them.
#   park.sh <16-plus|18-pro-max|all>
# Exits with sim-vault's code on failure (exit codes: modern-ios-guidance VER7).
source "$(dirname "$0")/lib.sh"
command -v sim-vault >/dev/null || die "沒有 sim-vault，無法收起；常駐機照舊用 down.sh 關機保留"

case "${1:-}" in
  all) TARGETS=(18-pro-max 16-plus) ;;
  16-plus|18-pro-max) TARGETS=("$1") ;;
  *) die "用法：park.sh <16-plus|18-pro-max|all>" ;;
esac

park_one() {
  local name udid count state store rc=0
  name=$(simulator_name "$1")
  local matches
  matches=$(resident_matches "$name")
  count=$(/usr/bin/jq length <<<"$matches")
  if [ "$count" -eq 0 ]; then ok "${name} 不在本機（已收起），不用處理"; return 0; fi
  [ "$count" -eq 1 ] || die "${name} 有 ${count} 台，必須恰好一台；常駐機不自己刪除，請使用者處理"
  udid=$(/usr/bin/jq -r '.[0].udid' <<<"$matches")
  state=$(/usr/bin/jq -r '.[0].state' <<<"$matches")
  [ "$state" = Shutdown ] || die "${name} 是 ${state}，可能有別的驗證或手動操作在用；用完 down.sh 關機後再收"
  # A run that has not run down.sh still owns the device even while it is shut down (switching devices).
  local f
  for f in "$VERIFY_ROOT"/*/sim.udid; do
    [ -f "$f" ] || continue
    [ "$(cat "$f")" != "$udid" ] || die "${name} 仍記在 $(dirname "$f") 的 sim.udid：那個 run 還沒跑 down.sh"
  done
  store="$HOME/Library/Developer/CoreSimulator/Devices/$udid/data/Library/Application Support/PRBPosterExtensionDataStore"
  if [ -d "$store" ] && [ "$(du -sk "$store" | cut -f1)" -gt 1048576 ]; then
    die "${name} 的 PosterBoard 資料 $(du -sh "$store" | cut -f1)（正常約 200M），整包會進封存：先照 modern-ios-guidance VER7 的 PosterBoard 修法重建再收；機器沒動"
  fi
  sim-vault park "$name" --shutdown || rc=$?
  case "$rc" in
    0) ok "已收起 ${name}；下次 ios-up.sh 會自動還原（UDID 換新）" ;;
    *) echo "✗ sim-vault park ${name} 失敗（結束碼 ${rc}），模擬器保留沒刪；結束碼處理見 modern-ios-guidance VER7" >&2; return "$rc" ;;
  esac
}

sim_lock
for d in "${TARGETS[@]}"; do
  rc=0
  park_one "$d" || rc=$?
  [ "$rc" -eq 0 ] || exit "$rc"
done
