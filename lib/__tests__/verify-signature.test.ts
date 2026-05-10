import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { verifySignature } from "../verify-signature.js";

const WEBHOOK_SECRET = "test-webhook-secret-12345";

function sign(body: string): string {
  return createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
}

describe("verifySignature", () => {
  it("returns true for a valid signature", () => {
    const body = JSON.stringify({ type: "Issue", action: "update" });
    const signature = sign(body);
    assert.strictEqual(verifySignature(body, signature, WEBHOOK_SECRET), true);
  });

  it("returns false for an invalid signature", () => {
    const body = JSON.stringify({ type: "Issue", action: "update" });
    assert.strictEqual(
      verifySignature(body, "deadbeef1234", WEBHOOK_SECRET),
      false
    );
  });

  it("returns false when signature header is missing (null)", () => {
    const body = JSON.stringify({ type: "Issue", action: "update" });
    assert.strictEqual(verifySignature(body, null, WEBHOOK_SECRET), false);
  });

  it("returns false when body is empty", () => {
    const signature = sign("");
    assert.strictEqual(verifySignature("", signature, WEBHOOK_SECRET), false);
  });

  it("returns false when secret is empty", () => {
    const body = JSON.stringify({ type: "Issue", action: "update" });
    const signature = sign(body);
    assert.strictEqual(verifySignature(body, signature, ""), false);
  });
});
