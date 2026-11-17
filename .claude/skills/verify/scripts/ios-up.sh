#!/usr/bin/env bash
# Boot an MO device and build-for-testing; leave other runs' devices alone.
#   ios-up.sh <run-id> <16-plus|18-pro-max>        take the resident device with `sim-vault ensure` (restores it if parked)
#   ios-up.sh <run-id> <16-plus|18-pro-max> tmp    parallel run: create "MO tmp <run-id> <機型>" (down.sh deletes it)
# Outputs: $RUN/sim.udid, $RUN/sim.device, $RUN/sim.lease (leased resident name), $RUN/sim.tmp (temporary UDIDs), $RUN/dd (DerivedData, removed by down.sh).
source "$(dirname "$0")/lib.sh"
DEVICE="${2:-}"
MODE="${3:-}"
DEVICE_NAME="$(simulator_name "$DEVICE")"
RUN="$(run_dir "${1:-}")"
source "$RUN/state.env"
[ -z "$MODE" ] || [ "$MODE" = tmp ] || die "第三個參數只能是 tmp"

need_sim_vault
LEASE="mo:${RUN_ID}"
PREV_UDID=$(cat "$RUN/sim.udid" 2>/dev/null || true)
# Switching away from a resident device: drop this run's lease on it (shuts it down if ensure booted it).
if [ -f "$RUN/sim.lease" ] && { [ -n "$MODE" ] || [ "$(cat "$RUN/sim.lease")" != "$DEVICE_NAME" ]; }; then
  sim-vault release "$(cat "$RUN/sim.lease")" --lease "$LEASE" --shutdown
  rm -f "$RUN/sim.lease" "$RUN/sim.udid" "$RUN/sim.device"
fi
if [ "$MODE" = tmp ]; then
  # 臨時機與常駐機同機型、用最新的 iOS runtime；同一 run 重跑時沿用已建的那台。
  TMP_NAME="MO tmp ${RUN_ID} ${DEVICE}"
  TYPE=$(simulator_type "$DEVICE")
  UDID=$(xcrun simctl list devices -j | /usr/bin/jq -r --arg name "$TMP_NAME" \
    '[.devices[][] | select(.name == $name and .isAvailable == true)][0].udid // empty')
  if [ -z "$UDID" ]; then
    RUNTIME=$(xcrun simctl list runtimes -j | /usr/bin/jq -r \
      '[.runtimes[] | select(.platform == "iOS" and .isAvailable == true)] | last | .identifier // empty')
    [ -n "$RUNTIME" ] || die "沒有可用的 iOS runtime"
    UDID=$(xcrun simctl create "$TMP_NAME" "$TYPE" "$RUNTIME")
    echo "$UDID" >>"$RUN/sim.tmp"
    ok "建立臨時機 ${TMP_NAME}（${UDID}），down.sh 會刪除"
  fi
  xcrun simctl bootstatus "$UDID" -b
else
  # sim.lease is written before ensure, which records the lease before booting: down.sh can always release it.
  # MO policy: never create a resident device, so no --create; 3/4 stops here.
  echo "$DEVICE_NAME" >"$RUN/sim.lease"
  rc=0
  OUT=$(sim-vault ensure "$DEVICE_NAME" --boot --lease "$LEASE" --exclusive --json) || rc=$?
  if [ "$rc" -ne 0 ]; then
    case "$rc" in 3|4) echo "✗ MO 不自己建常駐機：停下請使用者決定" >&2 ;; esac
    exit "$rc"
  fi
  UDID=$(/usr/bin/jq -r .udid <<<"$OUT")
fi
if [ -n "$PREV_UDID" ] && [ "$PREV_UDID" != "$UDID" ] && grep -qx "$PREV_UDID" "$RUN/sim.tmp" 2>/dev/null; then
  xcrun simctl shutdown "$PREV_UDID" 2>/dev/null || true
fi
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
