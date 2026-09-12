import { test } from "node:test";
import assert from "node:assert/strict";
import { parseArgs, AGENTS } from "../bin/cli.mjs";

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
