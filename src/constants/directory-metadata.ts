/**
 * Directory metadata for ~/.claude/ entries.
 * Defines categories, entry metadata, and utility functions
 * for the Claude Code directory browser UI.
 */

// ---------------------------------------------------------------------------
// 1. Directory Categories
// ---------------------------------------------------------------------------

/** Category definitions for grouping ~/.claude/ directory entries. */
export const DIRECTORY_CATEGORIES = [
  {
    id: "user-config",
    label: "用户配置",
    description: "用户主动配置和管理的内容",
    icon: "Settings",
  },
  {
    id: "session-history",
    label: "会话与历史",
    description: "对话记录和操作历史",
    icon: "History",
  },
  {
    id: "runtime-data",
    label: "运行时数据",
    description: "系统自动生成的临时数据和缓存",
    icon: "Database",
  },
  {
    id: "project-task",
    label: "项目与任务",
    description: "项目级配置和任务管理",
    icon: "FolderKanban",
  },
  {
    id: "extension",
    label: "扩展功能",
    description: "插件、IDE 集成和用量统计",
    icon: "Puzzle",
  },
] as const;

/** Union type derived from DIRECTORY_CATEGORIES ids. */
export type CategoryId = (typeof DIRECTORY_CATEGORIES)[number]["id"];

// ---------------------------------------------------------------------------
// 2. Directory Entry Metadata Interface
// ---------------------------------------------------------------------------

/** Metadata for a single entry (file or directory) inside ~/.claude/. */
export interface DirectoryEntryMeta {
  /** Original directory/file name */
  name: string;
  /** Chinese description (1-2 sentences) */
  description: string;
  /** Category this entry belongs to */
  category: CategoryId;
  /** Whether the entry is a directory or a file */
  type: "directory" | "file";
  /** Path to dedicated management page, if exists */
  linkedPage?: string;
}

// ---------------------------------------------------------------------------
// 3. Directory Metadata Registry
// ---------------------------------------------------------------------------

