import assert from "node:assert/strict";
import test from "node:test";
import { redactSensitiveValue } from "../../common/redaction.js";

test("redactSensitiveValue removes credentials and restricted raw payloads recursively", () => {
  assert.deepEqual(
    redactSensitiveValue({
      email: "operator@example.local",
      passwordHash: "hash",
      nested: { accessToken: "token", value: 2 },
      rawPayload: { secret: "source" },
      raw_payload: { source: "source" },
      stored_file_path: "/private/file"
    }),
    {
      email: "operator@example.local",
      passwordHash: "[REDACTED]",
      nested: { accessToken: "[REDACTED]", value: 2 },
      rawPayload: "[REDACTED]",
      raw_payload: "[REDACTED]",
      stored_file_path: "[REDACTED]"
    }
  );
});
