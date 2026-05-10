/**
 * Linear Webhook endpoint (Vercel Function).
 *
 * POST  - Verify signature, deduplicate, filter, and route events.
 * GET   - Health check.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { verifySignature } from "../lib/verify-signature";
import parseCommand from "../lib/command-router";

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
  payload: Record<string, unknown>
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
/*  Handler                                                            */
/* ------------------------------------------------------------------ */

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse
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

  try {
    // 1. Read raw body (needed for signature verification)
    const body = await readBody(req);

    // 2. Verify HMAC signature
    const rawSignature = req.headers["x-webhook-signature"];
    const signature: string | null = Array.isArray(rawSignature)
      ? rawSignature[0] ?? null
      : rawSignature ?? null;

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
    const eventId = getEventId(req, payload);
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
        `[webhook] Skipped event: type=${eventType}, action=${eventAction}`
      );
      res.statusCode = 200;
      res.end(JSON.stringify({ status: "ok", skipped: true }));
      return;
    }

    // 6. Route to command router
    console.log(
      `[webhook] Processing event: type=${eventType}, action=${eventAction}, id=${eventId}`
    );
    const result = parseCommand(payload as unknown as Parameters<typeof parseCommand>[0]);
    console.log(`[webhook] Command result: action=${result.action}, issueId=${result.issueId}`);

    res.statusCode = 200;
    res.end(JSON.stringify({ status: "ok" }));
  } catch (err) {
    console.error("[webhook] Unhandled error:", err);
    res.statusCode = 500;
    res.end(JSON.stringify({ error: "Internal server error" }));
  }
}
