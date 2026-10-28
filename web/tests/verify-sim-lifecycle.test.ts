import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { test, type TestContext } from "node:test";

const repo = resolve(import.meta.dirname, "../..");
const scripts = join(repo, ".claude/skills/verify/scripts");
const plus = "11111111-1111-1111-1111-111111111111";
const proMax = "22222222-2222-2222-2222-222222222222";
const oki = "33333333-3333-3333-3333-333333333333";
const unusedPid = 2147483647;

function devices(plusState = "Shutdown", proMaxState = "Shutdown") {
  return [
    { name: "MO iPhone 16 Plus", udid: plus, state: plusState, isAvailable: true },
    { name: "MO iPhone 18 Pro Max", udid: proMax, state: proMaxState, isAvailable: true },
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
    'if [ "${1:-}" = simctl ] && [ "${2:-}" = list ]; then',
    '  cat "$MO_TEST_DEVICES"',
    'elif [ "${1:-}" = simctl ] && [ "${2:-}" = shutdown ]; then',
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
  const env = {
    PATH: `${bin}:/usr/bin:/bin`,
    MO_VERIFY_ROOT: root,
    MO_TEST_LOG: log,
    MO_TEST_DEVICES: deviceJson,
  };
  // Check the executable lookup before any real lifecycle script can run.
  const lookup = spawnSync("/bin/bash", ["-c", "command -v xcrun"], { env, encoding: "utf8" });
  assert.equal(lookup.status, 0, lookup.stderr);
  assert.equal(lookup.stdout.trim(), join(bin, "xcrun"));
  return {
    run,
    invoke(script: string, ...args: string[]) {
      const result = spawnSync("/bin/bash", [join(scripts, script), runId, ...args], { env, encoding: "utf8" });
      assert.ifError(result.error);
      assert.notEqual(result.status, null, result.stderr);
      return { status: result.status, output: result.stdout + result.stderr, log: readFileSync(log, "utf8") };
    },
  };
}

test("ios-up 重用指定的 Pro Max，不建立裝置或碰已開機的 OKI", (t) => {
  const f = fixture(t, "r1");
  const r = f.invoke("ios-up.sh", "18-pro-max");
  assert.equal(r.status, 0, r.output);
  assert.doesNotMatch(r.log, /simctl create/);
  assert.equal(readFileSync(join(f.run, "sim.udid"), "utf8").trim(), proMax);
  assert.equal(readFileSync(join(f.run, "sim.device"), "utf8").trim(), "18-pro-max");
  assert.ok(r.log.includes(`xcrun simctl bootstatus ${proMax} -b`), r.log);
  assert.ok(r.log.includes(`-destination id=${proMax}`), r.log);
  assert.ok(r.log.includes(`xcrun simctl install ${proMax} `), r.log);
  assert.doesNotMatch(r.log, new RegExp(oki));
});

test("同 run 換成 Plus 時先關 Pro Max，再開 Plus 並更新狀態", (t) => {
  const f = fixture(t, "r1", devices("Shutdown", "Booted"));
  writeFileSync(join(f.run, "sim.udid"), proMax);
  writeFileSync(join(f.run, "sim.device"), "18-pro-max");
  const r = f.invoke("ios-up.sh", "16-plus");
  assert.equal(r.status, 0, r.output);
  const shutdown = r.log.indexOf(`xcrun simctl shutdown ${proMax}\n`);
  const boot = r.log.indexOf(`xcrun simctl bootstatus ${plus} -b\n`);
  assert.ok(shutdown >= 0 && boot > shutdown, r.log);
  assert.equal(readFileSync(join(f.run, "sim.udid"), "utf8").trim(), plus);
  assert.equal(readFileSync(join(f.run, "sim.device"), "utf8").trim(), "16-plus");
  assert.doesNotMatch(r.log, new RegExp(oki));
});

test("同 run 的 Pro Max 已關機時直接開 Plus 並更新狀態", (t) => {
  const f = fixture(t, "r1");
  writeFileSync(join(f.run, "sim.udid"), proMax);
  writeFileSync(join(f.run, "sim.device"), "18-pro-max");
  const r = f.invoke("ios-up.sh", "16-plus");
  assert.equal(r.status, 0, r.output);
  assert.doesNotMatch(r.log, /simctl shutdown /);
  assert.ok(r.log.includes(`xcrun simctl bootstatus ${plus} -b\n`), r.log);
  assert.ok(r.log.includes(`xcrun simctl install ${plus} `), r.log);
  assert.equal(readFileSync(join(f.run, "sim.udid"), "utf8").trim(), plus);
  assert.equal(readFileSync(join(f.run, "sim.device"), "utf8").trim(), "16-plus");
  assert.doesNotMatch(r.log, new RegExp(oki));
});

for (const state of ["Booted", "Booting", "Shutting Down"]) {
  test(`其他 run 的 MO 機為 ${state} 時停止，不關機也不開另一台`, (t) => {
    const f = fixture(t, "r2", devices(state));
    const r = f.invoke("ios-up.sh", "18-pro-max");
    assert.notEqual(r.status, 0, r.output);
    assert.match(r.output, /可能有別的驗證在用/);
    assert.doesNotMatch(r.log, /simctl (boot|bootstatus|shutdown|create|install) /);
    assert.equal(existsSync(join(f.run, "sim.udid")), false);
  });
}

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

for (const condition of ["缺少", "不可用", "同名多台", "只有近似名稱"] as const) {
  test(`指定機型${condition}時停止，由使用者依 AGENTS.md 處理`, (t) => {
    const list = devices();
    if (condition === "缺少") list.splice(1, 1);
    if (condition === "不可用") list[1].isAvailable = false;
    if (condition === "同名多台") list.push({ ...list[1], udid: "44444444-4444-4444-4444-444444444444" });
    if (condition === "只有近似名稱") list[1].name += " Copy";
    const f = fixture(t, "r4", list);
    const r = f.invoke("ios-up.sh", "18-pro-max");
    assert.notEqual(r.status, 0, r.output);
    assert.match(r.output, /AGENTS\.md.*不新增模擬器.*請使用者處理/);
    assert.doesNotMatch(r.log, /simctl (create|boot|bootstatus|shutdown|install) /);
  });
}

test("down 只關機保留裝置，清除兩個狀態檔並保留證據及既有收尾", (t) => {
  const f = fixture(t, "r1");
  writeFileSync(join(f.run, "sim.udid"), plus);
  writeFileSync(join(f.run, "sim.device"), "16-plus");
  const evidence = join(f.run, "evidence/ios/16-plus/02-overview.png");
  mkdirSync(join(f.run, "evidence/ios/16-plus"));
  writeFileSync(evidence, "evidence");
  mkdirSync(join(f.run, "dd"));
  writeFileSync(join(f.run, "user.pw"), "test password");
  writeFileSync(join(f.run, "user.cj"), "test cookie");
  const r = f.invoke("down.sh");
  assert.equal(r.status, 0, r.output);
  assert.ok(r.log.includes(`xcrun simctl shutdown ${plus}\n`), r.log);
  assert.doesNotMatch(r.log, /simctl delete/);
  assert.match(r.output, /已關機（保留）/);
  for (const file of ["sim.udid", "sim.device", "dd", "user.pw", "user.cj", "state.env"]) {
    assert.equal(existsSync(join(f.run, file)), false, file);
  }
  assert.equal(existsSync(join(f.run, "state.env.down")), true);
  assert.equal(readFileSync(evidence, "utf8"), "evidence");
});

test("verify 文件一致使用兩台既有機型與保留裝置的生命週期", () => {
  const skill = join(repo, ".claude/skills/verify/SKILL.md");
  const features = join(repo, ".claude/skills/verify/features");
  const docs = [skill, join(repo, "AGENTS.md"), ...readdirSync(features).filter((f) => f.endsWith(".md")).map((f) => join(features, f))];
  for (const doc of docs) {
    assert.doesNotMatch(readFileSync(doc, "utf8"), /MO Verify|simctl create|simctl delete/, doc);
  }
  const text = readFileSync(skill, "utf8");
  assert.match(text, /16-plus/);
  assert.match(text, /18-pro-max/);
});
