import test from "node:test";
import assert from "node:assert/strict";

import { withTimeout } from "../site/assets/js/async-utils.js";

test("withTimeout returns a completed operation", async () => {
  assert.equal(await withTimeout(Promise.resolve("saved"), 50, "timed out"), "saved");
});

test("withTimeout rejects an operation that never settles", async () => {
  await assert.rejects(
    withTimeout(new Promise(() => {}), 10, "saving timed out"),
    /saving timed out/,
  );
});
