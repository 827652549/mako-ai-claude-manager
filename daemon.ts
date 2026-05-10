/**
 * Local daemon that polls Linear for PENDING markers and executes
 * workflow actions via `claude -p` (Claude Code CLI).
 *
 * Usage:
 *   bun run daemon              # start polling
 *   bun run daemon --once       # single poll then exit
 */

import { LinearClient } from "@linear/sdk";
import { spawn } from "node:child_process";

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 5_000; // 5 seconds
const CLAUDE_TIMEOUT_MS = 300_000; // 5 minutes per execution
const MAX_TURNS = 50;

// Marker comment prefixes
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
4. 将所有产物以结构化 Markdown 格式输出

输出格式（严格遵守）：
---PRD_START---
（PRD 内容）
---PRD_END---

---TASK_BREAKDOWN_START---
（JSON 格式的 Task 拆分）
---TASK_BREAKDOWN_END---`,

  advance: `你是 project-lead Agent（推进模式）。
你的任务是根据 issue 当前状态，推进到下一个工作流阶段。

状态机：
- 调研中 → 产出 PRD/TRD，推进到待开发
- 开发中 → 检查子任务完成情况，推进到待测试
- 待测试 → 执行测试，推进到待发布

请读取 issue 的当前状态和历史评论，执行对应阶段的工作。
将执行结果以 Markdown 格式输出。`,

  release: `你是 project-lead Agent（发布模式）。
你的任务是执行发布流程。

执行步骤：
1. 检查所有 PR 状态
2. 合并 PR（gh pr merge --merge --delete-branch）
3. 验证 Production 部署
4. 将结果以 Markdown 格式输出`,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parsePendingMarker(body: string): { action: string } | null {
  const match = body.match(/⏳ PENDING: (\w+)/);
  if (!match) return null;
  return { action: match[1]! };
}

function parseContextFromMarker(body: string): Record<string, string> | null {
  const jsonMatch = body.match(/```json\n([\s\S]*?)\n```/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[1]!) as Record<string, string>;
  } catch {
    return null;
  }
}

/**
 * Execute `claude -p` with the given prompt via stdin.
 * claude -p reads prompt from stdin when no positional arg is given.
 */
function executeClaude(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("claude", [
      "-p",
      "--output-format", "text",
      "--max-turns", String(MAX_TURNS),
    ], {
      stdio: ["pipe", "pipe", "pipe"],
      env: { ...process.env },
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString();
    });
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
    });

    // Write prompt to stdin and close
    child.stdin.write(prompt);
    child.stdin.end();

    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("claude -p timed out"));
    }, CLAUDE_TIMEOUT_MS);

    child.on("close", (code) => {
      clearTimeout(timer);
      if (stderr) {
        console.error(`[daemon] claude stderr: ${stderr.slice(0, 500)}`);
      }
      if (code !== 0 && code !== null) {
        reject(new Error(`claude -p exited with code ${code}: ${stderr.slice(0, 500)}`));
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
  const team = await client.team("244e065a-d5e3-4a57-bdf9-c482c6cb479f");
  const issues = await team.issues({
    filter: {
      state: { type: { nin: ["completed", "canceled"] } },
    },
    first: 20,
  });

  let processedCount = 0;

  for (const issue of issues.nodes) {
    const comments = await issue.comments({ first: 20,  });

    for (const comment of comments.nodes) {
      const body = comment.body;
      if (!body || !body.includes(PENDING_PREFIX)) continue;

      const parsed = parsePendingMarker(body);
      if (!parsed) continue;

      // Check if already resolved (has DONE or ERROR after this comment)
      const hasResolution = comments.nodes.some(
        (c) =>
          new Date(c.createdAt) > new Date(comment.createdAt) &&
          c.body &&
          (c.body.includes(DONE_PREFIX) || c.body.includes(ERROR_PREFIX)),
      );
      if (hasResolution) continue;

      const markerId = comment.id;
      const action = parsed.action;
      const issueId = issue.id;

      console.log(`[daemon] Found PENDING: action=${action}, issue=${issue.identifier}`);

      const context = parseContextFromMarker(body);
      const state = await issue.state;

      const userMessage = [
        `Issue ID: ${issueId}`,
        `Issue Identifier: ${issue.identifier}`,
        `Title: ${issue.title}`,
        `Description: ${issue.description ?? "(empty)"}`,
        `Current Status: ${state?.name ?? "Unknown"}`,
        context ? `Additional Context: ${JSON.stringify(context)}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      const systemPrompt = SYSTEM_PROMPTS[action];
      if (!systemPrompt) {
        console.error(`[daemon] Unknown action: ${action}, skipping`);
        continue;
      }

      try {
        console.log(`[daemon] Executing claude -p for action=${action}...`);
        const prompt = `${systemPrompt}\n\n---\n\n${userMessage}`;
        const result = await executeClaude(prompt);

        // Write DONE comment with full result
        await client.createComment({
          issueId,
          body: `${DONE_PREFIX}${action}**\n\n${result}`,
        });

        // Reply to PENDING marker
        await client.createComment({
          issueId,
          body: `${DONE_PREFIX}${action}** — 执行完成`,
          parentId: markerId,
        });

        processedCount++;
        console.log(`[daemon] ✅ action=${action} issue=${issue.identifier} done`);
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error(`[daemon] ❌ action=${action} issue=${issue.identifier}: ${errorMessage}`);

        await client.createComment({
          issueId,
          body: `${ERROR_PREFIX}${action}**\n\n${errorMessage}`,
        });

        processedCount++;
      }
    }
  }

  return processedCount;
}

async function main() {
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    console.error("[daemon] LINEAR_API_KEY is not set. Add it to .env or environment.");
    process.exit(1);
  }

  const client = new LinearClient({ apiKey });
  const runOnce = process.argv.includes("--once");

  console.log(`[daemon] Starting (mode: ${runOnce ? "once" : "continuous"})`);
  console.log(`[daemon] Poll interval: ${POLL_INTERVAL_MS / 1000}s`);

  if (runOnce) {
    const count = await pollOnce(client);
    console.log(`[daemon] Processed ${count} pending task(s)`);
    process.exit(0);
  }

  while (true) {
    try {
      const count = await pollOnce(client);
      if (count > 0) {
        console.log(`[daemon] Processed ${count} pending task(s)`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[daemon] Poll error: ${message}`);
    }

    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }
}

main();
