/**
 * Local daemon that polls a Linear QUEUE issue for PENDING markers
 * and executes workflow actions via `claude -p` (Claude Code CLI).
 *
 * Architecture: webhook writes PENDING to QUEUE issue (MAK-300),
 * daemon polls only that one issue's comments = 2 API calls per poll.
 *
 * Usage:
 *   bun run daemon              # continuous polling (60s interval)
 *   bun run daemon --once       # single poll then exit
 */

import { LinearClient } from "@linear/sdk";
import { spawn } from "node:child_process";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 60_000; // 60 seconds (~120 API calls/hour)
const CLAUDE_TIMEOUT_MS = 300_000; // 5 minutes per execution
const MAX_TURNS = 50;
const QUEUE_ISSUE_ID = "MAK-300";

const PENDING_PREFIX = "🤖 **⏳ PENDING:";
const DONE_PREFIX = "🤖 **✅ DONE:";
const ERROR_PREFIX = "🤖 **❌ ERROR:";

// ---------------------------------------------------------------------------
// System prompts per action
// ---------------------------------------------------------------------------

const SYSTEM_PROMPTS: Record<string, string> = {
  research: `你是 project-lead Agent（调研模式）。
你的任务是分析 Linear issue，产出 PRD、TRD 和 Task 拆分。

执行步骤：
1. 读取 issue 的标题和描述，判定是"需求"还是"技改"
2. 分支A（需求）：产出 PRD → Task 拆分
3. 分支B（技改）：产出 TRD → Task 拆分
4. 将所有产物以结构化 Markdown 格式输出`,

  advance: `你是 project-lead Agent（推进模式）。
你的任务是根据 issue 当前状态，推进到下一个工作流阶段。

状态机：
- 调研中 → 产出 PRD/TRD，推进到待开发
- 开发中 → 检查子任务完成情况，推进到待测试
- 待测试 → 执行测试，推进到待发布

请读取 issue 的当前状态和历史评论，执行对应阶段的工作。`,

  release: `你是 project-lead Agent（发布模式）。
你的任务是执行发布流程。

执行步骤：
1. 检查所有 PR 状态
2. 合并 PR（gh pr merge --merge --delete-branch）
3. 验证 Production 部署
4. 将结果以 Markdown 格式输出`,
};

// ---------------------------------------------------------------------------
// Rate limit handling
// ---------------------------------------------------------------------------

let rateLimitedUntil = 0; // timestamp when rate limit resets

function isRateLimited(): boolean {
  return Date.now() < rateLimitedUntil;
}

function handleRateLimitError(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);
  const resetMatch = message.match(/x-ratelimit-requests-reset.*?(\d{13})/);
  if (resetMatch) {
    rateLimitedUntil = parseInt(resetMatch[1]!, 10);
    const waitMinutes = Math.ceil((rateLimitedUntil - Date.now()) / 60_000);
    console.warn(`[daemon] Rate limited. Retry in ~${waitMinutes} minutes.`);
  } else {
    // Default: wait 5 minutes
    rateLimitedUntil = Date.now() + 5 * 60 * 1000;
    console.warn(`[daemon] Rate limited. Retry in ~5 minutes.`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsePendingMarker(body: string): { action: string; context: Record<string, string> | null } | null {
  const match = body.match(/⏳ PENDING: (\w+)/);
  if (!match) return null;

  const jsonMatch = body.match(/```json\n([\s\S]*?)\n```/);
  let context: Record<string, string> | null = null;
  if (jsonMatch) {
    try { context = JSON.parse(jsonMatch[1]!) as Record<string, string>; } catch { /* ignore */ }
  }

  return { action: match[1]!, context };
}

function executeClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", [
      "-p", "--output-format", "text", "--max-turns", String(MAX_TURNS),
    ], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { stderr += chunk.toString(); });

    child.stdin.write(prompt);
    child.stdin.end();

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("claude -p timed out"));
    }, CLAUDE_TIMEOUT_MS);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (stderr) console.error(`[daemon] claude stderr: ${stderr.slice(0, 300)}`);
      if (code !== 0 && code !== null) {
        reject(new Error(`claude -p exit ${code}: ${stderr.slice(0, 300)}`));
        return;
      }
      resolve(stdout.trim());
    });

    child.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`claude -p spawn error: ${err.message}`));
    });
  });
}

// ---------------------------------------------------------------------------
// Main poll loop
// ---------------------------------------------------------------------------

