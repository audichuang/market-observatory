import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, type TestContext } from "node:test";

const repo = resolve(import.meta.dirname, "../..");
const scripts = join(repo, ".claude/skills/verify/scripts");
const plus = "11111111-1111-1111-1111-111111111111";
const proMax = "22222222-2222-2222-2222-222222222222";
const oki = "33333333-3333-3333-3333-333333333333";
const tmpUdid = "55555555-5555-5555-5555-555555555555";
const proMaxType = "com.apple.CoreSimulator.SimDeviceType.iPhone-18-Pro-Max";
const runtime = "com.apple.CoreSimulator.SimRuntime.iOS-27-2";
const unusedPid = 2147483647;
// node spawns with a socket on stdin, which makes bash read ~/.bashrc (and its PATH) like an rsh shell.
const bashArgs = ["--noprofile", "--norc"];

function devices(plusState = "Shutdown", proMaxState = "Shutdown") {
  return [
    { name: "MO iPhone 16 Plus", udid: plus, state: plusState, isAvailable: true },
    { name: "MO iPhone 18 Pro Max", udid: proMax, state: proMaxState, isAvailable: true, deviceTypeIdentifier: proMaxType },
    { name: "OKI iPhone 17", udid: oki, state: "Booted", isAvailable: true },
  ];
}

