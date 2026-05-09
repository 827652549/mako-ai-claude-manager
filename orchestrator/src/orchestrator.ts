import { TaskStateMachine } from "./state-machine.js";
import { runAgent } from "./claude-runner.js";
import * as linear from "./linear-client.js";
import * as vercel from "./vercel-client.js";
import type {
  AgentConfig,
  AgentRole,
  AgentResult,
  BranchType,
  LinearTask,
  MainTaskStatus,
  OrchestratorEvent,
} from "./types.js";

/**
 * Orchestrator — 单项目状态机 + 调度器
 *
 * 每个 Linear 主任务对应一个 Orchestrator 实例。
 * 职责：
 *   1. 持有状态机，所有状态切换都是脚本判断
 *   2. 通过 Linear GraphQL API 读写 Task 状态/评论
 *   3. 通过 `claude -p` 拉起角色子进程
 *   4. 通过 Vercel REST API 触发 preview/production 部署
 *   5. 汇总子任务结果，决策下一步
 *
 * 禁止：
 *   - 让 LLM 决定状态流转
 *   - 未经 Human 授权触发 production 部署
 *   - 跨项目通信（通过 Human 协调）
 */

// ── 角色配置表 ──────────────────────────────────────────────
const AGENT_CONFIGS: Record<AgentRole, AgentConfig> = {
  prd_agent:       { role: "prd_agent",       mdFile: ".claude/agents/prd-agent.md",       tools: ["WebSearch"],                                          maxTurns: 5 },
  ux_agent:        { role: "ux_agent",        mdFile: ".claude/agents/ux-agent.md",        tools: ["WebSearch"],                                          maxTurns: 5 },
  ui_agent:        { role: "ui_agent",        mdFile: ".claude/agents/ui-agent.md",        tools: ["WebSearch"],                                          maxTurns: 5 },
  repo_architect:  { role: "repo_architect",  mdFile: ".claude/agents/repo-architect.md",  tools: ["Read", "Bash", "WebSearch"],                          maxTurns: 10 },
  repo_worker:     { role: "repo_worker",     mdFile: ".claude/agents/repo-worker.md",     tools: ["Read", "Edit", "Write", "Bash"],                      maxTurns: 20 },
  test_agent:      { role: "test_agent",      mdFile: ".claude/agents/test-agent.md",      tools: ["Read", "Bash", "WebSearch"],                          maxTurns: 10 },
  web_researcher:  { role: "web_researcher",  mdFile: ".claude/agents/web-researcher.md",  tools: ["WebSearch", "WebFetch"],                              maxTurns: 5 },
  report_writer:   { role: "report_writer",   mdFile: ".claude/agents/report-writer.md",   tools: ["Read", "Write"],                                      maxTurns: 5 },
  report_editor:   { role: "report_editor",   mdFile: ".claude/agents/report-editor.md",   tools: ["Read"],                                               maxTurns: 3 },
};

// ── Agent 角色标签（方案 A：评论格式标记）────────────────────
const AGENT_TAGS: Record<AgentRole | "orchestrator", string> = {
  prd_agent:       "📋 PRD Agent",
  ux_agent:        "🎨 UX Agent",
  ui_agent:        "🖌️ UI Agent",
  repo_architect:  "🏗️ 架构 Agent",
  repo_worker:     "💻 执行 Agent",
  test_agent:      "🧪 测试 Agent",
  web_researcher:  "🔍 搜索专家",
  report_writer:   "📝 报告撰写",
  report_editor:   "✏️ 报告审核",
  orchestrator:    "🤖 Orchestrator",
};

// ── 主任务状态 → Linear WorkflowState ID 映射 ──────────────
// 启动时从 Linear 拉取，缓存在内存中
let stateIdCache: Map<string, string> | null = null;

async function getStateIdMap(teamId: string): Promise<Map<string, string>> {
  if (stateIdCache) return stateIdCache;
  const states = await linear.getWorkflowStates(teamId);
  stateIdCache = new Map(states.map((s) => [s.name, s.id]));
  return stateIdCache;
}

