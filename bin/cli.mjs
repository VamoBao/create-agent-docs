#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, realpathSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";

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

const SKILL_NAME = "create-agent-docs";

export function resolveTargets(names, { global, baseDir = process.cwd(), home = homedir() }) {
  return names.map((name) => {
    const raw = global ? AGENTS[name].global : join(baseDir, AGENTS[name].project);
    const dir = raw.startsWith("~") ? join(home, raw.slice(1)) : raw;
    return { name, dir: join(dir, SKILL_NAME) };
  });
}

export function installSkill(pkgRoot, targetDir, force) {
  if (existsSync(targetDir) && !force) return "skipped";
  mkdirSync(targetDir, { recursive: true });
  cpSync(join(pkgRoot, "SKILL.md"), join(targetDir, "SKILL.md"));
  cpSync(join(pkgRoot, "references"), join(targetDir, "references"), { recursive: true });
  return "installed";
}

const HELP_TEXT = `create-agent-docs-skill — 安装 create-agent-docs skill

用法:
  npx create-agent-docs-skill                自动检测项目已配置的 agent
  npx create-agent-docs-skill --agent a,b    指定 agent（claude,codex,opencode,pi）
  npx create-agent-docs-skill --all          安装全部 agent
选项:
  --global   安装到用户级目录而非项目目录
  --force    覆盖已存在的安装
  --help     显示本帮助
`;

export function main(argv, { cwd = process.cwd(), home = homedir(), stdout = (s) => process.stdout.write(s) } = {}) {
  const pkgRoot = fileURLToPath(new URL("..", import.meta.url));
  const args = parseArgs(argv);

  if (args.error) {
    stdout(`✖ ${args.error}\n运行 --help 查看用法。\n`);
    return 1;
  }
  if (args.help) {
    stdout(HELP_TEXT);
    return 0;
  }

  const names = args.all ? Object.keys(AGENTS)
    : args.agents ?? (args.global ? null : detectAgents(cwd));
  if (!names || names.length === 0) {
    stdout("✖ 未检测到已配置的 coding agent 目录（.claude/.codex/.agents/.opencode/.pi）。\n" +
      "  用 --agent claude,codex,opencode,pi 指定，或 --all 安装全部。\n");
    return 1;
  }

  const lines = ["✔ create-agent-docs 已安装到:"];
  let failed = 0;
  for (const t of resolveTargets(names, { global: args.global, baseDir: cwd, home })) {
    try {
      const r = installSkill(pkgRoot, t.dir, args.force);
      lines.push(`  • ${t.dir}   (${t.name}${r === "skipped" ? ", 已存在，跳过；用 --force 覆盖" : ""})`);
    } catch (err) {
      failed++;
      lines.push(`  ✖ ${t.dir}   (${t.name}) 安装失败: ${err.message}`);
    }
  }
  stdout(lines.join("\n") + "\n在目标项目启动 agent 后，使用 /create-agent-docs 触发。\n");
  return failed > 0 ? 1 : 0;
}

// 入口守卫：npx/npm 会通过 .bin 下的符号链接调用本文件，此时 process.argv[1] 是
// 链接路径而 import.meta.url 是真实路径，需先 realpath 再比较，否则守卫永不触发。
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href) {
  process.exit(main(process.argv.slice(2)));
}
