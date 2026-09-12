#!/usr/bin/env node
import { statSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export const AGENTS = {
  claude:   { project: ".claude/skills",    global: "~/.claude/skills" },
  codex:    { project: ".agents/skills",    global: "~/.agents/skills" },
  opencode: { project: ".opencode/skills",  global: "~/.config/opencode/skills" },
  pi:       { project: ".pi/skills",        global: "~/.pi/agent/skills" },
};

export function parseArgs(argv) {
  const r = { agents: null, all: false, global: false, force: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") { r.help = true; }
    else if (a === "--all") { r.all = true; }
    else if (a === "--global") { r.global = true; }
    else if (a === "--force") { r.force = true; }
    else if (a === "--agent") {
      const val = argv[++i];
      if (!val) return { ...r, error: "--agent 需要一个以逗号分隔的 agent 列表" };
      const names = val.split(",").map((s) => s.trim()).filter(Boolean);
      const bad = names.filter((n) => !(n in AGENTS));
      if (bad.length) {
        return { ...r, error: `未知的 agent: ${bad.join(", ")}（可用: ${Object.keys(AGENTS).join(", ")}）` };
      }
      r.agents = names;
    }
    else { return { ...r, error: `未知的参数: ${a}` }; }
  }
  return r;
}

// 目录存在信号 → agent 名。.codex 和 .agents 都映射到 codex。
const DETECT_RULES = [
  [".claude", "claude"],
  [".codex", "codex"],
  [".agents", "codex"],
  [".opencode", "opencode"],
  [".pi", "pi"],
];

export function detectAgents(cwd) {
  const found = new Set();
  for (const [dir, agent] of DETECT_RULES) {
    try {
      if (statSync(join(cwd, dir)).isDirectory()) found.add(agent);
    } catch { /* 不存在 */ }
  }
  return Object.keys(AGENTS).filter((n) => found.has(n));
}
