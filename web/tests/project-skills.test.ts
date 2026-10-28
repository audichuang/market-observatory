import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { test } from "node:test";

const repo = resolve(import.meta.dirname, "../..");
const skillsRoot = join(repo, ".claude/skills");
const REQUIRED = ["verify", "research-round"];
const skills = readdirSync(skillsRoot, { withFileTypes: true })
  .filter((entry) => !entry.isSymbolicLink() && entry.isDirectory())
  .map((entry) => entry.name);
const repoPath = /^(?:web\/(?:src|scripts|docs|tests|db|routes|pages)\/|\.claude\/skills\/|ios\/MarketObservatory)/;

function markdownFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return markdownFiles(path);
    return entry.isFile() && entry.name.endsWith(".md") ? [path] : [];
  });
}

function frontmatterField(header: string, field: string): string {
  const match = header.match(new RegExp(`^${field}:[ \\t]*(.*(?:\\n[ \\t]+[^\\n]*)*)`, "m"));
  assert.ok(match, `frontmatter 缺少 ${field}`);
  return match[1].replace(/^[|>][-+]?(?:[ \t]*\n|$)/, "").trim().replace(/^(["'])([\s\S]*)\1$/, "$2");
}

function linkTargets(markdown: string): string[] {
  const inline = [...markdown.matchAll(/!?\[[^\]\n]*\]\(([^)\n]+)\)/g)].map((match) => match[1]);
  const references = [...markdown.matchAll(/^\s*\[[^\]\n]+\]:\s*(.+)$/gm)].map((match) => match[1]);
  return [...inline, ...references].map((target) => {
    const match = target.match(/^<([^>]+)>|^(\S+)/);
    assert.ok(match, `無效的 Markdown 連結：${target}`);
    return match[1] ?? match[2];
  });
}

test("專案必備 skills 都是非 symlink 目錄", () => {
  for (const name of REQUIRED) assert.ok(skills.includes(name), `缺少必備 skill：${name}`);
});

for (const name of skills) {
  const directory = join(skillsRoot, name);
  const files = markdownFiles(directory);

  test(`${name} 的 frontmatter 名稱與描述有效`, () => {
    const skill = join(directory, "SKILL.md");
    assert.ok(existsSync(skill), `${name} 缺少 SKILL.md`);
    const header = readFileSync(skill, "utf8").match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/);
    assert.ok(header, `${name}/SKILL.md 缺少 frontmatter`);
    assert.equal(frontmatterField(header[1], "name"), name);
    const description = frontmatterField(header[1], "description");
    assert.ok(description.length > 0 && description.length <= 1024, `${name} 的 description 須為 1–1024 字元`);
  });

  test(`${name} 的 Markdown 路徑與相對連結存在`, () => {
    for (const file of files) {
      const markdown = readFileSync(file, "utf8");
      const label = relative(repo, file);
      for (const [, code] of markdown.matchAll(/`([^`\n]+)`/g)) {
        if (!repoPath.test(code) || /[<*{]/.test(code)) continue;
        const path = code.replace(/:\d+(?:-\d+)?$/, "");
        assert.ok(existsSync(join(repo, path)), `${label} 引用不存在的路徑：${code}`);
      }
      for (const target of linkTargets(markdown)) {
        if (/^(?:https?:\/\/|mailto:|#)/i.test(target)) continue;
        const path = decodeURIComponent(target.split("#")[0]);
        assert.ok(existsSync(resolve(dirname(file), path)), `${label} 的相對連結不存在：${target}`);
      }
    }
  });

  test(`${name} 的 evals 符合專案格式`, () => {
    const path = join(directory, "evals/evals.json");
    if (name === "verify" && !existsSync(path)) return;
    assert.ok(existsSync(path), `${name} 缺少 evals/evals.json`);
    const data = JSON.parse(readFileSync(path, "utf8"));
    assert.equal(data.skill_name, name);
    assert.ok(Array.isArray(data.evals) && data.evals.length >= 3, `${name} 至少需要 3 個 eval`);
    for (const entry of data.evals) {
      assert.ok(typeof entry.id === "number" || (typeof entry.id === "string" && entry.id.trim()), `${name} 的 eval 缺少 id`);
      for (const field of ["name", "prompt", "expected_output"]) {
        assert.ok(typeof entry[field] === "string" && entry[field].trim(), `${name} eval ${entry.id} 缺少 ${field}`);
      }
    }
  });
}

test("research-round 的 Markdown 只引用 forecast 門檻", () => {
  const directory = join(skillsRoot, "research-round");
  assert.ok(existsSync(directory), "缺少必備 skill：research-round");
  for (const file of markdownFiles(directory)) {
    const markdown = readFileSync(file, "utf8");
    for (const value of ["0.025", "0.045", "N = 199", "k=40", "k = 40", "0.011"]) {
      assert.ok(!markdown.includes(value), `${relative(repo, file)} 複製了 forecast 門檻：${value}`);
    }
  }
});

for (const path of ["SKILL.md", "references/templates.md"]) {
  test(`research-round ${path} 的計算提案容許其他終點並另列標的`, () => {
    const markdown = readFileSync(join(skillsRoot, "research-round", path), "utf8");
    const proposal = markdown.split("\n").find((line) => line.includes("建議事前登記的計算") && line.includes("target"));
    assert.ok(proposal, `${path} 缺少 target 提案規則`);
    assert.match(proposal, /up／dd5.*--target/, `${path} 應保留現行展望的 target 定義`);
    assert.match(proposal, /其他計算[^。]*終點[^。]*標籤定義/, `${path} 將 target 限定為 up／dd5，未提供其他終點與標籤定義的填法`);
    assert.match(proposal, /另列標的|標的另列/, `${path} 應將 target 與標的分列`);
  });
}