async function pollOnce(client: LinearClient): Promise<number> {
  if (isRateLimited()) {
    const waitMinutes = Math.ceil((rateLimitedUntil - Date.now()) / 60_000);
    console.log(`[daemon] Still rate limited, waiting ~${waitMinutes}m...`);
    return 0;
  }

  const queueIssue = await client.issue(QUEUE_ISSUE_ID);
  const comments = await queueIssue.comments({ first: 20 });

  let processedCount = 0;

  for (const comment of comments.nodes) {
    const body = comment.body;
    if (!body || !body.includes(PENDING_PREFIX)) continue;

    const parsed = parsePendingMarker(body);
    if (!parsed) continue;

    // Check if already resolved
    const hasResolution = comments.nodes.some(
      (c) =>
        new Date(c.createdAt) > new Date(comment.createdAt) &&
        c.body &&
        (c.body.includes(DONE_PREFIX) || c.body.includes(ERROR_PREFIX)),
    );
    if (hasResolution) continue;

    const { action, context } = parsed;
    const markerId = comment.id;
    const targetIssueId = context?.targetIssueId;
    const targetIdentifier = context?.targetIdentifier ?? "unknown";

    if (!targetIssueId) {
      console.error(`[daemon] PENDING missing targetIssueId, skipping`);
      continue;
    }

    console.log(`[daemon] Found PENDING: action=${action}, target=${targetIdentifier}`);

    const systemPrompt = SYSTEM_PROMPTS[action];
    if (!systemPrompt) {
      console.error(`[daemon] Unknown action: ${action}, skipping`);
      continue;
    }

    const userMessage = [
      `Issue ID: ${targetIssueId}`,
      `Issue Identifier: ${targetIdentifier}`,
      `Title: ${context?.title ?? "unknown"}`,
      `Description: ${context?.description ?? ""}`,
      `Current Status: ${context?.status ?? "Unknown"}`,
    ].join("\n");

    try {
      console.log(`[daemon] Executing claude -p for action=${action}...`);
      const prompt = `${systemPrompt}\n\n---\n\n${userMessage}`;
      const result = await executeClaude(prompt);

      // Write result on TARGET issue
      await client.createComment({
        issueId: targetIssueId,
        body: `🤖 **📋 Agent Result** (${action})\n\n${result}`,
      });

      // Mark resolved on QUEUE issue
      await client.createComment({
        issueId: queueIssue.id,
        body: `${DONE_PREFIX}${action}** — ${targetIdentifier} 完成`,
        parentId: markerId,
      });

      processedCount++;
      console.log(`[daemon] ✅ action=${action} target=${targetIdentifier} done`);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error(`[daemon] ❌ action=${action} target=${targetIdentifier}: ${errorMessage}`);

      // Write error on TARGET issue
      await client.createComment({
        issueId: targetIssueId,
        body: `🤖 **❌ Agent Error** (${action})\n\n${errorMessage}`,
      }).catch(() => {});

      // Mark error on QUEUE issue
      await client.createComment({
        issueId: queueIssue.id,
        body: `${ERROR_PREFIX}${action}** — ${targetIdentifier} 失败`,
        parentId: markerId,
      }).catch(() => {});

      processedCount++;
    }
  }

  return processedCount;
}

async function main() {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    console.error("[daemon] LINEAR_API_KEY is not set.");
    process.exit(1);
  }

  const client = new LinearClient({ apiKey });
  const runOnce = process.argv.includes("--once");

  console.log(`[daemon] Starting (mode: ${runOnce ? "once" : "continuous"})`);
  console.log(`[daemon] Poll interval: ${POLL_INTERVAL_MS / 1000}s`);
  console.log(`[daemon] Queue issue: ${QUEUE_ISSUE_ID}`);

  if (runOnce) {
    try {
      const count = await pollOnce(client);
      console.log(`[daemon] Processed ${count} pending task(s)`);
    } catch (err: unknown) {
      handleRateLimitError(err);
      console.error(`[daemon] Error: ${err instanceof Error ? err.message : String(err)}`);
    }
    process.exit(0);
  }

  while (true) {
    try {
      const count = await pollOnce(client);
      if (count > 0) console.log(`[daemon] Processed ${count} pending task(s)`);
    } catch (err: unknown) {
      handleRateLimitError(err);
      console.error(`[daemon] Poll error: ${err instanceof Error ? err.message : String(err)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main();
