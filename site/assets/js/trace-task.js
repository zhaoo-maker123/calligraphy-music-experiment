import { AudioController } from "./audio-controller.js";
import { CanvasTracer } from "./canvas-tracer.js";
import { applyStateSelection, EXPERIMENT_CONFIG, formatStrokeNumber } from "./config.js";
import { getLanguage, t, translateState } from "./i18n.js";

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
    this.audioPlaybackStatus = response.audioCompleted ? "ended" : "waiting";
    this.validationKey = null;

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
            <strong id="traceAudioTitle">${t("trace.audioTitle")}</strong>
            <span id="audioStatus">${t(this.response.audioCompleted ? "trace.audio.ended" : "trace.audio.waiting")}</span>
          </div>
          <button class="btn outline compact" id="replayBtn" ${this.response.audioCompleted ? "" : "disabled"}>${t("trace.replay")}</button>
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
      return `<button class="btn ${className} state-btn" data-state="${state}"><span class="state-label">${translateState(state)}</span>${suffix}</button>`;
    }).join("");

    this.root.innerHTML = `
      ${audioPanel}
      <div class="layout trace-layout">
        <section class="drawing-card" id="drawingCard">
          <div class="canvas-wrap">
            <img id="referenceImage" src="${this.task.image}" alt="${t("trace.imageAlt")}">
            <canvas id="traceCanvas" aria-label="${t("trace.canvasAria")}"></canvas>
          </div>
          <div class="state" id="drawState">${t("trace.prompt.idle")}</div>
        </section>

        <section class="panel task-panel">
          <div class="panel-heading">
            <div>
              <h2 id="traceHeading">${t("trace.heading")}</h2>
              <p class="sub"><span id="currentStrokePrefix">${t("trace.currentPrefix")}</span> <b id="strokeNo">${formatStrokeNumber(this.response.strokes.length + 1, getLanguage())}</b> <span id="strokeUnit">${t("trace.strokeUnit")}</span> · <span id="selectedPrefix">${t("trace.selectedPrefix")}</span> <span id="stateCount">0</span> <span id="stateCountUnit">${t("trace.stateCountUnit")}</span></p>
            </div>
            <span class="badge" id="strokeStatus"></span>
          </div>

          <button class="btn primary" id="startStrokeBtn"></button>

          <div class="history" id="strokeHistory"></div>

          <div class="controls">
            <p class="question" id="traceQuestion">${t("trace.question")}</p>
            <div class="buttons">${stateButtons}</div>
            <div class="selection-line"><span id="currentStatesLabel">${t("trace.currentStates")}</span> <span id="timeline">${t("trace.emptyStates")}</span></div>
            <div class="actions">
              <button class="btn primary" id="confirmStrokeBtn" disabled>${t("trace.confirm")}</button>
              <button class="btn primary" id="redoStrokeBtn">${t("trace.redo")}</button>
            </div>
          </div>

          <div class="post-stroke-actions ${this.awaitingNextAction ? "" : "hidden"}" id="postStrokeActions">
            <button class="btn outline" id="nextStrokeBtn">${t("trace.nextStroke")}</button>
            <button class="btn primary" id="finishCharacterBtn">${t("trace.finishCharacter")}</button>
          </div>
          <p class="validation-message" id="traceValidation" aria-live="polite"></p>
          <div class="note" id="traceNote">${t("trace.note")}</div>
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
      traceAudioTitle: find("#traceAudioTitle"),
      traceHeading: find("#traceHeading"),
      currentStrokePrefix: find("#currentStrokePrefix"),
      strokeNo: find("#strokeNo"),
      strokeUnit: find("#strokeUnit"),
      selectedPrefix: find("#selectedPrefix"),
      stateCount: find("#stateCount"),
      stateCountUnit: find("#stateCountUnit"),
      timeline: find("#timeline"),
      currentStatesLabel: find("#currentStatesLabel"),
      strokeStatus: find("#strokeStatus"),
      startButton: find("#startStrokeBtn"),
      confirmButton: find("#confirmStrokeBtn"),
      redoButton: find("#redoStrokeBtn"),
      nextStrokeButton: find("#nextStrokeBtn"),
      finishButton: find("#finishCharacterBtn"),
      postActions: find("#postStrokeActions"),
      validation: find("#traceValidation"),
      history: find("#strokeHistory"),
      traceQuestion: find("#traceQuestion"),
      traceNote: find("#traceNote"),
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
    this.setValidation(null);
    this.tracing = true;
    this.tracer.setEnabled(true);
    this.elements.drawingCard.classList.add("active");
    this.elements.startButton.disabled = true;

    if (this.task.kind === "audio-trace" && !this.taskStarted) {
      this.taskStarted = true;
      this.playAudio();
    }
    this.updateDynamicText();
  }

  selectState(state) {
    if (!this.tracing) return;
    this.states = applyStateSelection(this.states, state);
    this.updateTraceUi();
  }

  updateTraceUi() {
    const canConfirm = this.tracer.points.length >= EXPERIMENT_CONFIG.minimumTracePoints
      && this.states.length > 0;

    this.elements.confirmButton.disabled = !canConfirm;
    this.elements.stateCount.textContent = String(this.states.length);
    this.elements.timeline.textContent = this.states.length
      ? this.states.map(translateState).join(" · ")
      : t("trace.emptyStates");
    this.elements.stateButtons.forEach((button) => {
      button.classList.toggle("selected", this.states.includes(button.dataset.state));
    });
    this.updateDrawPrompt();
  }

  updateDrawPrompt() {
    let key = "trace.prompt.idle";
    if (this.awaitingNextAction) key = "trace.prompt.completed";
    else if (this.tracing && !this.tracer.points.length) key = "trace.prompt.tracing";
    else if (this.tracing && !this.states.length) key = "trace.prompt.recorded";
    else if (this.tracing) key = "trace.prompt.ready";
    this.elements.drawState.textContent = t(key);
  }

  updateStrokeStatus() {
    if (this.tracing) {
      this.elements.strokeStatus.textContent = t("trace.status.tracing");
    } else if (this.awaitingNextAction && this.response.strokes.length) {
      this.elements.strokeStatus.textContent = t("trace.status.completed", {
        number: formatStrokeNumber(this.response.strokes.length, getLanguage()),
      });
    } else {
      this.elements.strokeStatus.textContent = t("trace.status.waiting");
    }
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
    this.elements.postActions.classList.remove("hidden");
    this.elements.confirmButton.disabled = true;
    this.renderHistory();
    this.updateDynamicText();
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
    this.elements.postActions.classList.add("hidden");
    this.setValidation(null);
    this.updateDynamicText();
  }

  prepareNextStroke() {
    this.states = [];
    this.tracing = false;
    this.awaitingNextAction = false;
    this.tracer.reset();
    this.elements.startButton.disabled = false;
    this.elements.postActions.classList.add("hidden");
    this.setValidation(null);
    this.updateDynamicText();
  }

  finishCharacter() {
    if (!this.response.strokes.length) {
      this.setValidation("trace.validation.stroke");
      return;
    }
    if (this.task.kind === "audio-trace" && !this.response.audioCompleted) {
      this.setValidation("trace.validation.audio");
      return;
    }
    this.onComplete();
  }

  setValidation(key) {
    this.validationKey = key;
    this.elements.validation.textContent = key ? t(key) : "";
  }

  async playAudio() {
    if (!this.audio) return;
    this.setValidation(null);
    await this.audio.play(this.task.audio, () => {
      this.response.audioCompleted = true;
      this.onAudioCompleted();
      this.updateFinishAvailability();
    });
  }

  handlePlaybackChange({ status }) {
    this.audioPlaybackStatus = status;
    if (status === "playing") {
      this.elements.replayButton.disabled = true;
    } else if (status === "ended" || status === "blocked" || status === "error") {
      this.elements.replayButton.disabled = false;
    }
    this.updateAudioText();
  }

  updateAudioText() {
    if (!this.elements.audioStatus) return;
    this.elements.audioStatus.textContent = t(`trace.audio.${this.audioPlaybackStatus}`);
    this.elements.replayButton.textContent = t(
      this.audioPlaybackStatus === "blocked" || this.audioPlaybackStatus === "error"
        ? "trace.playAudio"
        : "trace.replay",
    );
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
      title.textContent = t("trace.historyTitle", { number: stroke.strokeNumber });
      info.append(title, document.createElement("br"));
      stroke.states.forEach((state) => {
        const tag = document.createElement("span");
        tag.className = "tag";
        tag.textContent = translateState(state);
        info.append(tag);
      });
      row.append(info);
      this.elements.history.append(row);
    });
  }

  updateDynamicText() {
    this.elements.strokeNo.textContent = formatStrokeNumber(
      this.response.strokes.length + (this.awaitingNextAction ? 0 : 1),
      getLanguage(),
    );
    this.elements.startButton.textContent = t(
      this.task.kind === "audio-trace" && !this.taskStarted
        ? "trace.startTaskAudio"
        : "trace.startStroke",
    );
    this.updateStrokeStatus();
    this.updateTraceUi();
    this.updateAudioText();
    if (this.validationKey) this.elements.validation.textContent = t(this.validationKey);
  }

  updateLanguage() {
    this.elements.traceAudioTitle && (this.elements.traceAudioTitle.textContent = t("trace.audioTitle"));
    this.elements.referenceImage.alt = t("trace.imageAlt");
    this.elements.canvas.setAttribute("aria-label", t("trace.canvasAria"));
    this.elements.traceHeading.textContent = t("trace.heading");
    this.elements.currentStrokePrefix.textContent = t("trace.currentPrefix");
    this.elements.strokeUnit.textContent = t("trace.strokeUnit");
    this.elements.selectedPrefix.textContent = t("trace.selectedPrefix");
    this.elements.stateCountUnit.textContent = t("trace.stateCountUnit");
    this.elements.currentStatesLabel.textContent = t("trace.currentStates");
    this.elements.traceQuestion.textContent = t("trace.question");
    this.elements.confirmButton.textContent = t("trace.confirm");
    this.elements.redoButton.textContent = t("trace.redo");
    this.elements.nextStrokeButton.textContent = t("trace.nextStroke");
    this.elements.finishButton.textContent = t("trace.finishCharacter");
    this.elements.traceNote.textContent = t("trace.note");
    this.elements.stateButtons.forEach((button) => {
      button.querySelector(".state-label").textContent = translateState(button.dataset.state);
    });
    this.renderHistory();
    this.updateDynamicText();
  }

  updateAll() {
    this.elements.startButton.disabled = this.awaitingNextAction;
    this.elements.postActions.classList.toggle("hidden", !this.awaitingNextAction);
    if (this.elements.replayButton) {
      this.elements.replayButton.disabled = !this.response.audioCompleted;
    }
    this.updateLanguage();
    this.updateFinishAvailability();
  }

  destroy() {
    this.tracer.destroy();
    this.audio?.destroy();
  }
}
