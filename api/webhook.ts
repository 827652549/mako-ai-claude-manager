/**
 * Linear Webhook endpoint (Vercel Function).
 *
 * Self-contained: all logic inlined (no external imports).
 * Validates → routes → writes PENDING marker to QUEUE issue.
 *
 * POST /api/webhook - receive Linear events
 * GET  /api/webhook - health check
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { createHmac } from "node:crypto";
import { LinearClient } from "@linear/sdk";

/* ================================================================== */
/*  HMAC Signature Verification                                        */
/* ================================================================== */

function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  try {
    const { timingSafeEqual: fn } = require("node:crypto");
    return fn(a, b);
  } catch {
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i]! ^ b[i]!;
    }
    return result === 0;
  }
}

function verifySignature(
  body: string,
  signature: string | null,
  secret: string,
): boolean {
  if (signature === null || signature === undefined) return false;
  if (body.length === 0) return false;
  if (secret.length === 0) return false;

  const expected = createHmac("sha256", secret).update(body).digest("hex");
  if (expected.length !== signature.length) return false;

  return timingSafeEqual(
    Buffer.from(expected, "utf8"),
    Buffer.from(signature, "utf8"),
  );
}

/* ================================================================== */
/*  Command Router                                                     */
/* ================================================================== */

interface CommentPayload {
  action: string;
  type: "Comment";
  data: { body: string; issue: { id: string } };
}

interface IssuePayload {
  action: string;
  type: "Issue";
  data: { id: string; state: { name: string } };
}

type WebhookPayload = CommentPayload | IssuePayload;
type Action = "research" | "advance" | "release" | "ignore";

interface CommandResult {
  action: Action;
  issueId: string;
}

function parseCommand(payload: WebhookPayload): CommandResult {
  if (payload.type === "Comment") {
    const issueId = payload.data.issue.id;
    const body = payload.data.body.trim();

    if (body === "继续") return { action: "advance", issueId };
    if (body.includes("发布") || body.toUpperCase().includes("APPROVE"))
      return { action: "release", issueId };

    return { action: "ignore", issueId };
  }

  if (payload.type === "Issue") {
    const issueId = payload.data.id;
    if (payload.action === "create" && payload.data.state.name === "调研中")
      return { action: "research", issueId };
    return { action: "ignore", issueId };
  }

  return { action: "ignore", issueId: "" };
}

/* ================================================================== */
/*  In-memory deduplication                                            */
/* ================================================================== */

const processedEvents = new Map<string, number>();
const DEDUP_TTL_MS = 5 * 60 * 1000;

function cleanupExpiredEvents(): void {
  const now = Date.now();
  for (const [id, ts] of processedEvents) {
    if (now - ts > DEDUP_TTL_MS) processedEvents.delete(id);
  }
}

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function getEventId(
  req: IncomingMessage,
  payload: Record<string, unknown>,
): string | null {
  const headerValue = req.headers["linear-event"];
  if (headerValue) return Array.isArray(headerValue) ? headerValue[0]! : headerValue;
  const deliveryId = payload.webhookDeliveryId;
  if (typeof deliveryId === "string" && deliveryId.length > 0) return deliveryId;
  return null;
}

/* ================================================================== */
/*  Queue Issue ID & PENDING marker                                    */
/* ================================================================== */

const QUEUE_ISSUE_ID = "MAK-300";

async function writePendingMarker(
  client: LinearClient,
  action: string,
  targetIssueId: string,
): Promise<void> {
  // Fetch target issue context to embed in the marker
  const issue = await client.issue(targetIssueId);
  const state = await issue.state;

  const context = {
    targetIssueId,
    targetIdentifier: issue.identifier,
    title: issue.title,
    description: issue.description ?? "",
    status: state?.name ?? "Unknown",
  };

  const body = [
    `🤖 **⏳ PENDING: ${action}**`,
    "",
    `Target: ${issue.identifier} — ${issue.title}`,
    "",
    "```json",
    JSON.stringify(context, null, 2),
    "```",
  ].join("\n");

  // Write to the QUEUE issue, not the target issue
  const queueIssue = await client.issue(QUEUE_ISSUE_ID);
  await client.createComment({ issueId: queueIssue.id, body });
}

