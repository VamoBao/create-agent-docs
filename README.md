# create-agent-docs

一个 Claude Code skill：为你的项目一键生成一套 **Coding Agent 工作流文档**，让 Agent 在执行需求前先读文档了解项目结构与流程，完成后按流程落盘记录。可通过 `npx create-agent-docs-skill` 一键安装到项目，支持 Claude Code、Codex、OpenCode、pi。

## 它解决什么问题

直接让 Agent 改代码，常见三类翻车：

1. **需求没对齐就动手**——模糊需求直接产出模糊代码
2. **改完不留痕**——代码变了，架构认知、进度、决策记录全靠 Agent 会话记忆，下次会话全部丢失
3. **提交一团糟**——多个不相关修改混进一个 commit，代码和文档脱节

本 skill 生成的文档工作流逐一约束这些行为。

## 生成物

在目标项目中生成：

```text
项目根目录/
├── AGENTS.md          # 入口文档：项目背景、技术栈、目录结构、工作流指引
├── CLAUDE.md          # 仅一行 @AGENTS.md 导入（若已存在则不覆盖）
└── docs/
    ├── feature-check-guide.md   # 需求工作流：校验 → 任务包确认单 → 实现 → 落盘 → 原子提交
    ├── git-commit-guide.md      # Git 提交规范：Conventional Commits + 原子性/一致性约束
    └── bug-fix-guide.md         # 缺陷修复工作流：错误归因 → 修复策略 → 流程升级提醒
```

工作流依赖三份模块级状态文档（由 Agent 在任务过程中按需创建，不预生成）：

| 文档 | 内容 | 位置 |
|---|---|---|
| `ARCHITECTURE.md` | 模块架构蓝图、文件职责与依赖边界 | 目标模块目录内 |
| `PROGRESS.md` | 进度与已知 Bug | 目标模块目录内 |
| `DECISIONS.md` | 重大决策记录（背景、备选方案、结论） | 目标模块目录内 |

## 执行流程

skill 内置四步流程，按序执行、禁止跳步：

1. **勘察项目**——先看后问：技术栈、lint 配置、测试框架、已有文档、是否 git 仓库
2. **适配确认**——基于勘察结果一次性提出最多 3 个问题（静态检查 / 单元测试 / 自动 commit），每个附带推荐项
3. **生成文档**——模板先做技术栈适配再落盘；已有 `AGENTS.md`/`CLAUDE.md` 只追加不覆盖
4. **验证**——占位符、引用路径、命令可执行性、未破坏原有内容，全部通过才报告完成

## 安装

### npx 一键安装（推荐）

在目标项目根目录执行：

```bash
# 自动检测项目里已配置的 agent（.claude/.codex/.agents/.opencode/.pi）
npx create-agent-docs-skill

# 或显式指定 agent（claude/codex/opencode/pi，逗号分隔多选）
npx create-agent-docs-skill --agent claude,codex

# 或安装全部四家
npx create-agent-docs-skill --all

# 安装到用户级目录（所有项目可用；--global 需搭配 --agent 或 --all）
npx create-agent-docs-skill --all --global

# 覆盖已存在的安装
npx create-agent-docs-skill --agent claude --force
```

各 agent 的安装位置：

| Agent | 项目级 | 用户级（--global） |
|---|---|---|
| Claude Code | `.claude/skills/` | `~/.claude/skills/` |
| Codex | `.agents/skills/` | `~/.agents/skills/` |
| OpenCode | `.opencode/skills/` | `~/.config/opencode/skills/` |
| pi | `.pi/skills/` | `~/.pi/agent/skills/` |

注：`.agents/skills/` 是 Codex、OpenCode、pi 共享的通用约定，一份拷贝三家可读。

### 手动安装（备选）

```bash
# 复制到全局 skills 目录（所有项目可用）
cp -r . ~/.claude/skills/create-agent-docs

# 或复制到某个项目的 .claude/skills/ 下（仅该项目可用）
cp -r . <项目路径>/.claude/skills/create-agent-docs
```

## 使用

在目标项目中启动 Claude Code 后：

```text
/create-agent-docs
```

或直接说「帮我为这个项目建立 Agent 文档工作流」。

## 模板适配

`references/` 下的模板以**前端 TS 项目**为示例，落盘前会按勘察结论适配：

- **Python** → Ruff / pyright，`pytest` / `python -m <module>`
- **Java / Go / 其他** → Checkstyle / `go vet` + `golangci-lint` 等对应工具链
- **不启用测试** → 删除全部测试约束及 commit 规范中的 `test` 类型
- **手动提交模式**（默认）→ 需求工作流不含自动 commit，用户显式指令提交时才读取 `git-commit-guide.md`
- **非 git 仓库** → 不生成 `git-commit-guide.md`，工作流去除 commit 环节

## 文档结构

```text
.
├── SKILL.md                          # skill 本体：执行流程、适配规则、反模式
└── references/
    ├── agents-md-template.md         # 入口文档模板
    ├── feature-check-guide.md        # 需求工作流模板
    ├── git-commit-guide.md           # Git 提交规范模板
    └── bug-fix-guide.md              # 缺陷修复工作流模板
```

`references/` 模板也可以单独抽出来人工改造，作为团队自有工作流的起点。
