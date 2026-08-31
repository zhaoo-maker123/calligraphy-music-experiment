import assert from "node:assert/strict";
import test from "node:test";
import { buildCsv } from "../site/assets/js/csv-exporter.js";
import { TASKS } from "../site/assets/js/config.js";
import { createSession, ensureResponse } from "../site/assets/js/session-store.js";

test("CSV 包含会话、笔画与选择结果，但不包含轨迹坐标", () => {
  const session = createSession(new Date("2026-08-31T00:00:00.000Z"));
  session.status = "incomplete";
  session.endedAt = "2026-08-31T00:05:00.000Z";

  const trace = ensureResponse(session, TASKS[0]);
  trace.status = "completed";
  trace.strokes.push(
    { strokeNumber: 1, states: ["开始", "加速"] },
    { strokeNumber: 2, states: ["减速", "结束"] },
  );

  const choice = ensureResponse(session, TASKS[7]);
  choice.status = "completed";
  choice.selectedOption = "B";
  choice.selectedValue = "许.mp3";

  const csv = buildCsv(session, TASKS, new Date("2026-08-31T00:06:00.000Z"));
  const lines = csv.split("\r\n");
  assert.equal(lines.length, 5);
  assert.match(csv, /"stroke"/);
  assert.match(csv, /"开始\|加速"/);
  assert.match(csv, /"choice"/);
  assert.match(csv, /"许\.mp3"/);
  assert.doesNotMatch(lines[0], /coordinate|trace_points|point_x|point_y/);
});
