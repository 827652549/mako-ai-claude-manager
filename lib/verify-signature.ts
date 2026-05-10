import { createHmac } from "node:crypto";

/**
 * Verify Linear webhook HMAC-SHA256 signature.
 *
 * @param body - Raw request body string
 * @param signature - Value of X-Webhook-Signature header (hex-encoded HMAC-SHA256), or null if absent
 * @param secret - Webhook secret configured in Linear
 * @returns true if the signature is valid, false otherwise
 */
export function verifySignature(
  body: string,
  signature: string | null,
  secret: string
): boolean {
  // Missing signature header
  if (signature === null || signature === undefined) {
    return false;
  }

  // Empty body
  if (body.length === 0) {
    return false;
  }

  // Empty secret should not produce a valid signature
  if (secret.length === 0) {
    return false;
  }

  const expected = createHmac("sha256", secret).update(body).digest("hex");

  // Timing-safe comparison to prevent timing attacks
  if (expected.length !== signature.length) {
    return false;
  }

  const expectedBuffer = Buffer.from(expected, "utf8");
  const signatureBuffer = Buffer.from(signature, "utf8");

  return timingSafeEqual(expectedBuffer, signatureBuffer);
}

/**
 * Timing-safe buffer comparison (polyfill for environments
 * where crypto.timingSafeEqual may not exist).
 */
function timingSafeEqual(a: Buffer, b: Buffer): boolean {
  try {
    const { timingSafeEqual: nodeTimingSafeEqual } = require("node:crypto");
    return nodeTimingSafeEqual(a, b);
  } catch {
    // Fallback: constant-time comparison
    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a[i]! ^ b[i]!;
    }
    return result === 0;
  }
}