/* ================================================================== */
/*  Structured logging                                                 */
/* ================================================================== */

function log(info: {
  eventId: string | null;
  action: string;
  duration: number;
  success: boolean;
}): void {
  console.log(
    `[webhook] event=${info.eventId ?? "unknown"} action=${info.action} duration=${info.duration}ms success=${info.success}`,
  );
}

/* ================================================================== */
/*  Constants                                                          */
/* ================================================================== */

const SUPPORTED_TYPES = new Set(["Issue", "Comment"]);
const SUPPORTED_ACTIONS = new Set(["create", "update"]);

/* ================================================================== */
/*  Handler                                                            */
/* ================================================================== */

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  res.setHeader("Content-Type", "application/json");

  if (req.method === "GET") {
    res.statusCode = 200;
    res.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const startTime = Date.now();
  let eventId: string | null = null;
  let action: Action = "ignore";

  try {
    const body = await readBody(req);

    // 1. Verify signature
    const rawSignature = req.headers["x-webhook-signature"];
    const signature: string | null = Array.isArray(rawSignature)
      ? (rawSignature[0] ?? null)
      : (rawSignature ?? null);

    const secret = process.env.LINEAR_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[webhook] LINEAR_WEBHOOK_SECRET is not configured");
      res.statusCode = 500;
      res.end(JSON.stringify({ error: "Server misconfiguration" }));
      return;
    }

    if (!verifySignature(body, signature, secret)) {
      res.statusCode = 401;
      res.end(JSON.stringify({ error: "Invalid signature" }));
      return;
    }

    // 2. Parse JSON
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body) as Record<string, unknown>;
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }

    // 3. Dedup
    eventId = getEventId(req, payload);
    if (eventId) {
      if (processedEvents.has(eventId)) {
        res.statusCode = 200;
        res.end(JSON.stringify({ status: "ok", duplicate: true }));
        return;
      }
      processedEvents.set(eventId, Date.now());
      cleanupExpiredEvents();
    }

    // 4. Filter events
    const eventType = payload.type;
    const eventAction = payload.action;
    if (
      !SUPPORTED_TYPES.has(eventType as string) ||
      !SUPPORTED_ACTIONS.has(eventAction as string)
    ) {
      res.statusCode = 200;
      res.end(JSON.stringify({ status: "ok", skipped: true }));
      return;
    }

    // 5. Route command
    const commandResult = parseCommand(
      payload as unknown as WebhookPayload,
    );
    action = commandResult.action;
    const targetIssueId = commandResult.issueId;

    console.log(`[webhook] Command: action=${action}, target=${targetIssueId}`);

    // 6. Skip ignores
    if (action === "ignore") {
      const duration = Date.now() - startTime;
      log({ eventId, action, duration, success: true });
      res.statusCode = 200;
      res.end(JSON.stringify({ status: "ok", action: "ignore" }));
      return;
    }

    // 7. Write PENDING marker to QUEUE issue
    const linearApiKey = process.env.LINEAR_API_KEY;
    if (!linearApiKey) throw new Error("LINEAR_API_KEY is not set");

    const linearClient = new LinearClient({ apiKey: linearApiKey });
    await writePendingMarker(linearClient, action, targetIssueId);

    // 8. Respond
    const duration = Date.now() - startTime;
    log({ eventId, action, duration, success: true });
    res.statusCode = 200;
    res.end(JSON.stringify({ status: "ok", action, queued: true }));
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[webhook] Error: ${errorMessage}`);
    log({ eventId, action, duration, success: false });
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
}
