import assert from "node:assert/strict";
import test from "node:test";
import { TASKS } from "../site/assets/js/config.js";
import { createSession, ensureResponse } from "../site/assets/js/session-store.js";
import { createStrokeImageId } from "../site/assets/js/stroke-image-store.js";
import {
  createExperimentZip,
  createStrokeArchivePath,
  createZipFilename,
} from "../site/assets/js/zip-exporter.js";

async function readStoredEntries(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const decoder = new TextDecoder();
  const entries = new Map();
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const extraLength = view.getUint16(offset + 28, true);
    const nameStart = offset + 30;
    const dataStart = nameStart + nameLength + extraLength;
    const name = decoder.decode(bytes.slice(nameStart, nameStart + nameLength));
    entries.set(name, bytes.slice(dataStart, dataStart + size));
    offset = dataStart + size;
  }
  return entries;
}

test("ZIP 包含 CSV 和按题号、笔画号排序的 PNG", async () => {
  const session = createSession(new Date("2026-08-31T00:00:00.000Z"));
  session.status = "completed";
  session.endedAt = "2026-08-31T00:05:00.000Z";
  const task = TASKS[0];
  const response = ensureResponse(session, task);
  response.status = "completed";
  response.strokes.push({ strokeNumber: 1, states: ["开始", "加速"] });

  const pngBytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const image = {
    id: createStrokeImageId(session.sessionId, task.id, 1),
    sessionId: session.sessionId,
    taskId: task.id,
    sectionOrder: task.sectionOrder,
    questionOrder: task.questionOrder,
    strokeNumber: 1,
    blob: new Blob([pngBytes], { type: "image/png" }),
  };
  const archive = await createExperimentZip(
    session,
    TASKS,
    [image],
    new Date("2026-08-31T00:06:00.000Z"),
  );
  const entries = await readStoredEntries(archive.blob);

  assert.deepEqual([...entries.keys()], [
    "responses.csv",
    "strokes/section-01/question-01/stroke-001.png",
  ]);
  assert.match(new TextDecoder().decode(entries.get("responses.csv")), /"开始\|加速"/);
  assert.deepEqual(entries.get("strokes/section-01/question-01/stroke-001.png"), pngBytes);
  assert.equal(archive.filename, `calligraphy_20260831T000600Z_${session.sessionId.split("-")[0]}_completed.zip`);
});

test("缺少任何已确认笔画图片时拒绝生成 ZIP", async () => {
  const session = createSession();
  const response = ensureResponse(session, TASKS[0]);
  response.strokes.push({ strokeNumber: 1, states: ["开始"] });
  await assert.rejects(() => createExperimentZip(session, TASKS, []), /Missing stroke image/);
});

test("笔画图片路径使用固定补零顺序", () => {
  assert.equal(
    createStrokeArchivePath({ sectionOrder: 3, questionOrder: 6, strokeNumber: 12 }),
    "strokes/section-03/question-06/stroke-012.png",
  );
  const session = { sessionId: "abc-def", status: "incomplete" };
  assert.equal(
    createZipFilename(session, new Date("2026-08-31T12:34:56.000Z")),
    "calligraphy_20260831T123456Z_abc_incomplete.zip",
  );
});
