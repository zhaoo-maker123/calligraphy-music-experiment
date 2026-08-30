import assert from "node:assert/strict";
import test from "node:test";
import { TASKS } from "../site/assets/js/config.js";
import { createSession, ensureResponse, SessionStore } from "../site/assets/js/session-store.js";

class MemoryStorage {
  constructor() {
    this.values = new Map();
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, value);
  }

  removeItem(key) {
    this.values.delete(key);
  }
}

test("会话可以保存、恢复和清除", () => {
  const storage = new MemoryStorage();
  const store = new SessionStore(storage);
  const session = createSession(new Date("2026-08-31T00:00:00.000Z"));
  const response = ensureResponse(session, TASKS[0]);
  response.strokes.push({ strokeNumber: 1, states: ["开始", "加速"] });
  store.save(session, new Date("2026-08-31T00:01:00.000Z"));

  assert.deepEqual(store.load(), session);
  store.clear();
  assert.equal(store.load(), null);
});

test("重复读取同一题不会覆盖已记录数据", () => {
  const session = createSession();
  const response = ensureResponse(session, TASKS[0]);
  response.strokes.push({ strokeNumber: 1, states: ["结束"] });
  assert.equal(ensureResponse(session, TASKS[0]), response);
  assert.equal(response.strokes.length, 1);
});