/** All known entries in the ~/.claude/ directory, grouped by category. */
export const DIRECTORY_METADATA: readonly DirectoryEntryMeta[] = [
  // -- user-config (6) --
  {
    name: "settings.json",
    description:
      "全局设置文件，包含模型选择、权限默认模式、已启用插件和环境变量等配置。",
    category: "user-config",
    type: "file",
    linkedPage: "/settings",
  },
  {
    name: "settings.local.json",
    description:
      "本地设置文件，存放当前机器的权限白名单和输出样式等个人偏好，不会同步到其他设备。",
    category: "user-config",
    type: "file",
    linkedPage: "/settings",
  },
  {
    name: "CLAUDE.md",
    description:
      "全局记忆文件，Claude Code 每次启动时自动读取的持久化指令和个人偏好设定。",
    category: "user-config",
    type: "file",
    linkedPage: "/claude-md",
  },
  {
    name: "config",
    description:
      "用户级配置目录，存放更细粒度的配置文件（如自定义快捷键、主题等）。",
    category: "user-config",
    type: "directory",
  },
  {
    name: "agents",
    description:
      "自定义 Agent 定义目录，每个 .md 文件定义一个 Agent 的角色、能力和工作流程。",
    category: "user-config",
    type: "directory",
    linkedPage: "/agents",
  },
  {
    name: "skills",
    description:
      "技能定义目录，每个子目录包含一个 SKILL.md 文件，定义可复用的工作流技能。",
    category: "user-config",
    type: "directory",
    linkedPage: "/skills",
  },

  // -- session-history (5) --
  {
    name: "sessions",
    description:
      "会话存储目录，每个子目录对应一次 Claude Code 会话的完整记录（消息、工具调用等）。",
    category: "session-history",
    type: "directory",
  },
  {
    name: "history.jsonl",
    description:
      "对话历史日志文件，以 JSONL 格式记录所有会话的摘要信息，用于历史搜索和统计。",
    category: "session-history",
    type: "file",
  },
  {
    name: "session-env",
    description:
      "会话环境快照目录，保存每次会话启动时的 shell 环境变量和工作目录状态。",
    category: "session-history",
    type: "directory",
  },
  {
    name: "file-history",
    description:
      "文件编辑历史目录，记录 Claude Code 修改过的文件的版本快照，支持回滚操作。",
    category: "session-history",
    type: "directory",
  },
  {
    name: "shell-snapshots",
    description:
      "Shell 状态快照目录，保存会话过程中的终端状态，用于恢复中断的 shell 会话。",
    category: "session-history",
    type: "directory",
  },

  // -- runtime-data (7) --
  {
    name: "cache",
    description:
      "通用缓存目录，存放 API 响应缓存、索引数据等临时文件，可安全清理。",
    category: "runtime-data",
    type: "directory",
  },
  {
    name: "paste-cache",
    description:
      "剪贴板缓存目录，暂存用户粘贴的内容片段，避免重复传输大段文本。",
    category: "runtime-data",
    type: "directory",
  },
  {
    name: "downloads",
    description:
      "下载文件目录，Claude Code 下载的文件（如图片、附件）暂存于此。",
    category: "runtime-data",
    type: "directory",
  },
  {
    name: "backups",
    description:
      "备份目录，存放 Claude Code 自动生成的配置备份，在设置出错时可恢复。",
    category: "runtime-data",
    type: "directory",
  },
  {
    name: "debug",
    description:
      "调试日志目录，存放 Claude Code 运行时的调试信息，用于排查问题。",
    category: "runtime-data",
    type: "directory",
  },
  {
    name: "telemetry",
    description:
      "遥测数据目录，存放匿名使用统计数据，用于产品改进分析。",
    category: "runtime-data",
    type: "directory",
  },
  {
    name: "statsig",
    description:
      "功能开关目录，存放 A/B 测试和功能灰度发布的配置数据。",
    category: "runtime-data",
    type: "directory",
  },

  // -- project-task (4) --
  {
    name: "projects",
    description:
      "项目配置目录，每个子目录对应一个 Git 仓库的独立配置（如项目级 CLAUDE.md、权限规则等）。",
    category: "project-task",
    type: "directory",
  },
  {
    name: "plans",
    description:
      "计划目录，存放 Claude Code 生成的执行计划文件，记录复杂任务的分步方案。",
    category: "project-task",
    type: "directory",
  },
  {
    name: "tasks",
    description:
      "后台任务目录，存放远程 Agent 和定时任务的执行记录和状态。",
    category: "project-task",
    type: "directory",
  },
  {
    name: "todos",
    description:
      "待办事项目录，存放 Claude Code 在会话中创建的 TODO 列表和任务追踪记录。",
    category: "project-task",
    type: "directory",
  },

  // -- extension (4) --
  {
    name: "plugins",
    description:
      "插件目录，存放已安装的 MCP 插件数据（含 cache、data、marketplaces 子目录），扩展 Claude Code 的工具和能力。",
    category: "extension",
    type: "directory",
  },
  {
    name: "ide",
    description:
      "IDE 集成目录，存放与 VS Code、JetBrains 等编辑器的桥接配置和状态。",
    category: "extension",
    type: "directory",
  },
  {
    name: "usage-data",
    description:
      "用量统计目录，记录 API 调用次数、Token 消耗、会话时长等使用数据。",
    category: "extension",
    type: "directory",
  },
  {
    name: "agent-memory",
    description:
      "Agent 记忆目录，存放跨会话的 Agent 上下文记忆，使 Agent 在不同会话间保持一致性。",
    category: "extension",
    type: "directory",
  },
];

// ---------------------------------------------------------------------------
// 4. Utility Functions
// ---------------------------------------------------------------------------

/**
 * Count how many DIRECTORY_METADATA entries exist on disk per category.
 *
 * @param existingNames - Set of directory/file names that actually exist on disk
 * @returns Map from category id to count of matching entries
 */
export function getCategoryStats(
  existingNames: Set<string>,
): Map<CategoryId, number> {
  const stats = new Map<CategoryId, number>();

  // Initialize all categories with 0
  for (const cat of DIRECTORY_CATEGORIES) {
    stats.set(cat.id, 0);
  }

  // Count matching entries per category
  for (const entry of DIRECTORY_METADATA) {
    if (existingNames.has(entry.name)) {
      stats.set(entry.category, (stats.get(entry.category) ?? 0) + 1);
    }
  }

  return stats;
}
