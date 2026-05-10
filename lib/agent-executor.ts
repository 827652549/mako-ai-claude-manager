/**
 * Agent executor - calls Claude API to execute workflow stages.
 *
 * Receives an action type + issue context, constructs the appropriate system
 * prompt, and calls @anthropic-ai/sdk messages.create.
 */

import Anthropic from "@anthropic-ai/sdk";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentResult {
  success: boolean;
  content: string;
  error?: string;
}

interface IssueContext {
  id: string;
  title: string;
  description: string;
  status: string;
}

// ---------------------------------------------------------------------------
// System prompts per action
// ---------------------------------------------------------------------------

const SYSTEM_PROMPTS: Record<string, string> = {
  research:
    "你是项目调研 Agent。分析 issue 的标题和描述，产出 PRD、TRD、Task 拆分。",
  advance:
    "你是项目 Orchestrator。根据 issue 当前状态推进到下一阶段。",
  release: "你是发布 Agent。执行发布流程。",
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_DURATION_MS = 60_000;

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Execute an agent workflow stage via the Claude API.
 *
 * @param action  - The workflow action: "research" | "advance" | "release"
 * @param issue   - The Linear issue context
 * @returns       - Structured result with success flag, content, and optional error
 */
export async function executeAgent(
  action: string,
  issue: IssueContext,
): Promise<AgentResult> {
  // 1. Validate action
  const systemPrompt = SYSTEM_PROMPTS[action];
  if (!systemPrompt) {
    return {
      success: false,
      content: "",
      error: `Unknown action: ${action}`,
    };
  }

  // 2. Validate API key
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return {
      success: false,
      content: "",
      error: "ANTHROPIC_API_KEY is not set",
    };
  }

  // 3. Set up timeout
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), MAX_DURATION_MS);

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create(
      {
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: [
              `Issue ID: ${issue.id}`,
              `Title: ${issue.title}`,
              `Description: ${issue.description}`,
              `Status: ${issue.status}`,
            ].join("\n"),
          },
        ],
      },
      { signal: controller.signal },
    );

    // Extract text from response content blocks
    const textBlock = response.content.find((block) => block.type === "text");
    const content =
      textBlock && "text" in textBlock ? textBlock.text : "";

    return { success: true, content };
  } catch (err: unknown) {
    if (err instanceof Error && err.name === "AbortError") {
      return {
        success: false,
        content: "",
        error: "Agent execution timed out",
      };
    }

    const message = err instanceof Error ? err.message : String(err);
    return { success: false, content: "", error: message };
  } finally {
    clearTimeout(timeout);
  }
}
