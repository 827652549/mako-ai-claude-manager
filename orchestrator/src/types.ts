import { z } from "zod";

// ── 主任务状态（8 态） ──────────────────────────────────────
export const MainTaskStatus = z.enum([
  "pending_start",     // 待启动
  "researching",       // 调研中
  "pending_dev",       // 待开发
  "in_development",    // 开发中
  "pending_test",      // 待测试
  "testing",           // 测试中
  "pending_release",   // 待发布
  "releasing",         // 发布中
]);
export type MainTaskStatus = z.infer<typeof MainTaskStatus>;

// ── 子任务状态（3 态） ──────────────────────────────────────
export const SubTaskStatus = z.enum([
  "todo",
  "in_progress",
  "done",
]);
export type SubTaskStatus = z.infer<typeof SubTaskStatus>;

// ── 入口分支 ────────────────────────────────────────────────
export const BranchType = z.enum([
  "requirement",  // 需求 → PRD → UX → UI → 架构
  "tech_reform",  // 技改 → 架构（TRD）
]);
export type BranchType = z.infer<typeof BranchType>;

// ── 角色定义 ────────────────────────────────────────────────
export const AgentRole = z.enum([
  "prd_agent",
  "ux_agent",
  "ui_agent",
  "repo_architect",
  "repo_worker",
  "test_agent",
  "web_researcher",
  "report_writer",
  "report_editor",
]);
export type AgentRole = z.infer<typeof AgentRole>;

// ── 角色 .md 文件元数据 ─────────────────────────────────────
export interface AgentConfig {
  role: AgentRole;
  mdFile: string;           // .claude/agents/<name>.md
  tools: string[];          // --allowedTools
  maxTurns: number;         // --max-turns
}

// ── Linear Task 结构 ────────────────────────────────────────
export interface LinearTask {
  id: string;
  title: string;
  description?: string;
  status: MainTaskStatus | SubTaskStatus;
  parentId?: string;
  step?: number;            // 并发分组
  blockedBy?: string[];     // 依赖的 Task ID 列表
  labels?: string[];
  projectId?: string;
}

// ── Orchestrator 事件 ───────────────────────────────────────
export interface OrchestratorEvent {
  type: "status_change" | "task_created" | "comment_added" | "deploy_triggered";
  taskId: string;
  timestamp: number;
  payload: Record<string, unknown>;
}

// ── 子进程执行结果 ──────────────────────────────────────────
export interface AgentResult {
  success: boolean;
  output: string;           // 结构化 JSON 输出
  commits?: string[];       // commit refs
  changedFiles?: string[];
  error?: string;
}

// ── 状态机转移规则 ──────────────────────────────────────────
export interface StateTransition {
  from: MainTaskStatus;
  to: MainTaskStatus;
  trigger: "human" | "orchestrator" | "test_agent";
  requiresApproval: boolean;
}
