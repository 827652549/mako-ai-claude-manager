/**
 * Linear Webhook endpoint (Vercel Function).
 *
 * Thin relay: validates → routes → writes PENDING marker to Linear.
 * Agent execution is handled by the local daemon (daemon.ts).
 *
 * POST /api/webhook - receive Linear events
 * GET  /api/webhook - health check
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { verifySignature } from "../lib/verify-signature";
import parseCommand from "../lib/command-router";
import { LinearClient } from "@linear/sdk";

/* ------------------------------------------------------------------ */
/*  In-memory deduplication                                            */
/* ------------------------------------------------------------------ */

const processedEvents = new Map<string, number>();
const DEDUP_TTL_MS = 5 * 60 * 1000;

function cleanupExpiredEvents(): void {
  const now = Date.now();
  for (const [id, ts] of processedEvents) {
    if (now - ts > DEDUP_TTL_MS) {
      processedEvents.delete(id);
    }
  }
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

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
  if (headerValue) {
    return Array.isArray(headerValue) ? headerValue[0]! : headerValue;
  }
  const deliveryId = payload.webhookDeliveryId;
  if (typeof deliveryId === "string" && deliveryId.length > 0) {
    return deliveryId;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const SUPPORTED_TYPES = new Set(["Issue", "Comment"]);
const SUPPORTED_ACTIONS = new Set(["create", "update"]);

/* ------------------------------------------------------------------ */
/*  PENDING marker                                                     */
/* ------------------------------------------------------------------ */

interface IssueContext {
  id: string;
  title: string;
  description: string;
  status: string;
}

async function writePendingMarker(
  linearClient: LinearClient,
  action: string,
  issueId: string,
  context: IssueContext,
): Promise<void> {
  const contextJson = JSON.stringify(context, null, 2);
  const body = [
    `🤖 **⏳ PENDING: ${action}**`,
    "",
    "Agent 即将执行此操作。结果将自动写回。",
    "",
    "```json",
    contextJson,
    "```",
  ].join("\n");

  await linearClient.createComment({
    issueId,
    body,
  });
}

/* ------------------------------------------------------------------ */
/*  Issue context fetcher                                              */
/* ------------------------------------------------------------------ */

async function fetchIssueContext(
  linearClient: LinearClient,
  issueId: string,
): Promise<IssueContext> {
  const issue = await linearClient.issue(issueId);
  const state = await issue.state;
  return {
    id: issueId,
    title: issue.title,
    description: issue.description ?? "",
    status: state?.name ?? "Unknown",
  };
}

/* ------------------------------------------------------------------ */
/*  Structured log helper                                              */
/* ------------------------------------------------------------------ */

interface StructuredLog {
  eventId: string | null;
  action: string;
  duration: number;
  success: boolean;
}

function logStructured(info: StructuredLog): void {
  console.log(
    `[webhook] event=${info.eventId ?? "unknown"} action=${info.action} duration=${info.duration}ms success=${info.success}`,
  );
}

/* ------------------------------------------------------------------ */
/*  Handler                                                            */
/* ------------------------------------------------------------------ */

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  res.setHeader("Content-Type", "application/json");

  // ---- GET: health check ----
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
  let action = "unknown";

  try {
    // 1. Read raw body
    const body = await readBody(req);

    // 2. Verify HMAC signature
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

    // 3. Parse JSON
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body) as Record<string, unknown>;
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }

    // 4. Dedup
    eventId = getEventId(req, payload);
    if (eventId) {
      if (processedEvents.has(eventId)) {
        console.log(`[webhook] Duplicate event ignored: ${eventId}`);
        res.statusCode = 200;
        res.end(JSON.stringify({ status: "ok", duplicate: true }));
        return;
      }
      processedEvents.set(eventId, Date.now());
      cleanupExpiredEvents();
    }

    // 5. Filter: only Issue / Comment create / update
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

    // 6. Route command
    const commandResult = parseCommand(
      payload as unknown as Parameters<typeof parseCommand>[0],
    );
    action = commandResult.action;
    const issueId = commandResult.issueId;

    console.log(`[webhook] Command: action=${action}, issue=${issueId}`);

    // 7. Skip if action is "ignore"
    if (action === "ignore") {
      const duration = Date.now() - startTime;
      logStructured({ eventId, action, duration, success: true });
      res.statusCode = 200;
      res.end(JSON.stringify({ status: "ok", action: "ignore" }));
      return;
    }

    // 8. Fetch issue context & write PENDING marker
    const linearApiKey = process.env.LINEAR_API_KEY;
    if (!linearApiKey) {
      throw new Error("LINEAR_API_KEY is not set");
    }
    const linearClient = new LinearClient({ apiKey: linearApiKey });
    const issueContext = await fetchIssueContext(linearClient, issueId);

    await writePendingMarker(linearClient, action, issueId, issueContext);

    // 9. Respond
    const duration = Date.now() - startTime;
    logStructured({ eventId, action, duration, success: true });

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        status: "ok",
        action,
        queued: true,
      }),
    );
  } catch (err) {
    const duration = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[webhook] Error: ${errorMessage}`);
    logStructured({ eventId, action, duration, success: false });

    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
}
