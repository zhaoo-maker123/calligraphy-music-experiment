import test from "node:test";
import assert from "node:assert/strict";

import { t } from "../site/assets/js/i18n.js";
import { TraceTask } from "../site/assets/js/trace-task.js";

function createController(savingStroke) {
  const controller = Object.create(TraceTask.prototype);
  controller.tracer = { points: [{}, {}] };
  controller.states = ["开始"];
  controller.savingStroke = savingStroke;
  controller.elements = {
    confirmButton: { disabled: false, textContent: "" },
    stateCount: { textContent: "" },
    timeline: { textContent: "" },
    stateButtons: [],
    redoButton: { disabled: false },
  };
  controller.updateDrawPrompt = () => {};
  return controller;
}

test("确认按钮在笔画保存完成后恢复正常文案", () => {
  const controller = createController(true);
  controller.updateTraceUi();
  assert.equal(controller.elements.confirmButton.textContent, t("trace.savingStroke"));

  controller.savingStroke = false;
  controller.updateTraceUi();
  assert.equal(controller.elements.confirmButton.textContent, t("trace.confirm"));
});
