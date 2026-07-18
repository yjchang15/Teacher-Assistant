import { test } from "node:test";
import assert from "node:assert/strict";
import { thousands, truncate } from "./format";

test("thousands groups digits and rounds", () => {
  assert.equal(thousands(1234567), "1,234,567");
  assert.equal(thousands(1000), "1,000");
  assert.equal(thousands(12.6), "13");
  assert.equal(thousands(0), "0");
});

test("truncate adds an ellipsis only when over the limit", () => {
  assert.equal(truncate("hello", 10), "hello");
  assert.equal(truncate("hello world", 5), "hell…");
  assert.equal(truncate("abc", 3), "abc");
});
