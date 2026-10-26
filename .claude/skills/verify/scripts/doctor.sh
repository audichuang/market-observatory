#!/usr/bin/env bash
# 唯讀健檢：這個實例值不值得 drive。任何一項 ✗ 就先別操作。
#   doctor.sh <run-id>
source "$(dirname "$0")/lib.sh"
RUN="$(run_dir "${1:-}")"
# shellcheck disable=SC1091
source "$RUN/state.env"
fail=0
check() { if eval "$2" >/dev/null 2>&1; then ok "$1"; else echo "✗ $1"; fail=1; fi; }

check "dev server PID $DEV_PID 還活著" "kill -0 $DEV_PID"
check "port $PORT 是這個實例在聽（不是別人的 dev server）" \
  "lsof -nP -iTCP:$PORT -sTCP:LISTEN -t | grep -qx $DEV_PID"
check "/login 回 200" "[ \"\$(curl -s -o /dev/null -w '%{http_code}' $BASE/login)\" = 200 ]"
# 未登入時頁面模組要拿得到，否則登入頁不會 hydrate、按鈕全沒反應（middleware/01.gate.ts 的 dev 放行）。
check "未登入也拿得到頁面模組 /pages/login.tsx（登入頁能 hydrate）" \
  "curl -s -o /dev/null -w '%{content_type}' $BASE/pages/login.tsx | grep -q javascript"
check "站長 cookie 有效且 isOwner" "curl -s -b $RUN/owner.cj $BASE/api/v1/me | grep -q '\"isOwner\":true'"
check "有最新快照（/api/v1/overview 有 tradeDate）" \
  "curl -s -b $RUN/owner.cj $BASE/api/v1/overview | grep -q '\"tradeDate\"'"
if [ -f "$RUN/sim.udid" ]; then
  UDID=$(cat "$RUN/sim.udid")
  check "模擬器 $UDID 已開機" "xcrun simctl list devices booted | grep -q $UDID"
  check "模擬器上裝了 App" "xcrun simctl get_app_container $UDID com.audichuang.observatory"
fi
echo "commit $(git -C "$WEB" rev-parse --short HEAD)$(git -C "$WEB" diff --quiet || echo '（有未提交的改動）')"
exit $fail
