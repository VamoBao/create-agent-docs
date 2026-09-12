import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs, AGENTS, detectAgents, resolveTargets, installSkill, main } from "../bin/cli.mjs";

const PKG_ROOT = fileURLToPath(new URL("..", import.meta.url));

function tmpProj(...dirs) {
  const root = mkdtempSync(join(tmpdir(), "cad-test-"));
  for (const d of dirs) mkdirSync(join(root, d), { recursive: true });
  return root;
}

test("无参数 → 全部默认值，agents 为 null（走自动检测）", () => {
  const r = parseArgs([]);
  assert.deepEqual(r, { agents: null, all: false, global: false, force: false, help: false });
});

test("--agent claude,pi → agents 数组", () => {
  const r = parseArgs(["--agent", "claude,pi"]);
  assert.deepEqual(r.agents, ["claude", "pi"]);
});

test("--agent 不认识的名称 → error", () => {
  const r = parseArgs(["--agent", "unknown"]);
  assert.match(r.error, /unknown/);
});

test("--all --global --force 组合", () => {
  const r = parseArgs(["--all", "--global", "--force"]);
  assert.equal(r.all, true);
  assert.equal(r.global, true);
  assert.equal(r.force, true);
});

test("--agent 缺值 → error", () => {
  const r = parseArgs(["--agent"]);
  assert.ok(r.error);
});

test("AGENTS 注册表含四个 agent 且路径与规格一致", () => {
  assert.deepEqual(Object.keys(AGENTS), ["claude", "codex", "opencode", "pi"]);
  assert.equal(AGENTS.codex.project, ".agents/skills");
  assert.equal(AGENTS.pi.global, "~/.pi/agent/skills");
});

test("检测到 .claude → [claude]", () => {
  const root = tmpProj(".claude");
  assert.deepEqual(detectAgents(root), ["claude"]);
  rmSync(root, { recursive: true, force: true });
});

test("检测到 .codex → [codex]（映射到 codex 的 .agents 路径）", () => {
  const root = tmpProj(".codex");
  assert.deepEqual(detectAgents(root), ["codex"]);
  rmSync(root, { recursive: true, force: true });
});

test("检测到 .agents → [codex]（共享路径，OpenCode/pi 原生兼容读取）", () => {
  const root = tmpProj(".agents");
  assert.deepEqual(detectAgents(root), ["codex"]);
  rmSync(root, { recursive: true, force: true });
});

test("多 agent 目录 → 按注册表顺序去重列出", () => {
  const root = tmpProj(".pi", ".opencode", ".claude");
  assert.deepEqual(detectAgents(root), ["claude", "opencode", "pi"]);
  rmSync(root, { recursive: true, force: true });
});

test("什么都没有 → []", () => {
  const root = tmpProj();
  assert.deepEqual(detectAgents(root), []);
  rmSync(root, { recursive: true, force: true });
});

test("只看目录本身，不误认同名文件", () => {
  const root = mkdtempSync(join(tmpdir(), "cad-test-"));
  writeFileSync(join(root, ".claude"), "");
  assert.deepEqual(detectAgents(root), []);
  rmSync(root, { recursive: true, force: true });
});

test("resolveTargets 项目级", () => {
  const t = resolveTargets(["claude"], { global: false, baseDir: "/proj" });
  assert.deepEqual(t, [{ name: "claude", dir: "/proj/.claude/skills/create-agent-docs" }]);
});

test("resolveTargets 全局级展开 ~", () => {
  const t = resolveTargets(["pi"], { global: true, baseDir: "/proj", home: "/home/tester" });
  assert.deepEqual(t, [{ name: "pi", dir: "/home/tester/.pi/agent/skills/create-agent-docs" }]);
});

