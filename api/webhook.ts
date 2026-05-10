/**
 * Linear Webhook endpoint (Vercel Function).
 *
 * Full flow:
 *   POST /api/webhook
 *     -> verifySignature (fail -> 401)
 *     -> parse JSON
 *     -> idempotent dedup
 *     -> filter Issue/Comment events
 *     -> parseCommand (ignore -> 200, no action)
 *     -> fetch issue context from Linear
 *     -> executeAgent
 *     -> writeResultToLinear
 *     -> 200
 *
 * GET - Health check.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { verifySignature } from "../lib/verify-signature";
import parseCommand from "../lib/command-router";
import { executeAgent } from "../lib/agent-executor";
import { writeResultToLinear } from "../lib/linear-writer";
import { LinearClient } from "@linear/sdk";

/* ------------------------------------------------------------------ */
/*  In-memory deduplication                                            */
/* ------------------------------------------------------------------ */

const processedEvents = new Map<string, number>();
const DEDUP_TTL_MS = 5 * 60 * 1000; // 5 minutes

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

/** Read the full request body as a UTF-8 string. */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

/**
 * Extract a stable event ID for idempotent deduplication.
 * Priority: Linear-Event header > webhookDeliveryId in body.
 */
function getEventId(
  req: IncomingMessage,
  payload: Record<string, unknown>,
): string | null {
  const headerValue = req.headers["linear-event"];
  if (headerValue) {
    return Array.isArray(headerValue) ? headerValue[0]! : headerValue;
  }

  const deliveryId = (payload as Record<string, unknown>).webhookDeliveryId;
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
/*  Issue context fetcher                                              */
/* ------------------------------------------------------------------ */

async function fetchIssueContext(
  linearClient: LinearClient,
  issueId: string,
): Promise<{ id: string; title: string; description: string; status: string }> {
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

  // ---- Only POST is accepted from here ----
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "Method not allowed" }));
    return;
  }

  const startTime = Date.now();
  let eventId: string | null = null;
  let action = "unknown";
  let issueId = "";

  try {
    // 1. Read raw body (needed for signature verification)
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

    // 3. Parse JSON payload
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(body) as Record<string, unknown>;
    } catch {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "Invalid JSON body" }));
      return;
    }

    // 4. Idempotent deduplication by event ID
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

    // 5. Filter: only process Issue / Comment create / update
    const eventType = payload.type;
    const eventAction = payload.action;

    if (
      !SUPPORTED_TYPES.has(eventType as string) ||
      !SUPPORTED_ACTIONS.has(eventAction as string)
    ) {
      console.log(
        `[webhook] Skipped event: type=${eventType}, action=${eventAction}`,
      );
      res.statusCode = 200;
      res.end(JSON.stringify({ status: "ok", skipped: true }));
      return;
    }

    // 6. Route to command router
    console.log(
      `[webhook] Processing event: type=${eventType}, action=${eventAction}, id=${eventId}`,
    );
    const commandResult = parseCommand(
      payload as unknown as Parameters<typeof parseCommand>[0],
    );
    action = commandResult.action;
    issueId = commandResult.issueId;

    console.log(
      `[webhook] Command result: action=${action}, issueId=${issueId}`,
    );

    // 7. Skip if action is "ignore" (ordinary comment, non-matching event)
    if (action === "ignore") {
      const duration = Date.now() - startTime;
      logStructured({ eventId, action, duration, success: true });
      res.statusCode = 200;
      res.end(JSON.stringify({ status: "ok", action: "ignore" }));
      return;
    }

    // 8. Fetch full issue context from Linear
    const linearApiKey = process.env.LINEAR_API_KEY;
    if (!linearApiKey) {
      throw new Error("LINEAR_API_KEY is not set");
    }
    const linearClient = new LinearClient({ apiKey: linearApiKey });
    const issueContext = await fetchIssueContext(linearClient, issueId);

    // 9. Execute agent
    const agentResult = await executeAgent(action, issueContext);

    // 10. Write result back to Linear
    await writeResultToLinear({
      action,
      issueId,
      result: agentResult,
    });

    // 11. Structured log + respond
    const duration = Date.now() - startTime;
    logStructured({ eventId, action, duration, success: agentResult.success });

    res.statusCode = 200;
    res.end(
      JSON.stringify({
        status: "ok",
        action,
        success: agentResult.success,
      }),
    );
  } catch (err) {
    // Global error handler: write Agent Error comment to Linear
    const duration = Date.now() - startTime;
    const errorMessage = err instanceof Error ? err.message : String(err);

    console.error(`[webhook] Unhandled error: ${errorMessage}`);

    // Attempt to write error comment to Linear if we have an issueId
    if (issueId) {
      try {
        await writeResultToLinear({
          action,
          issueId,
          result: { success: false, content: "", error: errorMessage },
        });
      } catch (writeErr) {
        console.error(
          `[webhook] Failed to write error comment: ${writeErr instanceof Error ? writeErr.message : String(writeErr)}`,
        );
      }
    }

    logStructured({ eventId, action, duration, success: false });

    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
}
