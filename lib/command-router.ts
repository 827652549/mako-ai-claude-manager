/**
 * Command router - parses Linear webhook payloads and returns the matched
 * action type together with the associated issue ID.
 */

// ---------------------------------------------------------------------------
// Payload types
// ---------------------------------------------------------------------------

interface CommentPayload {
  action: string;
  type: "Comment";
  data: {
    body: string;
    issue: { id: string };
  };
}

interface IssuePayload {
  action: string;
  type: "Issue";
  data: {
    id: string;
    state: { name: string };
  };
}

type WebhookPayload = CommentPayload | IssuePayload;

// ---------------------------------------------------------------------------
// Return type
// ---------------------------------------------------------------------------

export type Action = "research" | "advance" | "release" | "ignore";

export interface CommandResult {
  action: Action;
  issueId: string;
}

// ---------------------------------------------------------------------------
// Main function
// ---------------------------------------------------------------------------

/**
 * Parse a Linear webhook payload and return the matched action + issue ID.
 *
 * Matching rules (evaluated in order):
 *  1. Comment body exact match (after trim) "继续"  -> advance
 *  2. Comment body contains "发布" or "APPROVE" (case-insensitive) -> release
 *  3. Issue created with state "调研中"               -> research
 *  4. Anything else                                  -> ignore
 */
export default function parseCommand(payload: WebhookPayload): CommandResult {
  // --- Comment events ---
  if (payload.type === "Comment") {
    const issueId = payload.data.issue.id;
    const body = payload.data.body.trim();

    // 1) Exact match: "继续"
    if (body === "继续") {
      return { action: "advance", issueId };
    }

    // 2) Contains "发布" or "APPROVE" (case-insensitive)
    if (body.includes("发布") || body.toUpperCase().includes("APPROVE")) {
      return { action: "release", issueId };
    }

    return { action: "ignore", issueId };
  }

  // --- Issue events ---
  if (payload.type === "Issue") {
    const issueId = payload.data.id;

    // 3) Issue created with state "调研中"
    if (
      payload.action === "create" &&
      payload.data.state.name === "调研中"
    ) {
      return { action: "research", issueId };
    }

    return { action: "ignore", issueId };
  }

  // Fallback
  return { action: "ignore", issueId: "" };
}