function fixture(t: TestContext, runId: string, list = devices()) {
  const root = mkdtempSync(join(tmpdir(), "mo-verify-lifecycle-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const bin = join(root, "bin");
  const run = join(root, runId);
  const log = join(root, "commands.log");
  const deviceJson = join(root, "devices.json");
  mkdirSync(bin);
  mkdirSync(join(run, "evidence/ios"), { recursive: true });
  writeFileSync(log, "");
  writeFileSync(deviceJson, JSON.stringify({ devices: { "com.apple.CoreSimulator.SimRuntime.iOS-27-0": list } }));
  assert.throws(() => process.kill(unusedPid, 0), { code: "ESRCH" });
  writeFileSync(join(run, "state.env"), `RUN_ID=${runId}\nDEV_PID=${unusedPid}\n`);
  const stub = [
    "#!/bin/bash",
    'printf "%s" "${0##*/}" >> "$MO_TEST_LOG"',
    'printf " %s" "$@" >> "$MO_TEST_LOG"',
    'printf "\\n" >> "$MO_TEST_LOG"',
    'if [ "${1:-}" = simctl ] && [ "${2:-}" = list ] && [ "${3:-}" = runtimes ]; then',
    `  printf '%s\\n' '{"runtimes":[{"identifier":"${runtime}","platform":"iOS","isAvailable":true}]}'`,
    'elif [ "${1:-}" = simctl ] && [ "${2:-}" = list ]; then',
    '  cat "$MO_TEST_DEVICES"',
    'elif [ "${1:-}" = simctl ] && [ "${2:-}" = create ]; then',
    `  echo ${tmpUdid}`,
    'elif [ "${1:-}" = simctl ] && [ "${2:-}" = delete ]; then',
    '  if ! /usr/bin/jq -e --arg udid "$3" \'any(.devices[][]; .udid == $udid)\' "$MO_TEST_DEVICES" >/dev/null; then',
    '    echo "Invalid device: $3" >&2; exit 148',
    '  fi',
    '  if grep -qx "$3" "$MO_TEST_ROOT/delete.fail" 2>/dev/null; then echo "stub delete failure" >&2; exit 1; fi',
    'elif [ "${1:-}" = simctl ] && [ "${2:-}" = shutdown ]; then',
    '  if grep -qx "$3" "$MO_TEST_ROOT/shutdown.fail" 2>/dev/null; then echo "stub shutdown failure" >&2; exit 7; fi',
    '  state=$(/usr/bin/jq -r --arg udid "$3" \'.devices[][] | select(.udid == $udid) | .state\' "$MO_TEST_DEVICES")',
    '  if [ "$state" != Booted ]; then',
    '    printf "%s\\n" "An error was encountered processing the command (domain=com.apple.CoreSimulator.SimError, code=405):" "Unable to shutdown device in current state: $state" >&2',
    '    exit 149',
    '  fi',
    "fi",
    "exit 0",
    "",
  ].join("\n");
  for (const command of ["xcrun", "xcodegen", "xcodebuild"]) {
    writeFileSync(join(bin, command), stub, { mode: 0o755 });
  }
  // sim-vault stand-in: ensure prints the UDID of the named device, or fails with $MO_TEST_ROOT/ensure.rc.
  const vault = [
    "#!/bin/bash",
    'printf "%s" "${0##*/}" >> "$MO_TEST_LOG"',
    'printf " %s" "$@" >> "$MO_TEST_LOG"',
    'printf "\\n" >> "$MO_TEST_LOG"',
    'if [ "${1:-}" = ensure ]; then',
    '  rc=$(cat "$MO_TEST_ROOT/ensure.rc" 2>/dev/null || echo 0)',
    '  if [ "$rc" != 0 ]; then echo "sim-vault: error: stub $rc" >&2; printf \'{"ok":false,"code":%s}\\n\' "$rc"; exit "$rc"; fi',
    '  udid=$(/usr/bin/jq -r --arg n "$2" \'[.devices[][] | select(.name == $n)][0].udid\' "$MO_TEST_DEVICES")',
    '  printf \'{"ok":true,"udid":"%s"}\\n\' "$udid"',
    // park: a device named in park.hang waits for a signal (130 on INT, 143 on TERM) after writing
    // park.started; a booted device without --shutdown is refused with 6 like sim-vault does;
    // otherwise the exit code per device comes from park.rc lines "<name>=<rc>" (default 0).
    'elif [ "${1:-}" = park ]; then',
    '  if grep -qxF -- "$2" "$MO_TEST_ROOT/park.hang" 2>/dev/null; then',
    '    trap \'kill $sleeper 2>/dev/null; exit 130\' INT',
    '    trap \'kill $sleeper 2>/dev/null; exit 143\' TERM',
    '    sleep "$(cat "$MO_TEST_ROOT/park.hang.seconds" 2>/dev/null || echo 30)" & sleeper=$!',
    '    echo "$2" > "$MO_TEST_ROOT/park.started"',
    '    wait $sleeper; exit 0',
    '  fi',
    '  state=$(/usr/bin/jq -r --arg n "$2" \'[.devices[][] | select(.name == $n)][0].state\' "$MO_TEST_DEVICES")',
    '  case " $* " in *" --shutdown "*) ;; *) if [ "$state" = Booted ]; then echo "error (exit 6, booted): $2" >&2; exit 6; fi ;; esac',
    '  rc=$(grep -F -- "$2=" "$MO_TEST_ROOT/park.rc" 2>/dev/null | head -n1 | cut -d= -f2)',
    '  if [ -n "$rc" ] && [ "$rc" != 0 ]; then echo "error (exit $rc, stub): $2" >&2; exit "$rc"; fi',
    "fi",
    "exit 0",
    "",
  ].join("\n");
  writeFileSync(join(bin, "sim-vault"), vault, { mode: 0o755 });
  const env = {
    PATH: `${bin}:/usr/bin:/bin`,
    MO_VERIFY_ROOT: root,
    MO_TEST_LOG: log,
    MO_TEST_DEVICES: deviceJson,
    MO_TEST_ROOT: root,
  };
  // Check the executable lookup before any real lifecycle script can run.
  const lookup = spawnSync("/bin/bash", [...bashArgs, "-c", "command -v xcrun"], { env, encoding: "utf8" });
  assert.equal(lookup.status, 0, lookup.stderr);
  assert.equal(lookup.stdout.trim(), join(bin, "xcrun"));
  const vaultLookup = spawnSync("/bin/bash", [...bashArgs, "-c", "command -v sim-vault"], { env, encoding: "utf8" });
  assert.equal(vaultLookup.stdout.trim(), join(bin, "sim-vault"));
  return {
    run,
    root,
    lease: `--lease mo:${run}`,
    invoke(script: string, ...args: string[]) {
      const result = spawnSync("/bin/bash", [...bashArgs, join(scripts, script), runId, ...args], { env, encoding: "utf8" });
      assert.ifError(result.error);
      assert.notEqual(result.status, null, result.stderr);
      return { status: result.status, output: result.stdout + result.stderr, log: readFileSync(log, "utf8") };
    },
    env,
    // Scripts that take no run-id (park.sh).
    invokeNoRun(script: string, ...args: string[]) {
      const result = spawnSync("/bin/bash", [...bashArgs, join(scripts, script), ...args], { env, encoding: "utf8" });
      assert.ifError(result.error);
      assert.notEqual(result.status, null, result.stderr);
      return { status: result.status, stdout: result.stdout, output: result.stdout + result.stderr, log: readFileSync(log, "utf8") };
    },
  };
}

test("ios-up 用 sim-vault ensure 取指定的 Pro Max，不建立裝置或碰已開機的 OKI", (t) => {
  const f = fixture(t, "r1");
  const r = f.invoke("ios-up.sh", "18-pro-max");
  assert.equal(r.status, 0, r.output);
  assert.ok(r.log.includes(`sim-vault ensure MO iPhone 18 Pro Max --boot ${f.lease} --exclusive --json\n`), r.log);
  assert.doesNotMatch(r.log, /--create|simctl (create|bootstatus|shutdown) /);
  assert.equal(readFileSync(join(f.run, "sim.udid"), "utf8").trim(), proMax);
  assert.equal(readFileSync(join(f.run, "sim.device"), "utf8").trim(), "18-pro-max");
  assert.equal(readFileSync(join(f.run, "sim.lease"), "utf8").trim(), "MO iPhone 18 Pro Max");
  assert.ok(r.log.includes(`-destination id=${proMax}`), r.log);
  assert.ok(r.log.includes(`xcrun simctl install ${proMax} `), r.log);
  assert.doesNotMatch(r.log, new RegExp(oki));
});

test("兩個狀態目錄用同一個 run-id 時 lease owner 不同", (t) => {
  const a = fixture(t, "same");
  const b = fixture(t, "same");
  const ra = a.invoke("ios-up.sh", "18-pro-max");
  const rb = b.invoke("ios-up.sh", "18-pro-max");
  assert.equal(ra.status, 0, ra.output);
  assert.equal(rb.status, 0, rb.output);
  assert.notEqual(a.lease, b.lease);
  assert.ok(ra.log.includes(a.lease) && rb.log.includes(b.lease), ra.log + rb.log);
});

test("同 run 換成 Plus 時先交還 Pro Max 的 lease，再取 Plus 並更新狀態", (t) => {
  const f = fixture(t, "r1", devices("Shutdown", "Booted"));
  writeFileSync(join(f.run, "sim.udid"), proMax);
  writeFileSync(join(f.run, "sim.device"), "18-pro-max");
  writeFileSync(join(f.run, "sim.lease"), "MO iPhone 18 Pro Max\n");
  const r = f.invoke("ios-up.sh", "16-plus");
  assert.equal(r.status, 0, r.output);
  const release = r.log.indexOf(`sim-vault release MO iPhone 18 Pro Max ${f.lease} --shutdown\n`);
  const ensure = r.log.indexOf(`sim-vault ensure MO iPhone 16 Plus --boot ${f.lease} --exclusive --json\n`);
  assert.ok(release >= 0 && ensure > release, r.log);
  assert.equal(readFileSync(join(f.run, "sim.udid"), "utf8").trim(), plus);
  assert.equal(readFileSync(join(f.run, "sim.device"), "utf8").trim(), "16-plus");
  assert.doesNotMatch(r.log, new RegExp(oki));
});

test("同 run 重跑同一台時不交還 lease，直接重入 ensure", (t) => {
  const f = fixture(t, "r1", devices("Shutdown", "Booted"));
  writeFileSync(join(f.run, "sim.udid"), proMax);
  writeFileSync(join(f.run, "sim.device"), "18-pro-max");
  writeFileSync(join(f.run, "sim.lease"), "MO iPhone 18 Pro Max\n");
  const r = f.invoke("ios-up.sh", "18-pro-max");
  assert.equal(r.status, 0, r.output);
  assert.doesNotMatch(r.log, /sim-vault release|simctl shutdown /);
  assert.ok(r.log.includes(`sim-vault ensure MO iPhone 18 Pro Max --boot ${f.lease} --exclusive --json\n`), r.log);
});

for (const code of [3, 5, 8]) {
  test(`sim-vault ensure 回 ${code} 時原碼停止，不建機、不寫 sim.udid，但留 sim.lease 給 down`, (t) => {
    const f = fixture(t, "r2");
    writeFileSync(join(f.root, "ensure.rc"), String(code));
    const r = f.invoke("ios-up.sh", "18-pro-max");
    assert.equal(r.status, code, r.output);
    if (code === 3) assert.match(r.output, /MO 不自己建常駐機/);
    assert.doesNotMatch(r.log, /simctl (create|boot|bootstatus|shutdown|install) /);
    assert.equal(existsSync(join(f.run, "sim.udid")), false);
    assert.equal(readFileSync(join(f.run, "sim.lease"), "utf8").trim(), "MO iPhone 18 Pro Max");
  });
}

test("另一台 MO 常駐機開著時，仍可開沒被占用的那台（允許平行驗證）", (t) => {
  const f = fixture(t, "r2", devices("Booted", "Shutdown"));
  const r = f.invoke("ios-up.sh", "18-pro-max");
  assert.equal(r.status, 0, r.output);
  assert.doesNotMatch(r.log, /simctl (shutdown|create) /);
  assert.equal(readFileSync(join(f.run, "sim.udid"), "utf8").trim(), proMax);
});

test("tmp 建同機型臨時機、用最新 iOS runtime，並記進 sim.tmp", (t) => {
  const f = fixture(t, "r5", devices("Shutdown", "Booted"));
  const r = f.invoke("ios-up.sh", "18-pro-max", "tmp");
  assert.equal(r.status, 0, r.output);
  assert.ok(r.log.includes(`xcrun simctl create MO tmp r5 18-pro-max ${proMaxType} ${runtime}\n`), r.log);
  assert.doesNotMatch(r.log, /sim-vault ensure/);
  assert.doesNotMatch(r.log, new RegExp(`simctl shutdown ${proMax}`));
  assert.ok(r.log.includes(`xcrun simctl bootstatus ${tmpUdid} -b`), r.log);
  assert.equal(readFileSync(join(f.run, "sim.udid"), "utf8").trim(), tmpUdid);
  assert.equal(readFileSync(join(f.run, "sim.tmp"), "utf8").trim(), tmpUdid);
  assert.equal(readFileSync(join(f.run, "sim.device"), "utf8").trim(), "18-pro-max");
});

test("tmp 以外的第三個參數停止，不碰任何模擬器", (t) => {
  const f = fixture(t, "r6");
  const r = f.invoke("ios-up.sh", "18-pro-max", "temp");
  assert.notEqual(r.status, 0, r.output);
  assert.match(r.output, /只能是 tmp/);
  assert.doesNotMatch(r.log, /simctl (create|boot|bootstatus|shutdown|install) /);
});

for (const args of [[], ["pro"]]) {
  test(`機型${args.length ? "不在清單" : "未提供"}時停止並列出兩個選項`, (t) => {
    const f = fixture(t, "r3");
    const r = f.invoke("ios-up.sh", ...args);
    assert.notEqual(r.status, 0, r.output);
    assert.match(r.output, /16-plus/);
    assert.match(r.output, /18-pro-max/);
    assert.equal(r.log, "");
  });
}

for (const [label, list] of [
  ["已關機", [...devices(), { name: "MO tmp r1 16-plus", udid: tmpUdid, state: "Shutdown", isAvailable: true }]],
  ["已不存在", devices()],
] as const) {
  test(`從 tmp 換回常駐機時，上一台臨時機${label}就忽略關機錯誤`, (t) => {
    const f = fixture(t, "r1", [...list]);
    writeFileSync(join(f.run, "sim.udid"), tmpUdid);
    writeFileSync(join(f.run, "sim.tmp"), `${tmpUdid}\n`);
    const r = f.invoke("ios-up.sh", "16-plus");
    assert.equal(r.status, 0, r.output);
    assert.equal(readFileSync(join(f.run, "sim.udid"), "utf8").trim(), plus);
  });
}

test("從 tmp 換回常駐機時，上一台臨時機關不掉就停止並傳回原結束碼", (t) => {
  const f = fixture(t, "r1", [...devices(), { name: "MO tmp r1 16-plus", udid: tmpUdid, state: "Booted", isAvailable: true }]);
  writeFileSync(join(f.run, "sim.udid"), tmpUdid);
  writeFileSync(join(f.run, "sim.tmp"), `${tmpUdid}\n`);
  writeFileSync(join(f.root, "shutdown.fail"), `${tmpUdid}\n`);
  const r = f.invoke("ios-up.sh", "16-plus");
  assert.equal(r.status, 7, r.output);
  assert.match(r.output, /stub shutdown failure/);
});

test("down 交還常駐機的 lease（由 sim-vault 關機），清除狀態檔並保留證據及既有收尾", (t) => {
  const f = fixture(t, "r1");
  writeFileSync(join(f.run, "sim.udid"), plus);
  writeFileSync(join(f.run, "sim.device"), "16-plus");
  writeFileSync(join(f.run, "sim.lease"), "MO iPhone 16 Plus\n");
  const evidence = join(f.run, "evidence/ios/16-plus/02-overview.png");
  mkdirSync(join(f.run, "evidence/ios/16-plus"));
  writeFileSync(evidence, "evidence");
  mkdirSync(join(f.run, "dd"));
  writeFileSync(join(f.run, "user.pw"), "test password");
  writeFileSync(join(f.run, "user.cj"), "test cookie");
  const r = f.invoke("down.sh");
  assert.equal(r.status, 0, r.output);
  assert.ok(r.log.includes(`sim-vault release MO iPhone 16 Plus ${f.lease} --shutdown\n`), r.log);
  assert.doesNotMatch(r.log, /simctl (shutdown|delete) /);
  for (const file of ["sim.udid", "sim.device", "sim.lease", "dd", "user.pw", "user.cj", "state.env"]) {
    assert.equal(existsSync(join(f.run, file)), false, file);
  }
  assert.equal(existsSync(join(f.run, "state.env.down")), true);
  assert.equal(readFileSync(evidence, "utf8"), "evidence");
  const again = f.invoke("down.sh");
  assert.equal(again.status, 0, again.output);
});

test("down 刪不掉還在的臨時機時回非 0 並保留 sim.tmp", (t) => {
  const list = [...devices(), { name: "MO tmp r1 18-pro-max", udid: tmpUdid, state: "Shutdown", isAvailable: true }];
  const f = fixture(t, "r1", list);
  writeFileSync(join(f.run, "sim.tmp"), `${tmpUdid}\n`);
  writeFileSync(join(f.root, "delete.fail"), `${tmpUdid}\n`);
  const r = f.invoke("down.sh");
  assert.notEqual(r.status, 0, r.output);
  assert.equal(readFileSync(join(f.run, "sim.tmp"), "utf8").trim(), tmpUdid);
  assert.equal(existsSync(join(f.run, "state.env")), true);
});

test("down 遇到已被手動刪掉的臨時機視為完成", (t) => {
  const f = fixture(t, "r1");
  writeFileSync(join(f.run, "sim.tmp"), `${tmpUdid}\n`);
  const r = f.invoke("down.sh");
  assert.equal(r.status, 0, r.output);
  assert.ok(r.log.includes(`xcrun simctl delete ${tmpUdid}\n`), r.log);
  assert.equal(existsSync(join(f.run, "sim.tmp")), false);
});

test("down 刪除本 run 用 tmp 建的臨時機，sim.tmp 一併清掉", (t) => {
  const list = [...devices(), { name: "MO tmp r1 18-pro-max", udid: tmpUdid, state: "Booted", isAvailable: true }];
  const f = fixture(t, "r1", list);
  writeFileSync(join(f.run, "sim.udid"), tmpUdid);
  writeFileSync(join(f.run, "sim.device"), "18-pro-max");
  writeFileSync(join(f.run, "sim.tmp"), `${tmpUdid}\n`);
  const r = f.invoke("down.sh");
  assert.equal(r.status, 0, r.output);
  assert.ok(r.log.includes(`xcrun simctl delete ${tmpUdid}\n`), r.log);
  assert.doesNotMatch(r.log, new RegExp(`simctl delete (${plus}|${proMax})`));
  assert.equal(existsSync(join(f.run, "sim.tmp")), false);
});

test("park all 第一台失敗時仍收第二台，逐台印 rc 並回第一個失敗碼", (t) => {
  const f = fixture(t, "p1");
  writeFileSync(join(f.root, "park.rc"), "MO iPhone 18 Pro Max=9\nMO iPhone 16 Plus=8\n");
  const r = f.invokeNoRun("park.sh", "all");
  assert.equal(r.status, 9, r.output);
  assert.equal(
    r.log,
    "sim-vault park MO iPhone 18 Pro Max --missing-ok\nsim-vault park MO iPhone 16 Plus --missing-ok\n",
  );
  assert.match(r.stdout, /^MO iPhone 18 Pro Max rc=9$/m);
  assert.match(r.stdout, /^MO iPhone 16 Plus rc=8$/m);
});

test("park all 只有第二台失敗時回第二台的碼，兩台都成功回 0", (t) => {
  const f = fixture(t, "p2");
  writeFileSync(join(f.root, "park.rc"), "MO iPhone 16 Plus=7\n");
  const r = f.invokeNoRun("park.sh", "all");
  assert.equal(r.status, 7, r.output);
  assert.match(r.stdout, /^MO iPhone 18 Pro Max rc=0$/m);
  assert.match(r.stdout, /^MO iPhone 16 Plus rc=7$/m);
  writeFileSync(join(f.root, "park.rc"), "");
  const ok = f.invokeNoRun("park.sh", "all");
  assert.equal(ok.status, 0, ok.output);
});

test("park all 第一台忙碌（8）時，第二台開著但沒有 lease 也不會被關：回 6 照報", (t) => {
  const f = fixture(t, "p4", devices("Booted", "Shutdown"));
  writeFileSync(join(f.root, "park.rc"), "MO iPhone 18 Pro Max=8\n");
  const r = f.invokeNoRun("park.sh", "all");
  assert.equal(r.status, 8, r.output);
  assert.doesNotMatch(r.log, /--shutdown|simctl (shutdown|delete)/);
  assert.match(r.stdout, /^MO iPhone 18 Pro Max rc=8$/m);
  assert.match(r.stdout, /^MO iPhone 16 Plus rc=6$/m);
});

// Runs park.sh all in its own process group, waits until the first park is in progress, then signals.
async function parkAllWithSignal(f: ReturnType<typeof fixture>, signal: NodeJS.Signals, group: boolean) {
  writeFileSync(join(f.root, "park.hang"), "MO iPhone 18 Pro Max\n");
  const child = spawn("/bin/bash", [...bashArgs, join(scripts, "park.sh"), "all"], { env: f.env, detached: true });
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  const exited = new Promise<number | null>((done) => child.on("close", (code) => done(code)));
  const started = join(f.root, "park.started");
  for (let i = 0; i < 100 && !existsSync(started); i++) await new Promise((r) => setTimeout(r, 50));
  assert.ok(existsSync(started), "first park never started: " + output);
  process.kill(group ? -child.pid! : child.pid!, signal);
  const status = await exited;
  return { status, output, log: readFileSync(join(f.root, "commands.log"), "utf8") };
}

test("park all 按 Ctrl-C（整個程序群收到 SIGINT）立即停止，不收第二台並回 130", async (t) => {
  const f = fixture(t, "p5");
  const r = await parkAllWithSignal(f, "SIGINT", true);
  assert.equal(r.status, 130, r.output);
  assert.equal(r.log, "sim-vault park MO iPhone 18 Pro Max --missing-ok\n");
});

test("park all 只有外層 shell 收到 SIGTERM 時，等目前這台結束後停止，不收第二台並回 143", async (t) => {
  const f = fixture(t, "p6");
  writeFileSync(join(f.root, "park.hang.seconds"), "1");
  const r = await parkAllWithSignal(f, "SIGTERM", false);
  assert.equal(r.status, 143, r.output);
  assert.equal(r.log, "sim-vault park MO iPhone 18 Pro Max --missing-ok\n");
});

test("park all 第一台已回 9 後才被中斷，回中斷碼而不是 9", async (t) => {
  const f = fixture(t, "p7");
  writeFileSync(join(f.root, "park.rc"), "MO iPhone 18 Pro Max=9\n");
  writeFileSync(join(f.root, "park.hang"), "MO iPhone 16 Plus\n");
  const child = spawn("/bin/bash", [...bashArgs, join(scripts, "park.sh"), "all"], { env: f.env, detached: true });
  const exited = new Promise<number | null>((done) => child.on("close", (code) => done(code)));
  const started = join(f.root, "park.started");
  for (let i = 0; i < 100 && !existsSync(started); i++) await new Promise((r) => setTimeout(r, 50));
  assert.ok(existsSync(started));
  process.kill(-child.pid!, "SIGINT");
  assert.equal(await exited, 130);
});

test("park 單台模式原樣傳回 sim-vault 的結束碼", (t) => {
  const f = fixture(t, "p3");
  writeFileSync(join(f.root, "park.rc"), "MO iPhone 16 Plus=9\n");
  const r = f.invokeNoRun("park.sh", "16-plus");
  assert.equal(r.status, 9, r.output);
  assert.equal(r.log, "sim-vault park MO iPhone 16 Plus --shutdown --missing-ok\n");
  const bad = f.invokeNoRun("park.sh", "oki");
  assert.equal(bad.status, 1, bad.output);
  assert.equal(bad.log, r.log);
});

test("verify 文件一致使用兩台既有機型與保留裝置的生命週期", () => {
  const skill = join(repo, ".claude/skills/verify/SKILL.md");
  const features = join(repo, ".claude/skills/verify/features");
  const docs = [skill, join(repo, "AGENTS.md"), join(repo, "ios/AGENTS.md"), ...readdirSync(features).filter((f) => f.endsWith(".md")).map((f) => join(features, f))];
  for (const doc of docs) {
    assert.doesNotMatch(readFileSync(doc, "utf8"), /MO Verify|simctl create|simctl delete/, doc);
  }
  const text = readFileSync(skill, "utf8");
  assert.match(text, /16-plus/);
  assert.match(text, /18-pro-max/);
});
