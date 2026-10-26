#!/usr/bin/env bash
# 從空資料庫啟動本機網站並灌好資料，直到「能用」為止。
#   web-up.sh [run-id] [port]
# - 必須在一個 .void 還沒有資料的 checkout（新 worktree）裡跑：本機 D1 存在 web/.void/v3/d1，每個 checkout 各一份。
# - 站長帳號（web/.env 的 OWNER_EMAIL）用隨機密碼註冊，密碼存在 $RUN/owner.pw（600），不印出。
# - 灌資料：scripts/backfill.ts --sessions 60（十年日線＋60 天快照，約 30 秒）＋ daily-reference、news 兩支排程＋ forecast。
# 完成時印出 RUN 目錄與網址；狀態寫在 $RUN/state.env。
source "$(dirname "$0")/lib.sh"

RUN_ID="${1:-$(date +%Y%m%d-%H%M%S)}"
PORT="${2:-5181}"
RUN="$VERIFY_ROOT/$RUN_ID"
WEB="$REPO/web"
B="http://localhost:$PORT"

[ -e "$RUN/state.env" ] && die "$RUN 已經有一個實例，換一個 run-id 或先跑 down.sh"
[ -f "$WEB/.env" ] || die "$WEB/.env 不存在：從主 checkout 複製（裡面要有 OWNER_EMAIL）"
OWNER="$(grep '^OWNER_EMAIL=' "$WEB/.env" | cut -d= -f2-)"
[ -n "$OWNER" ] || die "$WEB/.env 沒有 OWNER_EMAIL"
if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then die "port $PORT 已被占用（可能是別人的 dev server），換一個 port"; fi

# 空資料庫檢查：已有使用者就不是從零開始，也不知道站長密碼。
# 同一個 worktree 要再驗一次時設 MO_VERIFY_RESET=1 清掉它自己的本機 D1（與 KV、快取）；主 checkout 的開發資料一律不清。
MAIN="$(git -C "$REPO" worktree list --porcelain | head -1 | cut -d' ' -f2-)"
users=0
for f in "$WEB"/.void/v3/d1/miniflare-D1DatabaseObject/*.sqlite; do
  [ -e "$f" ] || continue
  [ "$(basename "$f")" = metadata.sqlite ] && continue
  n=$(sqlite3 "$f" "select count(*) from user" 2>/dev/null || echo 0)
  users=$((users + n))
done
if [ "$users" != 0 ]; then
  if [ "${MO_VERIFY_RESET:-}" = 1 ] && [ "$REPO" != "$MAIN" ]; then
    # 連 KV 與頁面快取一起清：快取鍵只在重新 build 時變，留著會讓新的一輪讀到上一輪算好的頁面。
    rm -rf "$WEB/.void/v3"; ok "已清掉 ${WEB} 的本機 D1、KV 與快取（MO_VERIFY_RESET=1）"
  else
    die "這個 checkout 的本機 D1 已經有 $users 個帳號。開一個新 worktree；若這是你自己的驗證 worktree，加 MO_VERIFY_RESET=1 重來（主 checkout 不允許）"
  fi
fi

mkdir -p "$RUN/evidence/web" "$RUN/evidence/ios"
cd "$WEB"
[ -d node_modules ] || npm ci --silent
[ -d .void ] || npx void prepare >/dev/null
npx void db migrate >"$RUN/migrate.log" 2>&1 || { cat "$RUN/migrate.log"; die "migration 失敗"; }

# 直接跑 vite（不經 npx），記下的 PID 就是 dev server 本人；workerd 是它的子程序，down.sh 會整棵收掉。
nohup node node_modules/.bin/vite --port "$PORT" --strictPort >"$RUN/dev.log" 2>&1 &
DEV_PID=$!
cat >"$RUN/state.env" <<EOF
RUN_ID=$RUN_ID
PORT=$PORT
BASE=$B
DEV_PID=$DEV_PID
WEB=$WEB
OWNER_EMAIL=$OWNER
EOF
for _ in $(seq 1 90); do
  [ "$(curl -s -o /dev/null -w '%{http_code}' "$B/login")" = 200 ] && break
  kill -0 "$DEV_PID" 2>/dev/null || { tail -20 "$RUN/dev.log"; die "dev server 啟動失敗"; }
  sleep 1
done
[ "$(curl -s -o /dev/null -w '%{http_code}' "$B/login")" = 200 ] || die "90 秒內 $B/login 沒回 200"
ok "dev server ${B}（PID ${DEV_PID}）"

# 站長帳號：密碼只進檔案與 curl 的 --data @檔案，不進 argv。
openssl rand -hex 12 | tr -d '\n' >"$RUN/owner.pw"; chmod 600 "$RUN/owner.pw"
( umask 077; printf '{"email":"%s","password":"%s","name":"owner"}' "$OWNER" "$(cat "$RUN/owner.pw")" >"$RUN/.signup.json" )
curl -sf -c "$RUN/owner.cj" -H "Origin: $B" -H 'content-type: application/json' \
  -X POST "$B/api/auth/sign-up/email" --data @"$RUN/.signup.json" >/dev/null || { rm -f "$RUN/.signup.json"; die "站長註冊失敗"; }
rm -f "$RUN/.signup.json"
curl -s -b "$RUN/owner.cj" "$B/api/v1/me" | grep -q '"isOwner":true' || die "註冊了但不是站長（OWNER_EMAIL 對不上？）"
ok "站長 ${OWNER}（密碼在 $RUN/owner.pw）"

MO_URL="$B" MO_EMAIL="$OWNER" MO_PASSWORD="$(cat "$RUN/owner.pw")" node scripts/backfill.ts --sessions 60 >"$RUN/backfill.log" 2>&1 \
  || { tail -20 "$RUN/backfill.log"; die "回補失敗（Yahoo 限流時隔幾分鐘再跑）"; }
ok "回補：$(tail -2 "$RUN/backfill.log" | head -1 | cut -c1-80)"

for s in daily-reference news; do
  curl -s -b "$RUN/owner.cj" -H "Origin: $B" -X POST "$B/api/admin/cron?name=$s" >"$RUN/cron-$s.json"
  grep -q '"status":"ok"' "$RUN/cron-$s.json" || echo "! 排程 $s 有工作不是 ok，看 $RUN/cron-$s.json"
done
curl -s -b "$RUN/owner.cj" -H "Origin: $B" -X POST "$B/api/admin/run?job=forecast" >"$RUN/job-forecast.json"
ok "排程 daily-reference、news、forecast 跑完"

echo
echo "RUN=$RUN"
echo "下一步：$SKILL_DIR/scripts/doctor.sh $RUN_ID"
