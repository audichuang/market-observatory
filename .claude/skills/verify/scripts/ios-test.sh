#!/usr/bin/env bash
# 在這次的模擬器上跑指定的 UI 測試，連的是這次的本機後端（不是正式站）。
#   ios-test.sh <run-id> <email> <密碼檔> <Class/testName>[,<Class/testName>…]
# 例：ios-test.sh proof4 verify-proof4@example.test "$RUN/user.pw" VerifyInteractionTests/test04_Watchlist
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
# 一次跑多個 test 時名字會超過檔名上限（255 bytes）：改用前 60 字＋雜湊。
[ ${#NAME} -le 100 ] || NAME="${NAME:0:60}_$(printf '%s' "$TESTS" | shasum | cut -c1-8)"
rm -rf "$OUT/$NAME.xcresult"

# Dates the tests depend on come from this run's local site, read as this account (never hard-coded in the tests):
#   MO_PUSH_DATE  = second-latest trading day; test08's push opens it (not the latest, so the push visibly switches days)
#   MO_EVENT_DATE = first /api/v1/news event on or after MO_TODAY (the API's today); test05 taps it, test09's push carries it
# The same value goes into the push payloads ($RUN/daily.json, events.json) and into the test's assertions.
CJ="$RUN/user.cj"
# Strip trailing newlines like "$(cat "$PWFILE")" below does, so both reads send the same password.
( umask 077; jq -n --arg e "$EMAIL" --rawfile p "$PWFILE" '{email:$e,password:($p|sub("\n+$";""))}' >"$RUN/.signin.json" )
curl -sf -o /dev/null -c "$CJ" -H "Origin: $BASE" -H 'content-type: application/json' \
  -X POST "$BASE/api/auth/sign-in/email" --data @"$RUN/.signin.json" || { rm -f "$RUN/.signin.json"; die "$EMAIL 在 $BASE 登入失敗（帳號要先註冊）"; }
rm -f "$RUN/.signin.json"
OVERVIEW=$(curl -sf -b "$CJ" "$BASE/api/v1/overview") || die "讀 $BASE/api/v1/overview 失敗"
NEWS=$(curl -sf -b "$CJ" "$BASE/api/v1/news") || die "讀 $BASE/api/v1/news 失敗"
PUSH_DATE=$(jq -r '.dates[1].tradeDate' <<<"$OVERVIEW")
TODAY=$(jq -r '.today' <<<"$NEWS")
EVENT_DATE=$(jq -r '[.events[].date | select(. >= "'"$TODAY"'")] | first' <<<"$NEWS")
# jq prints "null" when the data is missing (e.g. web-up.sh only warned about a failed backfill); stop here instead of crashing test05.
is_date() { [[ "$1" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; }
is_date "$PUSH_DATE" || die "overview 沒有第二新的交易日（得到 ${PUSH_DATE}），本機站資料可能沒回填完整"
is_date "$TODAY" || die "news 沒有 today（得到 ${TODAY}）"
is_date "$EVENT_DATE" || die "news 沒有 ${TODAY} 以後的事件（得到 ${EVENT_DATE}），本機站資料可能沒回填完整"
md() { echo "$((10#${1:5:2}))/$((10#${1:8:2}))"; }
jq -n --arg d "$PUSH_DATE" --arg md "$(md "$PUSH_DATE")" \
  '{aps:{alert:{title:"S&P 500 \($md) 收盤",body:"驗證用推播（ios-test.sh 產生）"},sound:"default","thread-id":"daily"},kind:"daily",screen:"overview",date:$d}' >"$RUN/daily.json"
jq -n --arg d "$EVENT_DATE" --arg md "$(md "$EVENT_DATE")" \
  '{aps:{alert:{title:"今天（美東 \($md)）的事件",body:"驗證用推播（ios-test.sh 產生）"},"thread-id":"events"},kind:"events",screen:"news",date:$d}' >"$RUN/events.json"
ok "日期：推播 ${PUSH_DATE}、事件 ${EVENT_DATE}、today ${TODAY}"

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
TEST_RUNNER_MO_SHOTS="$OUT" TEST_RUNNER_MO_PUSH_DATE="$PUSH_DATE" TEST_RUNNER_MO_EVENT_DATE="$EVENT_DATE" TEST_RUNNER_MO_TODAY="$TODAY" \
xcodebuild -project MarketObservatory.xcodeproj -scheme MarketObservatory -destination "id=$UDID" \
  -derivedDataPath "$RUN/dd" CODE_SIGNING_ALLOWED=NO -resultBundlePath "$OUT/$NAME.xcresult" \
  "${ONLY[@]}" \
  test-without-building >"$LOG" 2>&1 &
XB=$!
# test08/test09 only wait for a banner and tap it: when one of them runs alone, push its payload every 8 s until xcodebuild exits.
PUSHER=""
case "$TESTS" in
  VerifyInteractionTests/test08_PushOpenDaily|VerifyInteractionTests/test13_PushDismissesWatchlist) PAYLOAD="$RUN/daily.json" ;;
  VerifyInteractionTests/test09_PushOpenEvents) PAYLOAD="$RUN/events.json" ;;
  *) PAYLOAD="" ;;
esac
if [ -n "$PAYLOAD" ]; then
  ( while kill -0 "$XB" 2>/dev/null; do xcrun simctl push "$UDID" com.audichuang.observatory "$PAYLOAD" >/dev/null 2>&1 || true; sleep 8; done ) &
  PUSHER=$!
fi
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
[ -z "$PUSHER" ] || { kill_tree "$PUSHER"; wait "$PUSHER" 2>/dev/null || true; }
grep -E 'error:|Test Case .* (passed|failed)' "$LOG" | grep -v IDESchemeActionSDKRecord || true
grep -q "Test Suite 'Selected tests' passed" "$LOG" || die "$TESTS 沒通過，log 在 ${LOG}；畫面看 test 自己存的截圖與 .txt（xcodebuild 被收掉時 xcresult 可能不完整、沒有錄影）"
ok "$TESTS 通過；打開 $OUT 的截圖與 .txt 逐一看"