// 状态名映射（文档中的中文名 → Linear 中的实际状态名）
const STATUS_NAME_MAP: Record<MainTaskStatus, string> = {
  pending_start: "待启动",
  researching: "调研中",
  pending_dev: "待开发",
  in_development: "开发中",
  pending_test: "待测试",
  testing: "测试中",
  pending_release: "待发布",
  releasing: "发布中",
};

export interface OrchestratorOptions {
  linearIssueId: string;    // Linear issue ID（UUID）
  teamId: string;           // Linear team ID
  repoPath: string;         // 仓库根目录
  vercelProjectId?: string; // Vercel project ID（用于部署）
  initialStatus?: MainTaskStatus;
}

export class Orchestrator {
  private stateMachine: TaskStateMachine;
  private linearIssueId: string;
  private teamId: string;
  private repoPath: string;
  private vercelProjectId: string | undefined;
  private events: OrchestratorEvent[] = [];

  constructor(options: OrchestratorOptions) {
    this.linearIssueId = options.linearIssueId;
    this.teamId = options.teamId;
    this.repoPath = options.repoPath;
    this.vercelProjectId = options.vercelProjectId;
    this.stateMachine = new TaskStateMachine(options.initialStatus ?? "pending_start");
  }

  // ── 状态查询 ──────────────────────────────────────────────
  getStatus(): MainTaskStatus {
    return this.stateMachine.getStatus();
  }

  getEvents(): OrchestratorEvent[] {
    return [...this.events];
  }

  // ── 状态转移（带 Linear 写入） ────────────────────────────
  async transitionTo(
    to: MainTaskStatus,
    trigger: "human" | "orchestrator" | "test_agent",
    comment?: string
  ): Promise<void> {
    const rule = this.stateMachine.transition(to, trigger);
    await this.updateLinearStatus(to, comment);
    this.pushEvent("status_change", { from: rule.from, to, trigger, comment });
  }

  // ── Step 1: 调研阶段 ─────────────────────────────────────
  async runResearchPhase(branch: BranchType, background: string): Promise<void> {
    if (branch === "requirement") {
      const prd = await this.callAgent("prd_agent", `需求背景：\n${background}`);
      await this.postLinearComment(`## PRD\n\n${prd.output}`, "prd_agent");

      const ux = await this.callAgent("ux_agent", `PRD：\n${prd.output}`);
      await this.postLinearComment(`## UX 流程\n\n${ux.output}`, "ux_agent");

      const ui = await this.callAgent("ui_agent", `UX 流程：\n${ux.output}`);
      await this.postLinearComment(`## UI 设计稿\n\n${ui.output}`, "ui_agent");

      const arch = await this.callAgent("repo_architect", [
        `PRD：\n${prd.output}`,
        `UX：\n${ux.output}`,
        `UI：\n${ui.output}`,
        `仓库路径：${this.repoPath}`,
        `intent=task-breakdown`,
      ].join("\n\n"));
      await this.createSubTasksFromBreakdown(arch.output);
    } else {
      const arch = await this.callAgent("repo_architect", [
        `技改背景：\n${background}`,
        `仓库路径：${this.repoPath}`,
        `intent=trd`,
      ].join("\n\n"));
      await this.postLinearComment(`## TRD\n\n${arch.output}`, "repo_architect");
      await this.createSubTasksFromBreakdown(arch.output);
    }

    await this.transitionTo("pending_dev", "orchestrator", "调研完成，Task 拆分已创建");
  }

  // ── Step 2: 开发阶段 ─────────────────────────────────────
  async runDevelopmentPhase(subTasks: LinearTask[]): Promise<void> {
    const steps = this.groupByStep(subTasks);

    for (const [, tasks] of steps) {
      const results = await Promise.all(
        tasks.map((task) => this.executeSubTask(task))
      );

      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        const result = results[i];
        if (!result.success) {
          await this.handleSubTaskFailure(task, result);
          return;
        }
        await this.markSubTaskDone(task, result);
      }
    }

