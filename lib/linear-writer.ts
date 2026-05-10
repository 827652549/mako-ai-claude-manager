/**
 * Linear writer - writes Agent execution results back to Linear.
 *
 * Creates comments on issues and optionally advances the issue state
 * through the workflow state machine.
 */

import { LinearClient } from "@linear/sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WriteResultParams {
  action: string;
  issueId: string;
  result: {
    success: boolean;
    content: string;
    error?: string;
  };
}

// ---------------------------------------------------------------------------
// State machine: current state -> next state for "advance" action
// ---------------------------------------------------------------------------

const STATE_ADVANCE_MAP: Record<string, string> = {
  // 调研中 -> 待开发
  "4144809b-3da6-4912-ad05-150cacfcc9aa": "48f095a8-1642-498a-ac8f-3b79e50c7784",
  // 待开发 -> 跳过（Human 校验点）
  // 开发中 -> 待测试
  "0561fd8e-4a0c-4298-aae3-487c1edceda6": "89ada667-ce8a-4464-91c5-5b20a31dddc1",
  // 待测试 -> 测试中
  "89ada667-ce8a-4464-91c5-5b20a31dddc1": "c7e45a1c-39cf-4dc7-bd1f-7174a0e60b19",
  // 测试中 -> 待发布（跳过，Human 校验点）
};

// ---------------------------------------------------------------------------
// Comment prefix rules (标签区分)
// ---------------------------------------------------------------------------

function buildCommentBody(action: string, content: string): string {
  const prefixes: Record<string, string> = {
    research: "🤖 **📋 PRD Agent**",
    advance: "🤖 **🚀 开发阶段完成**",
    release: "🤖 **🚀 Release**",
  };
  const prefix = prefixes[action] ?? "🤖 **📋 Agent**";
  return `${prefix}\n\n${content}`;
}

function buildErrorCommentBody(error: string): string {
  return `🤖 **❌ Agent Error**\n\n${error}`;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Write Agent execution results back to Linear.
 *
 * 1. Creates a comment on the issue with the Agent output.
 * 2. If action is "advance" and the result is successful, advances the
 *    issue state through the workflow state machine.
 * 3. On error, writes an error-prefixed comment.
 */
export async function writeResultToLinear(params: WriteResultParams): Promise<void> {
  const { action, issueId, result } = params;

  // 1. Validate API key
  const apiKey = process.env.LINEAR_API_KEY;
  if (!apiKey) {
    throw new Error("LINEAR_API_KEY is not set");
  }

  const linearClient = new LinearClient({ apiKey });

  // 2. Build comment body
  const commentBody = result.success
    ? buildCommentBody(action, result.content)
    : buildErrorCommentBody(result.error ?? "Unknown error");

  // 3. Create comment on the issue
  await linearClient.createComment({
    issueId,
    body: commentBody,
  });

  // 4. If advance action and success, attempt state transition
  if (action === "advance" && result.success) {
    try {
      // Fetch the issue to get its current state
      const issue = await linearClient.issue(issueId);
      const currentStateId = issue.stateId;

      if (!currentStateId) {
        console.warn(`[linear-writer] Issue ${issueId} has no stateId, skipping state transition`);
        return;
      }

      const nextStateId = STATE_ADVANCE_MAP[currentStateId];

      if (!nextStateId) {
        console.warn(
          `[linear-writer] No state transition defined for state ${currentStateId}, skipping`,
        );
        return;
      }

      // Update the issue state
      await linearClient.updateIssue(issueId, {
        stateId: nextStateId,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[linear-writer] Failed to advance issue state: ${message}`);
      // Write an error comment about the failed state transition
      await linearClient.createComment({
        issueId,
        body: buildErrorCommentBody(`State transition failed: ${message}`),
      });
    }
  }
}
