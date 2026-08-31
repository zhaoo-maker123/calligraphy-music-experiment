const DATABASE_NAME = "calligraphy-experiment-strokes";
const DATABASE_VERSION = 1;
const STORE_NAME = "stroke-images";
const SESSION_INDEX = "session-id";

export function createStrokeImageId(sessionId, taskId, strokeNumber) {
  return `${sessionId}:${taskId}:${String(strokeNumber).padStart(3, "0")}`;
}

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

export class StrokeImageStore {
  constructor(indexedDb = globalThis.indexedDB) {
    if (!indexedDb) throw new Error("IndexedDB is unavailable.");
    this.indexedDb = indexedDb;
    this.databasePromise = null;
  }

  open() {
    if (this.databasePromise) return this.databasePromise;
    this.databasePromise = new Promise((resolve, reject) => {
      const request = this.indexedDb.open(DATABASE_NAME, DATABASE_VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        const store = database.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex(SESSION_INDEX, "sessionId", { unique: false });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    return this.databasePromise;
  }

  async save({ sessionId, task, strokeNumber, blob }) {
    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const completion = transactionComplete(transaction);
    transaction.objectStore(STORE_NAME).put({
      id: createStrokeImageId(sessionId, task.id, strokeNumber),
      sessionId,
      taskId: task.id,
      sectionOrder: task.sectionOrder,
      questionOrder: task.questionOrder,
      strokeNumber,
      blob,
    });
    await completion;
  }

  async getSessionImages(sessionId) {
    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, "readonly");
    const completion = transactionComplete(transaction);
    const request = transaction.objectStore(STORE_NAME).index(SESSION_INDEX).getAll(sessionId);
    const records = await requestResult(request);
    await completion;
    return records.sort((left, right) => (
      left.sectionOrder - right.sectionOrder
      || left.questionOrder - right.questionOrder
      || left.strokeNumber - right.strokeNumber
    ));
  }

  async deleteSession(sessionId) {
    if (!sessionId) return;
    const database = await this.open();
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const index = transaction.objectStore(STORE_NAME).index(SESSION_INDEX);
    const cursorRequest = index.openKeyCursor(sessionId);
    cursorRequest.onsuccess = () => {
      const cursor = cursorRequest.result;
      if (!cursor) return;
      transaction.objectStore(STORE_NAME).delete(cursor.primaryKey);
      cursor.continue();
    };
    await transactionComplete(transaction);
  }
}
