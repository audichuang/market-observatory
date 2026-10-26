#!/usr/bin/env bash
# 跑 WalkthroughTests：登入、逐頁截圖（約 20 張），連這次的本機後端。
#   ios-walkthrough.sh <run-id> <email> <密碼檔>
exec "$(dirname "$0")/ios-test.sh" "$1" "$2" "$3" WalkthroughTests/test1_SignInAndVisitEveryScreen
