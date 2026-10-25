#!/bin/zsh
# 打包並上傳 TestFlight（只給內部測試，不用審核）。
# 簽章用 Xcode 自動簽章，憑證與描述檔透過 App Store Connect API key 自動建立／更新；
# key 是 team 層級的，放在 ~/.appstoreconnect/private_keys/AuthKey_<KEY_ID>.p8（備份在 1Password Agent vault）。
# build 號用時間（yyyymmddHHMM），每次上傳都會遞增。
set -euo pipefail
cd "${0:A:h}/.."

KEY_ID="${ASC_KEY_ID:-PSZ89WD7LP}"
ISSUER_ID="${ASC_ISSUER_ID:-c2cf053c-9890-472f-98d6-4515cd7e47e8}"
KEY_PATH="${ASC_KEY_PATH:-$HOME/.appstoreconnect/private_keys/AuthKey_${KEY_ID}.p8}"
BUILD="${BUILD_NUMBER:-$(date +%Y%m%d%H%M)}"
OUT="build/testflight-${BUILD}"
AUTH=(-allowProvisioningUpdates -authenticationKeyPath "$KEY_PATH" -authenticationKeyID "$KEY_ID" -authenticationKeyIssuerID "$ISSUER_ID")

mkdir -p "$OUT"
xcodegen generate --quiet
# 完整 log 留在 build/ 底下，終端機只印最後幾行。
if ! xcodebuild -project MarketObservatory.xcodeproj -scheme MarketObservatory -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "${OUT}/MarketObservatory.xcarchive" \
  CURRENT_PROJECT_VERSION="$BUILD" "${AUTH[@]}" archive > "${OUT}/archive.log" 2>&1; then
  { grep -E "error:|BUILD FAILED|ARCHIVE FAILED" "${OUT}/archive.log" || true; } | tail -20; echo "archive 失敗，完整 log：${OUT}/archive.log"; exit 1
fi
if ! xcodebuild -exportArchive -archivePath "${OUT}/MarketObservatory.xcarchive" -exportOptionsPlist ExportOptions.plist \
  -exportPath "${OUT}/export" "${AUTH[@]}" > "${OUT}/export.log" 2>&1; then
  tail -30 "${OUT}/export.log"; echo "上傳失敗，完整 log：${OUT}/export.log"; exit 1
fi
echo "已上傳 build ${BUILD}；App Store Connect 處理完（約 5～15 分鐘）後會出現在 TestFlight。"
