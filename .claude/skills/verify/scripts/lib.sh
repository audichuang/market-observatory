# 共用：由其他腳本 source。RUN 目錄放這次驗證的狀態（state.env、密碼檔、log）與證據（evidence/）。
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="$(git -C "$SKILL_DIR" rev-parse --show-toplevel)"
VERIFY_ROOT="${MO_VERIFY_ROOT:-$HOME/.cache/mo-verify}"

die() { echo "✗ $*" >&2; exit 1; }
ok() { echo "✓ $*"; }

# simulator_name <device>: the two reusable devices allowed by ios/AGENTS.md.
simulator_name() {
  case "${1:-}" in
    16-plus) echo "MO iPhone 16 Plus" ;;
    18-pro-max) echo "MO iPhone 18 Pro Max" ;;
    *) die "機型必填，只能選 16-plus 或 18-pro-max" ;;
  esac
}

# simulator_type <device>: device type for a tmp device, so tmp works while the resident is parked.
simulator_type() {
  case "${1:-}" in
    16-plus) echo "com.apple.CoreSimulator.SimDeviceType.iPhone-16-Plus" ;;
    18-pro-max) echo "com.apple.CoreSimulator.SimDeviceType.iPhone-18-Pro-Max" ;;
    *) die "機型必填，只能選 16-plus 或 18-pro-max" ;;
  esac
}

# Resident-device lock shared by ios-up.sh (restore + boot) and park.sh, so park never deletes a
# device another session is booting and two sessions never restore the same device at once.
SIM_LOCK="${MO_SIM_LOCK:-${TMPDIR:-/tmp}/mo-sim.lock}"
sim_lock() {
  local waited=0 holder
  while ! mkdir "$SIM_LOCK" 2>/dev/null; do
    holder=$(cat "$SIM_LOCK/pid" 2>/dev/null || true)
    if [ -n "$holder" ] && ! kill -0 "$holder" 2>/dev/null; then rm -rf "$SIM_LOCK"; continue; fi
    [ "$waited" -gt 0 ] || echo "等 MO 模擬器鎖（PID ${holder:-?} 持有 ${SIM_LOCK}）…" >&2
    [ "$waited" -lt 600 ] || die "等 MO 模擬器鎖 10 分鐘仍未釋放（PID ${holder:-?}），先查那個程序"
    sleep 5
    waited=$((waited + 5))
  done
  echo $$ >"$SIM_LOCK/pid"
  trap sim_unlock EXIT
}
sim_unlock() {
  if [ "$(cat "$SIM_LOCK/pid" 2>/dev/null)" = "$$" ]; then rm -rf "$SIM_LOCK"; fi
}

# resident_matches <name>: JSON array of every device with that name (available or not).
resident_matches() {
  xcrun simctl list devices -j | /usr/bin/jq -c --arg name "$1" '[.devices[][] | select(.name == $name)]'
}

# restore_resident <name>: call while holding sim_lock. A missing resident is normally parked on
# the NAS; bring it back with sim-vault. Never creates a device: a blank one parked later would
# overwrite the archive that holds the login. Exit codes follow modern-ios-guidance VER7.
restore_resident() {
  local name=$1 rc=0
  [ "$(resident_matches "$name" | /usr/bin/jq length)" -eq 0 ] || return 0
  command -v sim-vault >/dev/null || die "找不到 ${name}，也沒有 sim-vault 可還原；常駐機不自己新建，請使用者處理"
  echo "從 NAS 還原 ${name}…" >&2
  sim-vault restore "$name" >/dev/null || rc=$?
  case "$rc" in
    0) ok "已還原 ${name}（UDID 換新，App 與登入照封存）" ;;
    3|4) echo "✗ ${name} 無法還原（sim-vault 結束碼 ${rc}：3 沒有封存、4 runtime 已移除）。MO 不自己建常駐機，停下請使用者決定（modern-ios-guidance VER7）" >&2; exit "$rc" ;;
    5) echo "✗ NAS 封存區沒掛上（sim-vault 結束碼 5）：等掛回後重跑，不建同名空機；急用改跑 tmp 臨時機（VER7）" >&2; exit 5 ;;
    *) echo "✗ sim-vault restore 失敗（結束碼 ${rc}），沒有建機，先查原因" >&2; exit "$rc" ;;
  esac
}

# run_dir <run-id>：回傳這次驗證的目錄（不存在就 die）。
run_dir() {
  [ -n "${1:-}" ] || die "要給 run-id（web-up.sh 建立時印出的那個）"
  local d="$VERIFY_ROOT/$1"
  [ -d "$d" ] || die "找不到 $d"
  echo "$d"
}

# 把整棵程序樹（自己＋所有子孫）殺掉；只用在這次驗證自己記下的 PID。
kill_tree() {
  local pid=$1 child
  for child in $(pgrep -P "$pid" 2>/dev/null); do kill_tree "$child"; done
  kill "$pid" 2>/dev/null || true
}
