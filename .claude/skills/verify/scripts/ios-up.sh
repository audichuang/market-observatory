#!/usr/bin/env bash
# Boot an MO device and build-for-testing; leave other runs' devices alone.
#   ios-up.sh <run-id> <16-plus|18-pro-max>        reuse the resident device
#   ios-up.sh <run-id> <16-plus|18-pro-max> tmp    parallel run: create "MO tmp <run-id> <機型>" (down.sh deletes it)
# Outputs: $RUN/sim.udid, $RUN/sim.device, $RUN/sim.tmp (temporary UDIDs), $RUN/dd (DerivedData, removed by down.sh).
source "$(dirname "$0")/lib.sh"
DEVICE="${2:-}"
MODE="${3:-}"
DEVICE_NAME="$(simulator_name "$DEVICE")"
RUN="$(run_dir "${1:-}")"
source "$RUN/state.env"
[ -z "$MODE" ] || [ "$MODE" = tmp ] || die "第三個參數只能是 tmp"

DEVICES=$(xcrun simctl list devices -j)
CURRENT_UDID=""
if [ -f "$RUN/sim.udid" ]; then CURRENT_UDID=$(cat "$RUN/sim.udid"); fi
if [ "$MODE" = tmp ]; then
  # 臨時機與常駐機同機型、用最新的 iOS runtime；同一 run 重跑時沿用已建的那台。
  TMP_NAME="MO tmp $(basename "$RUN") ${DEVICE}"
  TYPE=$(/usr/bin/jq -r --arg name "$DEVICE_NAME" \
    '[.devices[][] | select(.name == $name)][0].deviceTypeIdentifier // empty' <<<"$DEVICES")
  [ -n "$TYPE" ] || die "找不到常駐機 ${DEVICE_NAME}，無法得知要建的機型"
  UDID=$(/usr/bin/jq -r --arg name "$TMP_NAME" \
    '[.devices[][] | select(.name == $name and .isAvailable == true)][0].udid // empty' <<<"$DEVICES")
  if [ -z "$UDID" ]; then
    RUNTIME=$(xcrun simctl list runtimes -j | /usr/bin/jq -r \
      '[.runtimes[] | select(.platform == "iOS" and .isAvailable == true)] | last | .identifier // empty')
    [ -n "$RUNTIME" ] || die "沒有可用的 iOS runtime"
    UDID=$(xcrun simctl create "$TMP_NAME" "$TYPE" "$RUNTIME")
    echo "$UDID" >>"$RUN/sim.tmp"
    ok "建立臨時機 ${TMP_NAME}（${UDID}），down.sh 會刪除"
  fi
else
  MATCHES=$(/usr/bin/jq -c --arg name "$DEVICE_NAME" \
    '[.devices[][] | select(.name == $name and .isAvailable == true)]' <<<"$DEVICES")
  COUNT=$(/usr/bin/jq 'length' <<<"$MATCHES")
  [ "$COUNT" -eq 1 ] || die "${DEVICE_NAME} 可用裝置有 ${COUNT} 台，必須恰好一台；常駐機不自己新建或刪除，請使用者處理"
  UDID=$(/usr/bin/jq -r '.[0].udid' <<<"$MATCHES")
  BUSY=$(/usr/bin/jq -r --arg udid "$UDID" --arg current "$CURRENT_UDID" \
    '.devices[][] | select(.udid == $udid and .udid != $current and .state != "Shutdown") | .name' <<<"$DEVICES")
  [ -z "$BUSY" ] || die "${DEVICE_NAME} 尚未關機，可能有別的驗證在用；要平行驗證改跑 ios-up.sh <run-id> ${DEVICE} tmp"
fi
if [ -n "$CURRENT_UDID" ] && [ "$CURRENT_UDID" != "$UDID" ] && \
  /usr/bin/jq -e --arg current "$CURRENT_UDID" \
    'any(.devices[][]; .udid == $current and .state == "Booted")' <<<"$DEVICES" >/dev/null; then
  xcrun simctl shutdown "$CURRENT_UDID"
fi
xcrun simctl bootstatus "$UDID" -b
echo "$UDID" >"$RUN/sim.udid"
echo "$DEVICE" >"$RUN/sim.device"
ok "模擬器 ${UDID}（${DEVICE_NAME}${MODE:+，臨時機}）"

cd "$REPO/ios"
xcodegen generate >/dev/null
xcodebuild -project MarketObservatory.xcodeproj -scheme MarketObservatory -destination "id=$UDID" \
  -derivedDataPath "$RUN/dd" CODE_SIGNING_ALLOWED=NO build-for-testing >"$RUN/ios-build.log" 2>&1 \
  || { grep -E 'error:' "$RUN/ios-build.log" | head -20; die "build 失敗，全文在 $RUN/ios-build.log"; }
xcrun simctl install "$UDID" "$RUN/dd/Build/Products/Debug-iphonesimulator/MarketObservatory.app"
ok "build-for-testing 完成並安裝 App"
