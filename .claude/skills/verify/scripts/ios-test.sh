#!/usr/bin/env bash
# 在這次的模擬器上跑指定的 UI 測試，連的是這次的本機後端（不是正式站）。
#   ios-test.sh <run-id> <email> <密碼檔> <Class/testName>[,<Class/testName>…]
# 例：ios-test.sh proof4 verify-proof4@example.test "$RUN/user.pw" VerifyInteractionTests/test03_Watchlist
# 先增量 build-for-testing（改過測試檔也會帶進去），再跑。帳號要先在本機站註冊好。
# 截圖、*.txt 與 xcresult 寫到 $RUN/evidence/ios/。
source "$(dirname "$0")/lib.sh"
RUN="$(run_dir "${1:-}")"
source "$RUN/state.env"
EMAIL="${2:?要給 email}"
PWFILE="${3:?要給密碼檔（不把密碼放在 argv）}"
TESTS="${4:?要給 Class/testName}"
UDID=$(cat "$RUN/sim.udid" 2>/dev/null) || die "先跑 ios-up.sh"
OUT="$RUN/evidence/ios"
mkdir -p "$OUT"
NAME="$(echo "$TESTS" | tr '/,' '__')"
rm -rf "$OUT/$NAME.xcresult"

cd "$REPO/ios"
xcodegen generate >/dev/null
xcodebuild -project MarketObservatory.xcodeproj -scheme MarketObservatory -destination "id=$UDID" \
  -derivedDataPath "$RUN/dd" CODE_SIGNING_ALLOWED=NO build-for-testing >"$RUN/ios-build.log" 2>&1 \
  || { grep -E 'error:' "$RUN/ios-build.log" | head -20; die "build 失敗，全文在 $RUN/ios-build.log"; }
ONLY=()
IFS=',' read -ra parts <<<"$TESTS"
for p in "${parts[@]}"; do ONLY+=("-only-testing:MarketObservatoryUITests/$p"); done
LOG="$RUN/ios-test-$NAME.log"
: >"$LOG"  # 先清空：下面的迴圈要是讀到上一次的結果行，會把這次的測試誤殺
TEST_RUNNER_MO_BASE_URL="$BASE" TEST_RUNNER_MO_EMAIL="$EMAIL" TEST_RUNNER_MO_PASSWORD="$(cat "$PWFILE")" \
TEST_RUNNER_MO_SHOTS="$OUT" \
xcodebuild -project MarketObservatory.xcodeproj -scheme MarketObservatory -destination "id=$UDID" \
  -derivedDataPath "$RUN/dd" CODE_SIGNING_ALLOWED=NO -resultBundlePath "$OUT/$NAME.xcresult" \
  "${ONLY[@]}" \
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
grep -q "Test Suite 'Selected tests' passed" "$LOG" || die "$TESTS 沒通過，log 在 ${LOG}，xcresult 裡有錄影"
ok "$TESTS 通過；打開 $OUT 的截圖與 .txt 逐一看"
