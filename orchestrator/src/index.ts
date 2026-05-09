import { Orchestrator } from "./orchestrator.js";
import type { BranchType, LinearTask, MainTaskStatus } from "./types.js";

/**
 * Cowork Orchestrator 入口
 *
 * 用法：
 *   npx tsx src/index.ts --issue-id=<linear-issue-id> --team-id=<linear-team-id> --repo=<path> [--status=<status>] [--vercel-project=<id>]
 *
 * 环境变量：
 *   LINEAR_API_KEY  — Linear GraphQL API token
 *   VERCEL_TOKEN    — Vercel REST API token
 *
 * 事件驱动：
 *   - 生产模式：监听 Linear webhook（TODO）
 *   - 开发模式：CLI 手动触发
 */

interface CliArgs {
  issueId: string;
  teamId: string;
  repo: string;
  status: MainTaskStatus;
  vercelProjectId?: string;
  branch?: BranchType;
  background?: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  const parsed: Record<string, string> = {};
  for (const arg of args) {
    const [key, value] = arg.replace(/^--/, "").split("=");
    parsed[key] = value;
  }

  if (!parsed["issue-id"] || !parsed["team-id"]) {
    console.error("用法: npx tsx src/index.ts --issue-id=<id> --team-id=<id> --repo=<path> [--status=<status>] [--vercel-project=<id>]");
    process.exit(1);
  }

  return {
    issueId: parsed["issue-id"],
    teamId: parsed["team-id"],
    repo: parsed["repo"] ?? process.cwd(),
    status: (parsed["status"] as MainTaskStatus) ?? "pending_start",
    vercelProjectId: parsed["vercel-project"],
    branch: parsed["branch"] as BranchType | undefined,
    background: parsed["background"],
  };
}

async function main() {
  const args = parseArgs();

  console.log(`[Orchestrator] 启动`);
  console.log(`  Issue ID:  ${args.issueId}`);
  console.log(`  Team ID:   ${args.teamId}`);
  console.log(`  Repo:      ${args.repo}`);
  console.log(`  Status:    ${args.status}`);
  if (args.vercelProjectId) console.log(`  Vercel:    ${args.vercelProjectId}`);

  const orchestrator = new Orchestrator({
    linearIssueId: args.issueId,
    teamId: args.teamId,
    repoPath: args.repo,
    vercelProjectId: args.vercelProjectId,
    initialStatus: args.status,
  });

  // TODO: 生产模式下改为事件驱动循环
  // 目前为单次执行模式，便于开发调试

  const status = orchestrator.getStatus();
  console.log(`[Orchestrator] 当前状态: ${status}`);

  // 根据当前状态决定下一步
  switch (status) {
    case "pending_start":
      console.log("[Orchestrator] 等待 Human 触发：待启动 → 调研中");
      break;

    case "researching":
      if (args.branch && args.background) {
        await orchestrator.runResearchPhase(args.branch, args.background);
      } else {
        console.log("[Orchestrator] 需要 --branch 和 --background 参数");
      }
      break;

    case "pending_dev":
      console.log("[Orchestrator] 等待 Human 放行：待开发 → 开发中");
      break;

    case "in_development":
      // 从 Linear 拉取子任务列表并执行
      console.log("[Orchestrator] 从 Linear 获取子任务列表...");
      // TODO: 通过 linear.getIssue() 获取 children，转为 LinearTask[] 后调用 runDevelopmentPhase
      console.log("[Orchestrator] 需要实现子任务获取逻辑");
      break;

    case "pending_test":
      console.log("[Orchestrator] 自动进入测试阶段");
      break;

    case "pending_release":
      console.log("[Orchestrator] 等待 Human 上线决策");
      break;

    default:
      console.log(`[Orchestrator] 状态 ${status} 无自动处理逻辑`);
  }

  // 输出事件日志
  const events = orchestrator.getEvents();
  if (events.length > 0) {
    console.log(`\n[Orchestrator] 执行了 ${events.length} 个事件:`);
    for (const event of events) {
      console.log(`  - ${event.type}: ${JSON.stringify(event.payload)}`);
    }
  }
}

main().catch((err) => {
  console.error("[Orchestrator] 致命错误:", err);
  process.exit(1);
});
