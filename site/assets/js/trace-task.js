import { AudioController } from "./audio-controller.js";
import { CanvasTracer } from "./canvas-tracer.js";
import {
  applyStateSelection,
  EXPERIMENT_CONFIG,
  formatStrokeNumber,
  UI_TEXT,
} from "./config.js";

export class TraceTask {
  constructor({ root, task, response, onStroke, onAudioCompleted, onComplete }) {
    this.root = root;
    this.task = task;
    this.response = response;
    this.onStroke = onStroke;
    this.onAudioCompleted = onAudioCompleted;
    this.onComplete = onComplete;
    this.states = [];
    this.tracing = false;
    this.taskStarted = task.kind === "trace"
      || response.audioCompleted
      || response.strokes.length > 0;
    this.awaitingNextAction = response.strokes.length > 0;
    this.previewByStroke = new Map();

    this.render();
    this.cacheElements();

    this.audio = task.kind === "audio-trace"
      ? new AudioController((playback) => this.handlePlaybackChange(playback))
      : null;
    this.tracer = new CanvasTracer({
      canvas: this.elements.canvas,
      image: this.elements.referenceImage,
      onTraceChange: () => this.updateTraceUi(),
    });

    this.bindEvents();
    this.renderHistory();
    this.updateAll();
  }

  render() {
    const audioPanel = this.task.kind === "audio-trace"
      ? `
        <div class="audio-strip">
          <div>
            <strong>本题对应音频</strong>
            <span id="audioStatus">${this.response.audioCompleted ? "已完整播放" : "等待播放"}</span>
          </div>
          <button class="btn outline compact" id="replayBtn" ${this.response.audioCompleted ? "" : "disabled"}>重新播放</button>
        </div>
      `
      : "";

    const stateButtons = EXPERIMENT_CONFIG.stateLabels.map((state) => {
      const className = state === "加速"
        ? "success"
        : state === "减速"
          ? "danger"
          : state === "间歇换气"
            ? "primary"
            : state === "结束"
              ? "dark"
              : "";
      const suffix = state === "加速" ? " ▶" : state === "减速" ? " ◀" : "";
      return `<button class="btn ${className} state-btn" data-state="${state}">${state}${suffix}</button>`;
    }).join("");

    this.root.innerHTML = `
      ${audioPanel}
      <div class="layout trace-layout">
        <section class="drawing-card" id="drawingCard">
          <div class="canvas-wrap">
            <img id="referenceImage" src="${this.task.image}" alt="当前书法描摹图片">
            <canvas id="traceCanvas" aria-label="书法笔画描摹画布"></canvas>
          </div>
          <div class="state" id="drawState">${UI_TEXT.idlePrompt}</div>
        </section>

        <section class="panel task-panel">
          <div class="panel-heading">
            <div>
              <h2>逐笔描摹并标记运动状态</h2>
              <p class="sub">当前笔画：第 <b id="strokeNo">${formatStrokeNumber(this.response.strokes.length + 1)}</b> 笔 · 已选择 <span id="stateCount">0</span> 个状态</p>
            </div>
            <span class="badge" id="strokeStatus">${this.awaitingNextAction ? "上一笔已完成" : UI_TEXT.waitingStatus}</span>
          </div>

          <button class="btn primary" id="startStrokeBtn">${this.task.kind === "audio-trace" && !this.taskStarted ? "开始本题并播放音频" : "开始描摹本笔"}</button>

          <div class="history" id="strokeHistory"></div>

          <div class="controls">
            <p class="question">描摹当前笔画后，请选择至少一项、最多三项运动状态，再确认本笔。</p>
            <div class="buttons">${stateButtons}</div>
            <div class="selection-line">当前状态：<span id="timeline">${UI_TEXT.emptyTimeline}</span></div>
            <div class="actions">
              <button class="btn primary" id="confirmStrokeBtn" disabled>确认，标记完成</button>
              <button class="btn primary" id="redoStrokeBtn">否，重来一次</button>
            </div>
          </div>

          <div class="post-stroke-actions ${this.awaitingNextAction ? "" : "hidden"}" id="postStrokeActions">
            <button class="btn outline" id="nextStrokeBtn">描摹下一笔 →</button>
            <button class="btn primary" id="finishCharacterBtn">本字描摹完成，进入下一题</button>
          </div>
          <p class="validation-message" id="traceValidation" aria-live="polite"></p>
          <div class="note">提示：每一笔必须选择至少一个状态。系统只保存笔画序号和状态标签，不保存描摹轨迹。</div>
        </section>
      </div>
    `;
  }

