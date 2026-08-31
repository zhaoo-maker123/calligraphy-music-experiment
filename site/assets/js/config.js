export const EXPERIMENT_CONFIG = Object.freeze({
  schemaVersion: 2,
  storageKey: "calligraphy-match-experiment-v2",
  maxStates: 3,
  minimumTracePoints: 4,
  previewWidth: 116,
  previewHeight: 128,
  strokeImageLongEdge: 1000,
  stateLabels: Object.freeze(["加速", "减速", "间歇换气", "结束", "开始"]),
  stateGroups: Object.freeze([
    Object.freeze(["加速", "减速"]),
    Object.freeze(["间歇换气", "结束"]),
  ]),
});

export const SECTIONS = Object.freeze([
  Object.freeze({
    id: "trace",
    order: 1,
    title: "书法笔画描摹",
    shortTitle: "描摹标记",
    description: "逐笔描摹书法，并为每一笔选择至少一个运动状态。",
  }),
  Object.freeze({
    id: "match",
    order: 2,
    title: "书法与音乐匹配",
    shortTitle: "匹配选择",
    description: "完整试听音频后，从三个候选项中选择最匹配的一项。",
  }),
  Object.freeze({
    id: "audio-trace",
    order: 3,
    title: "伴随音乐描摹",
    shortTitle: "音乐描摹",
    description: "播放对应音乐，并在聆听过程中逐笔描摹书法。",
  }),
]);

const traceTasks = Array.from({ length: 6 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  return Object.freeze({
    id: `trace-${number}`,
    sectionId: "trace",
    sectionOrder: 1,
    questionOrder: index + 1,
    kind: "trace",
    image: `assets/media/type1/${number}.png`,
    itemValue: `图片${index + 1}.png`,
  });
});

const matchTasks = [
  {
    id: "match-01",
    sectionId: "match",
    sectionOrder: 2,
    questionOrder: 1,
    kind: "image-choice",
    audio: "assets/media/type2/q01/question.mp3",
    audioValue: "音频.mp3",
    options: [
      { id: "A", src: "assets/media/type2/q01/a.png", value: "图片1.png" },
      { id: "B", src: "assets/media/type2/q01/b.png", value: "图片2.png" },
      { id: "C", src: "assets/media/type2/q01/c.png", value: "图片3.png" },
    ],
  },
  {
    id: "match-02",
    sectionId: "match",
    sectionOrder: 2,
    questionOrder: 2,
    kind: "audio-choice",
    image: "assets/media/type2/q02/question.png",
    itemValue: "图片6.png",
    options: [
      { id: "A", src: "assets/media/type2/q02/a.mp3", value: "广.mp3" },
      { id: "B", src: "assets/media/type2/q02/b.mp3", value: "许.mp3" },
      { id: "C", src: "assets/media/type2/q02/c.mp3", value: "鱼.mp3" },
    ],
  },
  {
    id: "match-03",
    sectionId: "match",
    sectionOrder: 2,
    questionOrder: 3,
    kind: "audio-choice",
    image: "assets/media/type2/q03/question.png",
    itemValue: "图片8.png",
    options: [
      { id: "A", src: "assets/media/type2/q03/a.mp3", value: "禅.mp3" },
      { id: "B", src: "assets/media/type2/q03/b.mp3", value: "开.mp3" },
      { id: "C", src: "assets/media/type2/q03/c.mp3", value: "暇.mp3" },
    ],
  },
  {
    id: "match-04",
    sectionId: "match",
    sectionOrder: 2,
    questionOrder: 4,
    kind: "image-choice",
    audio: "assets/media/type2/q04/question.mp3",
    audioValue: "法.mp3",
    options: [
      { id: "A", src: "assets/media/type2/q04/a.png", value: "图片10.png" },
      { id: "B", src: "assets/media/type2/q04/b.png", value: "图片11.png" },
      { id: "C", src: "assets/media/type2/q04/c.png", value: "图片12.png" },
    ],
  },
  {
    id: "match-05",
    sectionId: "match",
    sectionOrder: 2,
    questionOrder: 5,
    kind: "image-choice",
    audio: "assets/media/type2/q05/question.mp3",
    audioValue: "奔蛇.mp3",
    options: [
      {
        id: "A",
        src: "assets/media/type2/q05/a.png",
        value: "奔蛇走虺势入座.png",
        captionKey: "match.q05.a",
      },
      {
        id: "B",
        src: "assets/media/type2/q05/b.png",
        value: "志在新奇无定则.png",
        captionKey: "match.q05.b",
      },
      {
        id: "C",
        src: "assets/media/type2/q05/c.png",
        value: "古瘦漓骊半无墨.png",
        captionKey: "match.q05.c",
      },
    ],
  },
  {
    id: "match-06",
    sectionId: "match",
    sectionOrder: 2,
    questionOrder: 6,
    kind: "audio-choice",
    image: "assets/media/type2/q06/question.png",
    itemValue: "图片14.png",
    options: [
      { id: "A", src: "assets/media/type2/q06/a.mp3", value: "孤云寄太虚.mp3" },
      { id: "B", src: "assets/media/type2/q06/b.mp3", value: "远锡无前侣.mp3" },
      { id: "C", src: "assets/media/type2/q06/c.mp3", value: "醉里得真知.mp3" },
    ],
  },
].map(Object.freeze);

const audioTraceTasks = Array.from({ length: 6 }, (_, index) => {
  const number = String(index + 1).padStart(2, "0");
  return Object.freeze({
    id: `audio-trace-${number}`,
    sectionId: "audio-trace",
    sectionOrder: 3,
    questionOrder: index + 1,
    kind: "audio-trace",
    image: `assets/media/type3/${number}.png`,
    audio: `assets/media/type3/${number}.mp3`,
    itemValue: `图片${index + 1}.png`,
    audioValue: `音频${index + 1}.mp3`,
  });
});

export const TASKS = Object.freeze([
  ...traceTasks,
  ...matchTasks,
  ...audioTraceTasks,
]);

export function getSection(sectionId) {
  return SECTIONS.find((section) => section.id === sectionId);
}

export function applyStateSelection(currentStates, state) {
  if (currentStates.includes(state)) {
    return currentStates.filter((item) => item !== state);
  }
  const exclusiveGroup = EXPERIMENT_CONFIG.stateGroups.find((group) => (
    group.includes(state)
  ));
  const retainedStates = exclusiveGroup
    ? currentStates.filter((item) => !exclusiveGroup.includes(item))
    : [...currentStates];

  if (!retainedStates.includes(state)) retainedStates.push(state);
  return retainedStates.slice(-EXPERIMENT_CONFIG.maxStates);
}

export function formatStrokeNumber(number, language = "zh") {
  if (language === "en") return String(number);
  const labels = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
  return labels[number] || String(number);
}
