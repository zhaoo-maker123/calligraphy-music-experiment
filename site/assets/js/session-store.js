import { EXPERIMENT_CONFIG } from "./config.js";

function createSessionId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createSession(now = new Date()) {
  const timestamp = now.toISOString();
  return {
    schemaVersion: EXPERIMENT_CONFIG.schemaVersion,
    sessionId: createSessionId(),
    status: "active",
    startedAt: timestamp,
    updatedAt: timestamp,
    endedAt: null,
    currentTaskIndex: 0,
    responses: {},
  };
}

export function ensureResponse(session, task) {
  if (!session.responses[task.id]) {
    session.responses[task.id] = {
      taskId: task.id,
      kind: task.kind,
      sectionId: task.sectionId,
      questionOrder: task.questionOrder,
      status: "in_progress",
      strokes: [],
      selectedOption: null,
      selectedValue: null,
      audioCompleted: false,
      heardOptions: [],
    };
  }
  return session.responses[task.id];
}

export class SessionStore {
  constructor(storage = globalThis.localStorage) {
    this.storage = storage;
  }

  load() {
    try {
      const raw = this.storage.getItem(EXPERIMENT_CONFIG.storageKey);
      if (!raw) return null;
      const session = JSON.parse(raw);
      if (session.schemaVersion !== EXPERIMENT_CONFIG.schemaVersion) return null;
      return session;
    } catch {
      return null;
    }
  }

  save(session, now = new Date()) {
    session.updatedAt = now.toISOString();
    this.storage.setItem(EXPERIMENT_CONFIG.storageKey, JSON.stringify(session));
    return session;
  }

  clear() {
    this.storage.removeItem(EXPERIMENT_CONFIG.storageKey);
  }
}
