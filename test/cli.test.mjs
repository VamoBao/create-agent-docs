import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { parseArgs, AGENTS, detectAgents } from "../bin/cli.mjs";

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
