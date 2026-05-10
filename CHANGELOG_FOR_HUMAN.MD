# Changelog for Human

> 给人看的项目变更记录。
> 目标：30 秒内了解"这个项目最近做了什么"。
> 规则：最新记录在前，每条记录可机械对齐，文件 < 50KB。

---

## 记录格式

每条记录严格遵循以下结构，字段之间用空行分隔：

```
### YYYY-MM-DD · <标签>

**摘要**：1-3 句话描述做了什么、为什么做。

**影响范围**：列出受影响的模块 / 文件 / 流程，逗号分隔。

---
```

**字段说明**：

| 字段 | 说明 | 约束 |
|---|---|---|
| 日期 | 记录发布日期 | `YYYY-MM-DD`，与 git commit 日期对齐 |
| 标签 | 简短分类词 | 从 `feat` / `fix` / `refactor` / `docs` / `chore` 中选，可加中文补充 |
| 摘要 | 变更内容 + 动机 | 1-3 句话，不超过 200 字 |
| 影响范围 | 受影响的区域 | 逗号分隔的关键词，如文件名、模块名、流程节点 |

**排序规则**：按日期降序，最新在前。

---

## 变更记录

### 2026-05-10 · refactor · v0.4

**摘要**：将发布流程从「CLI 直推 main」升级为「Feature 分支 + PR + Vercel Preview」模式。repo-worker 现在创建 PR 而非直接合并到 main；Vercel Git 集成自动部署 Preview 环境；发布阶段通过合并 PR 触发 Production 部署。

**影响范围**：repo-worker.md, release-phase SKILL.md, COWORK_INSTRUCTIONS.md §6-§7

---

### 2026-05-10 · docs

**摘要**：创建 CHANGELOG_FOR_HUMAN.MD，建立面向人类的变更记录模板。定义标准格式（日期、标签、摘要、影响范围），为后续版本追溯提供统一规范。

**影响范围**：CHANGELOG_FOR_HUMAN.MD

---

### 2026-05-10 · fix

**摘要**：修正 MCP Server 配置中的工具权限声明，更新 README 文档和展示页内容。确保 Claude Code 能正确识别和调用所需的 MCP 工具。

**影响范围**：`.claude/settings.json`, README.md, `app/`

---

### 2026-05-10 · refactor · v0.3

**摘要**：从 TypeScript Orchestrator 进程架构迁移到 Claude Code 原生 Agent + Skill 架构。移除了外部 TS 状态机进程，改为直接使用 Claude Code 的 sub-agent 能力调度各角色，简化了整体执行链路。同步落地 COWORK_INSTRUCTIONS.md v0.3：所有待定项（仓库全景、报告节奏、扩展角色、Vercel secrets）全部敲定。

**影响范围**：`.claude/agents/`, `.claude/skills/`, COWORK_INSTRUCTIONS.md, README.md

---

### 2026-05-10 · feat · v0.2

**摘要**：为 Linear 评论添加 Agent 角色标签，使每条评论可追溯到是由哪个 Agent 角色产出。同步更新 COWORK_INSTRUCTIONS.md 至 v0.2：统一术语（"项目 Agent 组长"→"Orchestrator"），补充 `claude -p` 启动参数细节，回填 fork 规则为 headless 子进程实现。

**影响范围**：Orchestrator 评论写入逻辑, COWORK_INSTRUCTIONS.md, `.claude/agents/`

---

### 2026-05-10 · docs

**摘要**：添加 README.md，介绍项目架构和当前自动化实现程度。补充项目入口文档，方便新协作者快速理解 mako-ai-claude-manager 的定位与能力边界。

**影响范围**：README.md

---

### 2026-05-10 · chore · v0.1

**摘要**：项目初始化。创建 Git 仓库，建立 COWORK_INSTRUCTIONS.md 多 Agent 并行工作流规范（v0.1 初版），搭建 `.claude/agents/` 角色定义目录和 `.claude/skills/` 技能目录骨架。

**影响范围**：COWORK_INSTRUCTIONS.md, `.claude/agents/`, `.claude/skills/`, 项目基础结构
