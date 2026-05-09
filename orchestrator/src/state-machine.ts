import type { MainTaskStatus, StateTransition } from "./types.js";

/**
 * 主任务状态机 — 纯脚本判断，不让 LLM 决定状态流转。
 *
 * 状态流转图：
 *   待启动 ──Human──▶ 调研中 ──Orchestrator──▶ 待开发 ──Human──▶ 开发中
 *     ──Orchestrator──▶ 待测试 ──test_agent──▶ 测试中
 *     ──Orchestrator──▶ 待发布 ──Human──▶ 发布中
 *
 * Human 强校验点（3 处）：待启动→调研中、待开发→开发中、待发布→发布中
 */

const TRANSITIONS: StateTransition[] = [
  // Step 1: 调研阶段
  { from: "pending_start",  to: "researching",      trigger: "human",        requiresApproval: true },
  { from: "researching",    to: "pending_dev",      trigger: "orchestrator",  requiresApproval: false },

  // Step 2: 开发阶段
  { from: "pending_dev",    to: "in_development",   trigger: "human",        requiresApproval: true },
  { from: "in_development", to: "pending_test",     trigger: "orchestrator",  requiresApproval: false },

  // Step 3: 测试阶段
  { from: "pending_test",   to: "testing",          trigger: "orchestrator",  requiresApproval: false },
  { from: "testing",        to: "pending_release",  trigger: "test_agent",    requiresApproval: false },

  // Step 4: 发布阶段
  { from: "pending_release", to: "releasing",       trigger: "human",        requiresApproval: true },

  // 回退路径（Human 修改意见 / Bug 修复循环）
  { from: "pending_dev",    to: "researching",      trigger: "human",        requiresApproval: true },
  { from: "testing",        to: "in_development",   trigger: "orchestrator",  requiresApproval: false },
];

export class TaskStateMachine {
  private currentStatus: MainTaskStatus;

  constructor(initialStatus: MainTaskStatus = "pending_start") {
    this.currentStatus = initialStatus;
  }

  getStatus(): MainTaskStatus {
    return this.currentStatus;
  }

  /**
   * 校验状态转移是否合法。
   * @returns 合法的转移定义，或 null（非法转移）
   */
  canTransition(to: MainTaskStatus, trigger: StateTransition["trigger"]): StateTransition | null {
    return (
      TRANSITIONS.find(
        (t) => t.from === this.currentStatus && t.to === to && t.trigger === trigger
      ) ?? null
    );
  }

  /**
   * 执行状态转移。非法转移会抛错。
   */
  transition(to: MainTaskStatus, trigger: StateTransition["trigger"]): StateTransition {
    const rule = this.canTransition(to, trigger);
    if (!rule) {
      throw new Error(
        `非法状态转移: ${this.currentStatus} → ${to} (trigger=${trigger})`
      );
    }
    this.currentStatus = to;
    return rule;
  }

  /**
   * 获取当前状态所有可达的下一步（用于 Orchestrator 决策）。
   */
  getAvailableTransitions(trigger?: StateTransition["trigger"]): StateTransition[] {
    return TRANSITIONS.filter(
      (t) => t.from === this.currentStatus && (!trigger || t.trigger === trigger)
    );
  }

  /**
   * 当前状态是否需要 Human 审批才能前进。
   */
  requiresHumanApproval(to: MainTaskStatus): boolean {
    const rule = this.canTransition(to, "human");
    return rule?.requiresApproval ?? false;
  }
}