test("installSkill 首次安装 → installed，文件齐全", () => {
  const root = tmpProj();
  const result = installSkill(PKG_ROOT, join(root, "skills", "create-agent-docs"), false);
  assert.equal(result, "installed");
  assert.ok(existsSync(join(root, "skills", "create-agent-docs", "SKILL.md")));
  const refs = readdirSync(join(root, "skills", "create-agent-docs", "references"));
  assert.deepEqual(refs.sort(), [
    "agents-md-template.md", "bug-fix-guide.md", "feature-check-guide.md", "git-commit-guide.md",
  ]);
  rmSync(root, { recursive: true, force: true });
});

test("installSkill 二次安装 → skipped，不改动", () => {
  const root = tmpProj();
  const dir = join(root, "skills", "create-agent-docs");
  installSkill(PKG_ROOT, dir, false);
  assert.equal(installSkill(PKG_ROOT, dir, false), "skipped");
  rmSync(root, { recursive: true, force: true });
});

test("installSkill --force → 覆盖后仍 installed", () => {
  const root = tmpProj();
  const dir = join(root, "skills", "create-agent-docs");
  installSkill(PKG_ROOT, dir, false);
  assert.equal(installSkill(PKG_ROOT, dir, true), "installed");
  rmSync(root, { recursive: true, force: true });
});

function run(argv, projDirs) {
  const root = tmpProj(...projDirs);
  const lines = [];
  const code = main(argv, { cwd: root, home: join(root, "fakehome"), stdout: (s) => lines.push(s) });
  return { code, lines, root };
}

test("main 自动检测安装 claude", () => {
  const { code, lines, root } = run(["--agent", "claude"], []);
  assert.equal(code, 0);
  assert.ok(lines.join("\n").includes(".claude/skills/create-agent-docs"));
  assert.ok(existsSync(join(root, ".claude/skills/create-agent-docs/SKILL.md")));
  rmSync(root, { recursive: true, force: true });
});

test("main 检测不到任何 agent 且未指定 → 退出码 1 并提示", () => {
  const { code, lines, root } = run([], []);
  assert.equal(code, 1);
  assert.ok(lines.join("\n").includes("--agent"));
  rmSync(root, { recursive: true, force: true });
});

test("main 自动检测多个 agent 全装", () => {
  const { code, root } = run([], [".claude", ".pi"]);
  assert.equal(code, 0);
  assert.ok(existsSync(join(root, ".claude/skills/create-agent-docs/SKILL.md")));
  assert.ok(existsSync(join(root, ".pi/skills/create-agent-docs/SKILL.md")));
  rmSync(root, { recursive: true, force: true });
});

test("main 幂等：二次运行跳过但退出码 0", () => {
  const first = run(["--agent", "claude"], []);
  const second = main(["--agent", "claude"], { cwd: first.root, home: join(first.root, "fakehome"), stdout: () => {} });
  assert.equal(second, 0);
  rmSync(first.root, { recursive: true, force: true });
});

test("main --all 装四家", () => {
  const { code, root } = run(["--all"], []);
  assert.equal(code, 0);
  for (const d of [".claude/skills", ".agents/skills", ".opencode/skills", ".pi/skills"]) {
    assert.ok(existsSync(join(root, d, "create-agent-docs/SKILL.md")), d);
  }
  rmSync(root, { recursive: true, force: true });
});

test("main --global 单独使用 → 退出码 1 且提示需配合 --agent/--all", () => {
  const { code, lines, root } = run(["--global"], []);
  assert.equal(code, 1);
  const out = lines.join("\n");
  assert.ok(out.includes("--global"), "提示应提到 --global 本身");
  assert.ok(out.includes("--agent"), "提示应指向 --agent/--all");
  rmSync(root, { recursive: true, force: true });
});

test("main --agent 空白值（agents 为 []）与 null 同等对待，走自动检测", () => {
  const { code, root } = run(["--agent", " "], [".claude"]);
  assert.equal(code, 0);
  assert.ok(existsSync(join(root, ".claude/skills/create-agent-docs/SKILL.md")));
  rmSync(root, { recursive: true, force: true });
});

test("main --help 退出码 0", () => {
  const { code, root } = run(["--help"], []);
  assert.equal(code, 0);
  rmSync(root, { recursive: true, force: true });
});