  cacheElements() {
    const find = (selector) => this.root.querySelector(selector);
    this.elements = {
      drawingCard: find("#drawingCard"),
      referenceImage: find("#referenceImage"),
      canvas: find("#traceCanvas"),
      drawState: find("#drawState"),
      strokeNo: find("#strokeNo"),
      stateCount: find("#stateCount"),
      timeline: find("#timeline"),
      strokeStatus: find("#strokeStatus"),
      startButton: find("#startStrokeBtn"),
      confirmButton: find("#confirmStrokeBtn"),
      redoButton: find("#redoStrokeBtn"),
      nextStrokeButton: find("#nextStrokeBtn"),
      finishButton: find("#finishCharacterBtn"),
      postActions: find("#postStrokeActions"),
      validation: find("#traceValidation"),
      history: find("#strokeHistory"),
      stateButtons: [...this.root.querySelectorAll(".state-btn")],
      replayButton: find("#replayBtn"),
      audioStatus: find("#audioStatus"),
    };
  }

  bindEvents() {
    this.elements.startButton.addEventListener("click", () => this.startStroke());
    this.elements.confirmButton.addEventListener("click", () => this.confirmStroke());
    this.elements.redoButton.addEventListener("click", () => this.redoStroke());
    this.elements.nextStrokeButton.addEventListener("click", () => this.prepareNextStroke());
    this.elements.finishButton.addEventListener("click", () => this.finishCharacter());
    this.elements.stateButtons.forEach((button) => {
      button.addEventListener("click", () => this.selectState(button.dataset.state));
    });
    this.elements.replayButton?.addEventListener("click", () => this.playAudio());
  }

  startStroke() {
    this.elements.validation.textContent = "";
    this.tracing = true;
    this.tracer.setEnabled(true);
    this.elements.drawingCard.classList.add("active");
    this.elements.startButton.disabled = true;
    this.elements.strokeStatus.textContent = UI_TEXT.tracingStatus;
    this.elements.drawState.textContent = UI_TEXT.tracingPrompt;

    if (this.task.kind === "audio-trace" && !this.taskStarted) {
      this.taskStarted = true;
      this.playAudio();
    }
  }

  selectState(state) {
    if (!this.tracing) return;
    this.states = applyStateSelection(this.states, state);
    this.updateTraceUi();
  }

  updateTraceUi() {
    const hasTrace = this.tracer.points.length > 0;
    const canConfirm = this.tracer.points.length >= EXPERIMENT_CONFIG.minimumTracePoints
      && this.states.length > 0;

    this.elements.confirmButton.disabled = !canConfirm;
    this.elements.stateCount.textContent = String(this.states.length);
    this.elements.timeline.textContent = this.states.length
      ? this.states.join(" · ")
      : UI_TEXT.emptyTimeline;
    this.elements.stateButtons.forEach((button) => {
      button.classList.toggle("selected", this.states.includes(button.dataset.state));
    });

    if (!this.tracing) return;
    if (!hasTrace) this.elements.drawState.textContent = UI_TEXT.tracingPrompt;
    else if (!this.states.length) this.elements.drawState.textContent = UI_TEXT.recordedPrompt;
    else this.elements.drawState.textContent = UI_TEXT.readyPrompt;
  }

  confirmStroke() {
    if (
      this.tracer.points.length < EXPERIMENT_CONFIG.minimumTracePoints
      || !this.states.length
    ) return;

    const strokeNumber = this.response.strokes.length + 1;
    const states = [...this.states];
    const preview = this.tracer.createPreview(
      EXPERIMENT_CONFIG.previewWidth,
      EXPERIMENT_CONFIG.previewHeight,
    );
    this.previewByStroke.set(strokeNumber, preview);
    this.onStroke({ strokeNumber, states });

    this.tracing = false;
    this.awaitingNextAction = true;
    this.tracer.setEnabled(false);
    this.elements.drawingCard.classList.remove("active");
    this.elements.strokeStatus.textContent = `第${formatStrokeNumber(strokeNumber)}笔已完成`;
    this.elements.drawState.textContent = UI_TEXT.completedPrompt;
    this.elements.postActions.classList.remove("hidden");
    this.elements.confirmButton.disabled = true;
    this.renderHistory();
    this.updateFinishAvailability();
  }

