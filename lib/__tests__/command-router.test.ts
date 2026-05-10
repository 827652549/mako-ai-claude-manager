import { describe, it } from "node:test";
import assert from "node:assert/strict";
import parseCommand from "../command-router.js";

// ---------------------------------------------------------------------------
// Helpers – minimal payload factories
// ---------------------------------------------------------------------------

function commentPayload(body: string, issueId = "issue-1") {
  return {
    action: "create",
    type: "Comment" as const,
    data: { body, issue: { id: issueId } },
  };
}

function issuePayload(
  action: "create" | "update",
  stateName: string,
  issueId = "issue-2"
) {
  return {
    action,
    type: "Issue" as const,
    data: { id: issueId, state: { name: stateName } },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("parseCommand", () => {
  // --- advance (继续) -------------------------------------------------------
  it('returns advance for exact match "继续"', () => {
    const result = parseCommand(commentPayload("继续"));
    assert.deepStrictEqual(result, { action: "advance", issueId: "issue-1" });
  });

  it('returns advance for " 继续 " with surrounding whitespace', () => {
    const result = parseCommand(commentPayload("  继续  "));
    assert.deepStrictEqual(result, { action: "advance", issueId: "issue-1" });
  });

  it('returns advance for "继续" with various whitespace characters', () => {
    const result = parseCommand(commentPayload("\t继续\n"));
    assert.deepStrictEqual(result, { action: "advance", issueId: "issue-1" });
  });

  // --- release (发布 / APPROVE) ---------------------------------------------
  it('returns release for comment containing "发布"', () => {
    const result = parseCommand(commentPayload("发布"));
    assert.deepStrictEqual(result, { action: "release", issueId: "issue-1" });
  });

  it('returns release when "发布" is part of a longer message', () => {
    const result = parseCommand(commentPayload("请发布这个版本"));
    assert.deepStrictEqual(result, { action: "release", issueId: "issue-1" });
  });

  it('returns release for exact match "APPROVE"', () => {
    const result = parseCommand(commentPayload("APPROVE"));
    assert.deepStrictEqual(result, { action: "release", issueId: "issue-1" });
  });

  it('returns release for "approve" (case-insensitive)', () => {
    const result = parseCommand(commentPayload("approve"));
    assert.deepStrictEqual(result, { action: "release", issueId: "issue-1" });
  });

  it('returns release for "Approve" mixed case', () => {
    const result = parseCommand(commentPayload("Approve"));
    assert.deepStrictEqual(result, { action: "release", issueId: "issue-1" });
  });

  it('returns release for text containing APPROVE', () => {
    const result = parseCommand(commentPayload("LGTM, APPROVE this PR"));
    assert.deepStrictEqual(result, { action: "release", issueId: "issue-1" });
  });

  // --- research (Issue created + 调研中) ------------------------------------
  it('returns research for Issue created with state "调研中"', () => {
    const result = parseCommand(issuePayload("create", "调研中"));
    assert.deepStrictEqual(result, { action: "research", issueId: "issue-2" });
  });

  it('returns ignore for Issue created with state other than "调研中"', () => {
    const result = parseCommand(issuePayload("create", "待办"));
    assert.deepStrictEqual(result, { action: "ignore", issueId: "issue-2" });
  });

  it('returns ignore for Issue updated with state "调研中"', () => {
    const result = parseCommand(issuePayload("update", "调研中"));
    assert.deepStrictEqual(result, { action: "ignore", issueId: "issue-2" });
  });

  // --- ignore (fallback) ----------------------------------------------------
  it("returns ignore for a comment with plain text", () => {
    const result = parseCommand(commentPayload("这是一条普通评论"));
    assert.deepStrictEqual(result, { action: "ignore", issueId: "issue-1" });
  });

  it('returns ignore for a comment that is a substring match but not exact for "继续"', () => {
    const result = parseCommand(commentPayload("继续讨论"));
    assert.deepStrictEqual(result, { action: "ignore", issueId: "issue-1" });
  });

  it("returns ignore for an empty comment after trim", () => {
    const result = parseCommand(commentPayload("   "));
    assert.deepStrictEqual(result, { action: "ignore", issueId: "issue-1" });
  });

  // --- issueId always present ------------------------------------------------
  it("always returns an issueId field in the result", () => {
    const commentResult = parseCommand(commentPayload("继续", "custom-id"));
    assert.strictEqual(commentResult.issueId, "custom-id");

    const issueResult = parseCommand(issuePayload("create", "调研中", "abc-123"));
    assert.strictEqual(issueResult.issueId, "abc-123");

    const ignoreResult = parseCommand(commentPayload("无关内容", "ignored-id"));
    assert.strictEqual(ignoreResult.issueId, "ignored-id");
  });
});
