import assert from "node:assert/strict";
import test from "node:test";
import { createTeacherSessionToken, verifyTeacherSessionToken } from "./session-token";

test("teacher session accepts its signer and rejects a different secret", async () => {
  const token = await createTeacherSessionToken("a-long-session-secret-used-for-testing");
  assert.equal(await verifyTeacherSessionToken(token, "a-long-session-secret-used-for-testing"), true);
  assert.equal(await verifyTeacherSessionToken(token, "the-wrong-secret"), false);
});

test("teacher session rejects malformed values", async () => {
  assert.equal(await verifyTeacherSessionToken(undefined, "secret"), false);
  assert.equal(await verifyTeacherSessionToken("not-a-token", "secret"), false);
  assert.equal(await verifyTeacherSessionToken("a.b.extra", "secret"), false);
});
