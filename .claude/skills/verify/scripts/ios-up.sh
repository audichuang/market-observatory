#!/usr/bin/env bash
# Boot an existing MO device and build-for-testing; leave other runs' devices alone.
#   ios-up.sh <run-id> <16-plus|18-pro-max>
# Outputs: $RUN/sim.udid, $RUN/sim.device, $RUN/dd (DerivedData, removed by down.sh).
source "$(dirname "$0")/lib.sh"
DEVICE="${2:-}"
DEVICE_NAME="$(simulator_name "$DEVICE")"
RUN="$(run_dir "${1:-}")"
source "$RUN/state.env"

DEVICES=$(xcrun simctl list devices -j)
MATCHES=$(/usr/bin/jq -c --arg name "$DEVICE_NAME" \
  '[.devices[][] | select(.name == $name and .isAvailable == true)]' <<<"$DEVICES")
COUNT=$(/usr/bin/jq 'length' <<<"$MATCHES")
[ "$COUNT" -eq 1 ] || die "${DEVICE_NAME} 可用裝置有 ${COUNT} 台，必須恰好一台；依 AGENTS.md 不新增模擬器，請使用者處理"
UDID=$(/usr/bin/jq -r '.[0].udid' <<<"$MATCHES")
CURRENT_UDID=""
if [ -f "$RUN/sim.udid" ]; then CURRENT_UDID=$(cat "$RUN/sim.udid"); fi
ACTIVE_MO=$(/usr/bin/jq -r --arg current "$CURRENT_UDID" \
  '.devices[][] | select((.name | startswith("MO ")) and .state != "Shutdown" and .udid != $current) | "\(.name) (\(.udid))"' <<<"$DEVICES")
[ -z "$ACTIVE_MO" ] || die "${ACTIVE_MO} 尚未關機，可能有別的驗證在用；確認後 xcrun simctl shutdown <UDID> 再重跑"
if [ -n "$CURRENT_UDID" ] && [ "$CURRENT_UDID" != "$UDID" ] && \
  /usr/bin/jq -e --arg current "$CURRENT_UDID" \
    'any(.devices[][]; .udid == $current and .state == "Booted")' <<<"$DEVICES" >/dev/null; then
  xcrun simctl shutdown "$CURRENT_UDID"
fi
xcrun simctl bootstatus "$UDID" -b
echo "$UDID" >"$RUN/sim.udid"
echo "$DEVICE" >"$RUN/sim.device"
ok "模擬器 ${UDID}（${DEVICE_NAME}）"

cd "$REPO/ios"
xcodegen generate >/dev/null
xcodebuild -project MarketObservatory.xcodeproj -scheme MarketObservatory -destination "id=$UDID" \
  -derivedDataPath "$RUN/dd" CODE_SIGNING_ALLOWED=NO build-for-testing >"$RUN/ios-build.log" 2>&1 \
  || { grep -E 'error:' "$RUN/ios-build.log" | head -20; die "build 失敗，全文在 $RUN/ios-build.log"; }
xcrun simctl install "$UDID" "$RUN/dd/Build/Products/Debug-iphonesimulator/MarketObservatory.app"
ok "build-for-testing 完成並安裝 App"
