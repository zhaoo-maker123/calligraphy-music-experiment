import assert from "node:assert/strict";
import test from "node:test";
import { formatStrokeNumber, TASKS } from "../site/assets/js/config.js";
import { getLanguage, setLanguage, t, translateState } from "../site/assets/js/i18n.js";

test("界面可以在中文和英文之间切换", () => {
  setLanguage("zh");
  assert.equal(getLanguage(), "zh");
  assert.equal(t("welcome.start"), "开始新的实验");
  assert.equal(formatStrokeNumber(3, getLanguage()), "三");

  setLanguage("en");
  assert.equal(getLanguage(), "en");
  assert.equal(t("welcome.start"), "Start a new experiment");
  assert.equal(formatStrokeNumber(3, getLanguage()), "3");
  assert.equal(translateState("加速"), "Accelerating");
  assert.equal(
    t("match.q05.a"),
    "Racing snakes and darting vipers surge into the hall",
  );
});

test("带题号的动态文案可以正确替换变量", () => {
  setLanguage("en");
  assert.equal(
    t("progress.summary", { overall: 7, total: 18, current: 1, sectionTotal: 6 }),
    "Overall 7 / 18 · Section 1 / 6",
  );
});

test("切换界面语言不会改变题目固定配置和素材值", () => {
  const before = JSON.stringify(TASKS);
  setLanguage("zh");
  setLanguage("en");
  assert.equal(JSON.stringify(TASKS), before);
});
