#!/usr/bin/env bash
# 在這次的模擬器上跑 WalkthroughTests：登入、逐頁截圖，連的是這次的本機後端（不是正式站）。
#   ios-walkthrough.sh <run-id> <email> <密碼檔>
# 帳號要先在本機站註冊好（網頁 UI 或 API）。截圖與 xcresult 寫到 $RUN/evidence/ios/。
source "$(dirname "$0")/lib.sh"
RUN="$(run_dir "${1:-}")"
source "$RUN/state.env"
EMAIL="${2:?要給 email}"
PWFILE="${3:?要給密碼檔（不把密碼放在 argv）}"
UDID=$(cat "$RUN/sim.udid" 2>/dev/null) || die "先跑 ios-up.sh"
OUT="$RUN/evidence/ios"
mkdir -p "$OUT"
rm -rf "$OUT/walkthrough.xcresult"

cd "$REPO/ios"
LOG="$RUN/ios-walkthrough.log"
: >"$LOG"  # 先清空：下面的迴圈要是讀到上一次的結果行，會把這次的測試誤殺
TEST_RUNNER_MO_BASE_URL="$BASE" TEST_RUNNER_MO_EMAIL="$EMAIL" TEST_RUNNER_MO_PASSWORD="$(cat "$PWFILE")" \
TEST_RUNNER_MO_SHOTS="$OUT" \
xcodebuild -project MarketObservatory.xcodeproj -scheme MarketObservatory -destination "id=$UDID" \
  -derivedDataPath "$RUN/dd" CODE_SIGNING_ALLOWED=NO -resultBundlePath "$OUT/walkthrough.xcresult" \
  -only-testing:MarketObservatoryUITests/WalkthroughTests/test1_SignInAndVisitEveryScreen \
  test-without-building >"$LOG" 2>&1 &
XB=$!
# 測試跑完後 xcodebuild 偶爾卡著不結束（看過卡 10 分鐘以上）：看到結果行就再給它 60 秒收尾，還不走就停掉它。
# 判定以 log 的結果行為準，不看 xcodebuild 的 exit code。
done_at=""
while kill -0 "$XB" 2>/dev/null; do
  if [ -z "$done_at" ] && grep -qE "Test Suite 'Selected tests' (passed|failed)" "$LOG"; then done_at=$SECONDS; fi
  if [ -n "$done_at" ] && [ $((SECONDS - done_at)) -gt 60 ]; then
    echo "! 測試已結束但 xcodebuild 60 秒沒退出，停掉它（xcresult 可能不完整，截圖不受影響）"
    kill_tree "$XB"; break
  fi
  sleep 3
done
wait "$XB" 2>/dev/null || true
grep -E 'error:|Test Case .* (passed|failed)' "$LOG" | grep -v IDESchemeActionSDKRecord || true
ls "$OUT"/*.png 2>/dev/null | wc -l | xargs echo "截圖張數："
grep -q "Test Suite 'Selected tests' passed" "$LOG" || die "walkthrough 沒通過，log 在 ${LOG}，xcresult 裡有錄影"
ok "walkthrough 通過；打開 $OUT 的截圖逐張看"