  redoStroke() {
    this.states = [];
    this.tracing = false;
    this.awaitingNextAction = false;
    this.tracer.setEnabled(false);
    this.tracer.reset();
    this.elements.drawingCard.classList.remove("active");
    this.elements.startButton.disabled = false;
    this.elements.startButton.textContent = "开始描摹本笔";
    this.elements.strokeStatus.textContent = UI_TEXT.waitingStatus;
    this.elements.drawState.textContent = UI_TEXT.idlePrompt;
    this.elements.postActions.classList.add("hidden");
    this.elements.validation.textContent = "";
    this.updateTraceUi();
  }

  prepareNextStroke() {
    this.states = [];
    this.tracing = false;
    this.awaitingNextAction = false;
    this.tracer.reset();
    this.elements.strokeNo.textContent = formatStrokeNumber(this.response.strokes.length + 1);
    this.elements.startButton.disabled = false;
    this.elements.startButton.textContent = "开始描摹本笔";
    this.elements.strokeStatus.textContent = UI_TEXT.waitingStatus;
    this.elements.drawState.textContent = UI_TEXT.idlePrompt;
    this.elements.postActions.classList.add("hidden");
    this.elements.validation.textContent = "";
    this.updateTraceUi();
  }

  finishCharacter() {
    if (!this.response.strokes.length) {
      this.elements.validation.textContent = "请至少完成一笔描摹。";
      return;
    }
    if (this.task.kind === "audio-trace" && !this.response.audioCompleted) {
      this.elements.validation.textContent = "请先完整听完本题音频。";
      return;
    }
    this.onComplete();
  }

  async playAudio() {
    if (!this.audio) return;
    this.elements.validation.textContent = "";
    await this.audio.play(this.task.audio, () => {
      this.response.audioCompleted = true;
      this.onAudioCompleted();
      this.updateFinishAvailability();
    });
  }

  handlePlaybackChange({ status }) {
    if (!this.elements.audioStatus) return;
    const labels = {
      playing: "正在播放，请边听边描摹",
      ended: "已完整播放，可重新播放",
      blocked: "播放未开始，请再次点击播放",
      error: "音频加载失败，请检查素材",
    };
    this.elements.audioStatus.textContent = labels[status] || "等待播放";
    if (status === "playing") {
      this.elements.replayButton.disabled = true;
    } else if (status === "ended") {
      this.elements.replayButton.disabled = false;
      this.elements.replayButton.textContent = "重新播放";
    } else if (status === "blocked" || status === "error") {
      this.elements.replayButton.disabled = false;
      this.elements.replayButton.textContent = "播放音频";
    }
  }

  updateFinishAvailability() {
    if (!this.elements.finishButton) return;
    const audioReady = this.task.kind !== "audio-trace" || this.response.audioCompleted;
    this.elements.finishButton.disabled = !this.response.strokes.length || !audioReady;
  }

  renderHistory() {
    this.elements.history.innerHTML = "";
    this.response.strokes.forEach((stroke) => {
      const row = document.createElement("div");
      row.className = "record";

      const preview = this.previewByStroke.get(stroke.strokeNumber);
      if (preview) row.append(preview);
      else {
        const ordinal = document.createElement("div");
        ordinal.className = "record-ordinal";
        ordinal.textContent = stroke.strokeNumber;
        row.append(ordinal);
      }

      const info = document.createElement("div");
      const title = document.createElement("b");
      title.textContent = `第${stroke.strokeNumber}笔`;
      info.append(title, document.createElement("br"));
      stroke.states.forEach((state) => {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = state;
        info.append(tag);
      });
      row.append(info);
      this.elements.history.append(row);
    });
  }

  updateAll() {
    this.elements.startButton.disabled = this.awaitingNextAction;
    this.elements.postActions.classList.toggle("hidden", !this.awaitingNextAction);
    if (this.elements.replayButton) {
      this.elements.replayButton.disabled = !this.response.audioCompleted;
    }
    this.updateTraceUi();
    this.updateFinishAvailability();
  }

  destroy() {
    this.tracer.destroy();
    this.audio?.destroy();
  }
}
