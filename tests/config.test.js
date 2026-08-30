import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { applyStateSelection, TASKS } from "../site/assets/js/config.js";

test("题型与题目保持固定的 3 x 6 顺序", () => {
  assert.equal(TASKS.length, 18);
  assert.deepEqual(
    TASKS.map((task) => task.sectionId),
    [
      ...Array(6).fill("trace"),
      ...Array(6).fill("match"),
      ...Array(6).fill("audio-trace"),
    ],
  );
  for (let offset = 0; offset < TASKS.length; offset += 6) {
    assert.deepEqual(
      TASKS.slice(offset, offset + 6).map((task) => task.questionOrder),
      [1, 2, 3, 4, 5, 6],
    );
  }
});

test("全部题库图片和音频资源均存在", () => {
  const siteRoot = join(process.cwd(), "site");
  const missing = [];
  TASKS.forEach((task) => {
    const resources = [task.image, task.audio, ...(task.options || []).map((option) => option.src)];
    resources.filter(Boolean).forEach((resource) => {
      if (!existsSync(join(siteRoot, resource))) missing.push(resource);
    });
  });
  assert.deepEqual(missing, []);
});

test("第一部分和第三部分的六张书法图片逐一相同", () => {
  for (let index = 0; index < 6; index += 1) {
    const first = readFileSync(join(process.cwd(), "site", TASKS[index].image));
    const third = readFileSync(join(process.cwd(), "site", TASKS[index + 12].image));
    assert.deepEqual(first, third);
  }
});

test("笔画状态最多三项，并保持原有互斥规则", () => {
  let states = [];
  states = applyStateSelection(states, "开始");
  states = applyStateSelection(states, "加速");
  states = applyStateSelection(states, "减速");
  assert.deepEqual(states, ["开始", "减速"]);

  states = applyStateSelection(states, "间歇换气");
  states = applyStateSelection(states, "结束");
  assert.deepEqual(states, ["开始", "减速", "结束"]);
});