    await this.deployPreview();
    await this.transitionTo("pending_test", "orchestrator", "开发完成，preview 已部署");
  }

  // ── Step 3: 测试阶段 ─────────────────────────────────────
  async runTestPhase(previewUrl: string, prdSummary: string): Promise<void> {
    await this.transitionTo("testing", "orchestrator");

    const testResult = await this.callAgent("test_agent", [
      `Preview URL: ${previewUrl}`,
      `PRD/TRD 验收标准：\n${prdSummary}`,
      `仓库路径：${this.repoPath}`,
    ].join("\n\n"));

    const bugs = this.parseTestBugs(testResult.output);
    if (bugs.length > 0) {
      await this.createBugTask(bugs);
      await this.transitionTo("in_development", "orchestrator", `发现 ${bugs.length} 个 bug`);
    } else {
      await this.transitionTo("pending_release", "orchestrator", "测试通过，无新增 bug");
    }
  }

  // ── Step 4: 发布阶段 ─────────────────────────────────────
  async runReleasePhase(): Promise<void> {
    const hasApproval = await this.checkProductionApproval();
    if (!hasApproval) {
      throw new Error("缺少 Human 生产部署授权，拒绝继续");
    }

    await this.deployProduction();
  }

  // ── 内部方法 ──────────────────────────────────────────────

  private async callAgent(role: AgentRole, prompt: string): Promise<AgentResult> {
    const config = AGENT_CONFIGS[role];
    return runAgent(config, { prompt, cwd: this.repoPath });
  }

  private async updateLinearStatus(status: MainTaskStatus, comment?: string): Promise<void> {
    const stateMap = await getStateIdMap(this.teamId);
    const stateName = STATUS_NAME_MAP[status];
    const stateId = stateMap.get(stateName);
    if (!stateId) {
      throw new Error(`Linear 状态 "${stateName}" 不存在，请检查 Workflow 配置`);
    }

    await linear.updateIssueStatus(this.linearIssueId, stateId);

    if (comment) {
      await this.postLinearComment(`[状态变更] → ${stateName}\n\n${comment}`, "orchestrator");
    }
  }

  private async postLinearComment(
    content: string,
    role: AgentRole | "orchestrator" = "orchestrator"
  ): Promise<void> {
    const tag = AGENT_TAGS[role] ?? AGENT_TAGS.orchestrator;
    await linear.addComment(this.linearIssueId, `**${tag}**\n\n${content}`);
  }

  private async createSubTasksFromBreakdown(breakdownJson: string): Promise<void> {
    let tasks: Array<{ title: string; description?: string; step?: number; blockedBy?: string[] }>;
    try {
      const parsed = JSON.parse(breakdownJson);
      tasks = parsed.tasks ?? (Array.isArray(parsed) ? parsed : [parsed]);
    } catch {
      // 如果 JSON 解析失败，作为纯文本评论落库，等待 Human 介入
      await this.postLinearComment(`## Task 拆分（需人工处理）\n\n${breakdownJson}`);
      return;
    }

    const created: Array<{ index: number; id: string; identifier: string }> = [];
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      const desc = [
        task.description ?? "",
        task.step != null ? `\n\n**Step**: ${task.step}` : "",
      ].join("");

      const issue = await linear.createSubIssue(
        this.linearIssueId,
        task.title,
        desc,
        this.teamId
      );
      created.push({ index: i, id: issue.id, identifier: issue.identifier });
    }

    // 处理 blockedBy 依赖关系
    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      if (task.blockedBy?.length) {
        // TODO: 将 blockedBy 索引映射为实际 issue ID，设置依赖关系
        // Linear 目前不原生支持 blocked_by 字段，用评论标注
        const deps = task.blockedBy
          .map((idx) => created.find((c) => String(c.index) === idx)?.identifier)
          .filter(Boolean);
        if (deps.length) {
          await linear.addComment(
            created[i].id,
            `**依赖**: blocked by ${deps.join(", ")}`
          );
        }
      }
    }
  }

  private groupByStep(tasks: LinearTask[]): Map<number, LinearTask[]> {
    const map = new Map<number, LinearTask[]>();
    for (const task of tasks) {
      const step = task.step ?? 0;
      if (!map.has(step)) map.set(step, []);
      map.get(step)!.push(task);
    }
    return new Map([...map.entries()].sort(([a], [b]) => a - b));
  }

  private async executeSubTask(task: LinearTask): Promise<AgentResult> {
    // 注入 §8.1 的 4 项上下文
    const issue = await linear.getIssue(task.id);
    const prdComments = issue.comments.nodes
      .filter((c) => c.body.includes("## PRD") || c.body.includes("## TRD"))
      .map((c) => c.body)
      .join("\n\n");

    const prompt = [
      `# Task: ${task.title}`,
      task.description ?? "",
      "",
      "## PRD/TRD 上下文",
      prdComments || "(无)",
      "",
      `## 仓库路径: ${this.repoPath}`,
    ].join("\n");

    return this.callAgent("repo_worker", prompt);
  }

  private async handleSubTaskFailure(task: LinearTask, result: AgentResult): Promise<void> {
    const tag = AGENT_TAGS.repo_worker;
    await linear.addComment(
      task.id,
      `**${tag}**\n\n**执行失败**\n\n${result.error ?? "未知错误"}\n\n\`\`\`\n${result.output.slice(0, 500)}\n\`\`\``
    );
    // 任务回退到 Todo（Orchestrator 决策：重试 / 拆细 / 升级 Human）
    console.log(`[Orchestrator] 子任务失败: ${task.title}, 需要决策: 重试/拆细/升级Human`);
  }

  private async markSubTaskDone(task: LinearTask, result: AgentResult): Promise<void> {
    const tag = AGENT_TAGS.repo_worker;
    await linear.addComment(
      task.id,
      `**${tag}**\n\n**执行完成**\n\n${result.output.slice(0, 500)}`
    );
    // TODO: 置子任务为 Done（需要 Linear state ID）
  }

  private async deployPreview(): Promise<void> {
    if (!this.vercelProjectId) {
      console.log("[Vercel] 未配置 vercelProjectId，跳过 preview 部署");
      return;
    }

    // 获取最近的部署（假设最新的就是当前 PR 的）
    const { deployments } = await vercel.listDeployments(this.vercelProjectId, 1);
    if (!deployments.length) {
      console.log("[Vercel] 无部署记录");
      return;
    }

    const latest = deployments[0];
    if (latest.readyState !== "READY") {
      const ready = await vercel.waitForDeployment(latest.id);
      await this.postLinearComment(`**Preview URL**: https://${ready.url}`, "orchestrator");
    } else {
      await this.postLinearComment(`**Preview URL**: https://${latest.url}`, "orchestrator");
    }
  }

  private parseTestBugs(output: string): Array<{ title: string; severity: string; description: string }> {
    try {
      const parsed = JSON.parse(output);
      return parsed.bugs ?? [];
    } catch {
      return [];
    }
  }

  private async createBugTask(bugs: Array<{ title: string; severity: string; description: string }>): Promise<void> {
    for (const bug of bugs) {
      await linear.createSubIssue(
        this.linearIssueId,
        `[Bug] ${bug.title}`,
        `**严重程度**: ${bug.severity}\n\n${bug.description}`,
        this.teamId
      );
    }
  }

  private async checkProductionApproval(): Promise<boolean> {
    const issue = await linear.getIssue(this.linearIssueId);
    const hasApproval = issue.comments.nodes.some((c) =>
      c.body.includes("APPROVE_PRODUCTION_DEPLOY")
    );
    return hasApproval;
  }

  private async deployProduction(): Promise<void> {
    if (!this.vercelProjectId) {
      throw new Error("未配置 vercelProjectId，无法部署");
    }

    // 获取最新的 preview 部署并 promote
    const { deployments } = await vercel.listDeployments(this.vercelProjectId, 5);
    const readyDeployment = deployments.find(
      (d) => d.readyState === "READY" && !d.gitSource?.ref?.includes("main")
    );

    if (!readyDeployment) {
      throw new Error("没有可用的 preview 部署用于 promote");
    }

    const production = await vercel.promoteDeployment(readyDeployment.id);
    await this.postLinearComment(
      `**生产部署完成**\n\nURL: https://${production.url}\nDeployment ID: ${production.id}`,
      "orchestrator"
    );
  }

  private pushEvent(type: OrchestratorEvent["type"], payload: Record<string, unknown>): void {
    this.events.push({
      type,
      taskId: this.linearIssueId,
      timestamp: Date.now(),
      payload,
    });
  }
}
