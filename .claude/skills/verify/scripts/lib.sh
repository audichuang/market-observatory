# 共用：由其他腳本 source。RUN 目錄放這次驗證的狀態（state.env、密碼檔、log）與證據（evidence/）。
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
REPO="$(git -C "$SKILL_DIR" rev-parse --show-toplevel)"
VERIFY_ROOT="${MO_VERIFY_ROOT:-$HOME/.cache/mo-verify}"

die() { echo "✗ $*" >&2; exit 1; }
ok() { echo "✓ $*"; }

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
