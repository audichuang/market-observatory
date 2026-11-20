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

# Resident devices are taken, released and parked with sim-vault (exit codes: `sim-vault --help`).
need_sim_vault() {
  command -v sim-vault >/dev/null || die "沒有 sim-vault：uv tool install \"git+https://github.com/audichuang/sim-vault@v4.1.0\""
}

# run_dir <run-id>：回傳這次驗證的目錄（不存在就 die）。
run_dir() {
  [ -n "${1:-}" ] || die "要給 run-id（web-up.sh 建立時印出的那個）"
  local d="$VERIFY_ROOT/$1"
  [ -d "$d" ] || die "找不到 $d"
  (cd "$d" && pwd)
}

# 把整棵程序樹（自己＋所有子孫）殺掉；只用在這次驗證自己記下的 PID。
kill_tree() {
  local pid=$1 child
  for child in $(pgrep -P "$pid" 2>/dev/null); do kill_tree "$child"; done
  kill "$pid" 2>/dev/null || true
}
