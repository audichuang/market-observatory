#!/usr/bin/env bash
# 建一台這次驗證專用的模擬器、開機、build-for-testing。不碰別人已開著的模擬器。
#   ios-up.sh <run-id>
# 產物：$RUN/sim.udid、$RUN/dd（DerivedData，down.sh 會刪）。
source "$(dirname "$0")/lib.sh"
RUN="$(run_dir "${1:-}")"
source "$RUN/state.env"
[ -f "$RUN/sim.udid" ] && die "這個 run 已經有模擬器 $(cat "$RUN/sim.udid")"

# iPhone 18 Pro 只配 iOS 27.0 的 runtime（配 27.1 會報 Incompatible device）。
UDID=$(xcrun simctl create "MO Verify $RUN_ID" com.apple.CoreSimulator.SimDeviceType.iPhone-18-Pro com.apple.CoreSimulator.SimRuntime.iOS-27-0)
echo "$UDID" >"$RUN/sim.udid"
xcrun simctl boot "$UDID"
ok "模擬器 ${UDID}（MO Verify ${RUN_ID}）"

cd "$REPO/ios"
xcodegen generate >/dev/null
xcodebuild -project MarketObservatory.xcodeproj -scheme MarketObservatory -destination "id=$UDID" \
  -derivedDataPath "$RUN/dd" CODE_SIGNING_ALLOWED=NO build-for-testing >"$RUN/ios-build.log" 2>&1 \
  || { grep -E 'error:' "$RUN/ios-build.log" | head -20; die "build 失敗，全文在 $RUN/ios-build.log"; }
xcrun simctl install "$UDID" "$RUN/dd/Build/Products/Debug-iphonesimulator/MarketObservatory.app"
ok "build-for-testing 完成並安裝 App"
