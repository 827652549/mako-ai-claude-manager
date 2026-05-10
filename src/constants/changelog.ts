/**
 * Static changelog data parsed from CHANGELOG_FOR_HUMAN.MD.
 * Each entry represents a versioned or unversioned change record,
 * sorted by date descending (newest first).
 */

// ---------------------------------------------------------------------------
// 1. Type Definitions
// ---------------------------------------------------------------------------

/** Allowed changelog classification tags. */
export type ChangelogType = 'feat' | 'fix' | 'refactor' | 'docs' | 'chore';

/** A single change entry with summary and affected scope. */
export interface ChangelogEntry {
  type: ChangelogType;
  summary: string;
  scope: string;
}

/** A versioned changelog record grouping one or more entries. */
export interface ChangelogVersion {
  /** Semantic version string, e.g. "v0.5"; empty string if unversioned. */
  version: string;
  /** ISO date string, e.g. "2026-05-10". */
  date: string;
  /** Primary classification tag. */
  type: ChangelogType;
  /** Change entries belonging to this version. */
  entries: ChangelogEntry[];
}

// ---------------------------------------------------------------------------
// 2. Changelog Data (sorted by date descending)
// ---------------------------------------------------------------------------

export const CHANGELOG: readonly ChangelogVersion[] = [
  {
    version: 'v0.5',
    date: '2026-05-10',
    type: 'feat',
    entries: [
      {
        type: 'feat',
        summary:
          '实现 Linear Webhook 驱动的自治工作流。部署 Vercel Function 接收 Linear 事件，本地 Daemon 轮询 Queue issue 并通过 `claude -p` 执行工作流。用户只需在 Linear 中评论"继续"/"发布"即可推进工作流，无需 CLI 介入。',
        scope: 'api/webhook.ts, daemon.ts, package.json, vercel.json, README.md, MAK-300 (Queue issue)',
      },
    ],
  },
  {
    version: 'v0.4',
    date: '2026-05-10',
    type: 'refactor',
    entries: [
      {
        type: 'refactor',
        summary:
          '将发布流程从「CLI 直推 main」升级为「Feature 分支 + PR + Vercel Preview」模式。repo-worker 现在创建 PR 而非直接合并到 main；Vercel Git 集成自动部署 Preview 环境；发布阶段通过合并 PR 触发 Production 部署。',
        scope: 'repo-worker.md, release-phase SKILL.md, COWORK_INSTRUCTIONS.md §6-§7',
      },
    ],
  },
  {
    version: '',
    date: '2026-05-10',
    type: 'docs',
    entries: [
      {
        type: 'docs',
        summary:
          '创建 CHANGELOG_FOR_HUMAN.MD，建立面向人类的变更记录模板。定义标准格式（日期、标签、摘要、影响范围），为后续版本追溯提供统一规范。',
        scope: 'CHANGELOG_FOR_HUMAN.MD',
      },
    ],
  },
  {
    version: '',
    date: '2026-05-10',
    type: 'fix',
    entries: [
      {
        type: 'fix',
        summary:
          '修正 MCP Server 配置中的工具权限声明，更新 README 文档和展示页内容。确保 Claude Code 能正确识别和调用所需的 MCP 工具。',
        scope: '`.claude/settings.json`, README.md, `app/`',
      },
    ],
  },
  {
    version: 'v0.3',
    date: '2026-05-10',
    type: 'refactor',
    entries: [
      {
        type: 'refactor',
        summary:
          '从 TypeScript Orchestrator 进程架构迁移到 Claude Code 原生 Agent + Skill 架构。移除了外部 TS 状态机进程，改为直接使用 Claude Code 的 sub-agent 能力调度各角色，简化了整体执行链路。同步落地 COWORK_INSTRUCTIONS.md v0.3：所有待定项（仓库全景、报告节奏、扩展角色、Vercel secrets）全部敲定。',
        scope: '`.claude/agents/`, `.claude/skills/`, COWORK_INSTRUCTIONS.md, README.md',
      },
    ],
  },
  {
    version: 'v0.2',
    date: '2026-05-10',
    type: 'feat',
    entries: [
      {
        type: 'feat',
        summary:
          '为 Linear 评论添加 Agent 角色标签，使每条评论可追溯到是由哪个 Agent 角色产出。同步更新 COWORK_INSTRUCTIONS.md 至 v0.2：统一术语（"项目 Agent 组长"→"Orchestrator"），补充 `claude -p` 启动参数细节，回填 fork 规则为 headless 子进程实现。',
        scope: 'Orchestrator 评论写入逻辑, COWORK_INSTRUCTIONS.md, `.claude/agents/`',
      },
    ],
  },
  {
    version: '',
    date: '2026-05-10',
    type: 'docs',
    entries: [
      {
        type: 'docs',
        summary:
          '添加 README.md，介绍项目架构和当前自动化实现程度。补充项目入口文档，方便新协作者快速理解 mako-ai-claude-manager 的定位与能力边界。',
        scope: 'README.md',
      },
    ],
  },
  {
    version: 'v0.1',
    date: '2026-05-10',
    type: 'chore',
    entries: [
      {
        type: 'chore',
        summary:
          '项目初始化。创建 Git 仓库，建立 COWORK_INSTRUCTIONS.md 多 Agent 并行工作流规范（v0.1 初版），搭建 `.claude/agents/` 角色定义目录和 `.claude/skills/` 技能目录骨架。',
        scope: 'COWORK_INSTRUCTIONS.md, `.claude/agents/`, `.claude/skills/`, 项目基础结构',
      },
    ],
  },
];
