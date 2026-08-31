import { AudioController } from "./audio-controller.js";
import { t } from "./i18n.js";

export class ChoiceTask {
  constructor({ root, task, response, onProgress, onComplete }) {
    this.root = root;
    this.task = task;
    this.response = response;
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.selectedOption = response.selectedOption;
    this.heardOptions = new Set(response.heardOptions || []);
    this.currentAudioOption = null;
    this.playbackStatus = response.audioCompleted ? "ended" : "idle";

    this.render();
    this.cacheElements();
    this.audio = new AudioController((playback) => this.handlePlaybackChange(playback));
    this.bindEvents();
    this.updateLanguage();
  }

  render() {
    if (this.task.kind === "image-choice") {
      const options = this.task.options.map((option) => `
        <button class="image-option" data-option="${option.id}" type="button">
          <img src="${option.src}" alt="${t("choice.imageAlt", { option: option.id })}">
          <span class="option-label"><i></i><span data-image-label="${option.id}">${t("choice.imageLabel", { option: option.id })}</span></span>
          ${option.captionKey ? `<span class="option-caption" data-caption-key="${option.captionKey}">${t(option.captionKey)}</span>` : ""}
        </button>
      `).join("");
      this.root.innerHTML = `
        <div class="choice-layout">
          <section class="panel audio-question-card">
            <span class="question-kicker" id="choiceKicker">${t("choice.imageKicker")}</span>
            <h2 id="choiceHeading">${t("choice.imageTitle")}</h2>
            <p class="sub" id="choiceHint">${t("choice.imageHint")}</p>
            <button class="audio-play-button" id="questionAudioBtn" type="button">
              <span class="play-symbol">▶</span>
              <span id="questionAudioLabel"></span>
            </button>
            <p class="audio-feedback" id="audioFeedback"></p>
          </section>
          <section class="panel choice-panel">
            <div class="image-choice-grid">${options}</div>
            <div class="choice-submit-row">
              <p class="validation-message" id="choiceValidation" aria-live="polite"></p>
              <button class="btn primary" id="submitChoiceBtn" disabled>${t("choice.submit")}</button>
            </div>
          </section>
        </div>
      `;
      return;
    }

    const audioOptions = this.task.options.map((option) => `
      <article class="audio-option" data-option-card="${option.id}">
        <div class="audio-option-heading">
          <span class="option-radio"></span>
          <strong data-audio-title="${option.id}">${t("choice.audioTitle", { option: option.id })}</strong>
          <span class="heard-badge" data-heard="${option.id}">${t("choice.notHeard")}</span>
        </div>
        <div class="audio-option-actions">
          <button class="btn outline audio-candidate-btn" data-audio-option="${option.id}" type="button">${t("choice.playOption", { option: option.id })}</button>
          <button class="btn select-option-btn" data-select-option="${option.id}" type="button">${t("choice.selectOption", { option: option.id })}</button>
        </div>
      </article>
    `).join("");
    this.root.innerHTML = `
      <div class="choice-layout audio-choice-layout">
        <section class="drawing-card question-image-card">
          <span class="question-kicker" id="choiceKicker">${t("choice.audioKicker")}</span>
          <h2 id="choiceHeading">${t("choice.audioHeading")}</h2>
          <div class="question-image-wrap">
            <img id="questionImage" src="${this.task.image}" alt="${t("choice.questionImageAlt")}">
          </div>
        </section>
        <section class="panel choice-panel">
          <p class="sub" id="choiceHint">${t("choice.audioHint")}</p>
          <div class="audio-option-list">${audioOptions}</div>
          <div class="choice-submit-row">
            <p class="validation-message" id="choiceValidation" aria-live="polite"></p>
            <button class="btn primary" id="submitChoiceBtn" disabled>${t("choice.submit")}</button>
          </div>
        </section>
      </div>
    `;
  }

  cacheElements() {
    const find = (selector) => this.root.querySelector(selector);
    this.elements = {
      submitButton: find("#submitChoiceBtn"),
      validation: find("#choiceValidation"),
      kicker: find("#choiceKicker"),
      heading: find("#choiceHeading"),
      hint: find("#choiceHint"),
      questionImage: find("#questionImage"),
      questionAudioButton: find("#questionAudioBtn"),
      questionAudioLabel: find("#questionAudioLabel"),
      audioFeedback: find("#audioFeedback"),
      imageOptions: [...this.root.querySelectorAll(".image-option")],
      imageLabels: [...this.root.querySelectorAll("[data-image-label]")],
      optionCaptions: [...this.root.querySelectorAll("[data-caption-key]")],
      candidateAudioButtons: [...this.root.querySelectorAll(".audio-candidate-btn")],
      selectOptionButtons: [...this.root.querySelectorAll(".select-option-btn")],
      audioTitles: [...this.root.querySelectorAll("[data-audio-title]")],
      audioOptionCards: [...this.root.querySelectorAll(".audio-option")],
    };
  }

  bindEvents() {
    this.elements.submitButton.addEventListener("click", () => this.submit());
    this.elements.questionAudioButton?.addEventListener("click", () => this.playQuestionAudio());
    this.elements.imageOptions.forEach((option) => {
      option.addEventListener("click", () => this.select(option.dataset.option));
    });
    this.elements.candidateAudioButtons.forEach((button) => {
      button.addEventListener("click", () => this.playCandidate(button.dataset.audioOption));
    });
    this.elements.selectOptionButtons.forEach((button) => {
      button.addEventListener("click", () => this.select(button.dataset.selectOption));
    });
  }

  select(optionId) {
    const option = this.task.options.find((candidate) => candidate.id === optionId);
    if (!option) return;
    this.selectedOption = optionId;
    this.response.selectedOption = optionId;
    this.response.selectedValue = option.value;
    this.onProgress();
    this.updateUi();
  }

  async playQuestionAudio() {
    await this.audio.play(this.task.audio, () => {
      this.response.audioCompleted = true;
      this.onProgress();
      this.updateUi();
    });
  }

  async playCandidate(optionId) {
    const option = this.task.options.find((candidate) => candidate.id === optionId);
    if (!option) return;
    this.currentAudioOption = optionId;
    await this.audio.play(option.src, () => {
      this.heardOptions.add(optionId);
      this.response.heardOptions = [...this.heardOptions];
      this.currentAudioOption = null;
      this.onProgress();
      this.updateUi();
    });
  }

  handlePlaybackChange({ status }) {
    this.playbackStatus = status;
    if (this.task.kind === "image-choice") {
      this.elements.questionAudioButton.disabled = status === "playing";
    } else if (status === "blocked" || status === "error") {
      this.currentAudioOption = null;
    }
    this.updateUi();
  }

  updateQuestionAudioUi() {
    if (!this.elements.questionAudioLabel) return;
    const labelKeys = {
      idle: "choice.playQuestion",
      playing: "choice.status.playing",
      ended: "choice.replayQuestion",
      blocked: "choice.status.retry",
      error: "choice.status.error",
    };
    const feedbackKeys = {
      idle: this.response.audioCompleted ? "choice.completed" : "choice.listenOnce",
      playing: "choice.feedback.playing",
      ended: "choice.feedback.ended",
      blocked: "choice.feedback.blocked",
      error: "choice.feedback.error",
    };
    this.elements.questionAudioLabel.textContent = t(labelKeys[this.playbackStatus] || "choice.playQuestion");
    this.elements.audioFeedback.textContent = t(feedbackKeys[this.playbackStatus] || "choice.listenOnce");
  }

  updateCandidateButtons() {
    const isPlaying = this.playbackStatus === "playing";
    this.elements.candidateAudioButtons.forEach((button) => {
      const optionId = button.dataset.audioOption;
      button.disabled = isPlaying;
      if (isPlaying && optionId === this.currentAudioOption) {
        button.textContent = t("choice.status.playing");
      } else {
        button.textContent = t(
          this.heardOptions.has(optionId) ? "choice.replayOption" : "choice.playOption",
          { option: optionId },
        );
      }
    });
  }

  updateUi() {
    this.elements.imageOptions.forEach((option) => {
      option.classList.toggle("selected", option.dataset.option === this.selectedOption);
    });
    this.elements.audioOptionCards.forEach((card) => {
      const optionId = card.dataset.optionCard;
      card.classList.toggle("selected", optionId === this.selectedOption);
      const heardBadge = card.querySelector(".heard-badge");
      const heard = this.heardOptions.has(optionId);
      heardBadge.textContent = t(heard ? "choice.heard" : "choice.notHeard");
      heardBadge.classList.toggle("done", heard);
    });

    this.updateQuestionAudioUi();
    this.updateCandidateButtons();

    const audioReady = this.task.kind === "image-choice"
      ? this.response.audioCompleted
      : this.heardOptions.size === this.task.options.length;
    this.elements.submitButton.disabled = !this.selectedOption || !audioReady;

    if (this.playbackStatus === "blocked") {
      this.elements.validation.textContent = t("choice.validation.blocked");
    } else if (this.playbackStatus === "error") {
      this.elements.validation.textContent = t("choice.validation.error");
    } else if (!this.selectedOption) {
      this.elements.validation.textContent = t("choice.validation.select");
    } else if (!audioReady) {
      this.elements.validation.textContent = t(
        this.task.kind === "image-choice"
          ? "choice.validation.questionAudio"
          : "choice.validation.allAudio",
      );
    } else {
      this.elements.validation.textContent = "";
    }
  }

  updateLanguage() {
    this.elements.submitButton.textContent = t("choice.submit");
    if (this.task.kind === "image-choice") {
      this.elements.kicker.textContent = t("choice.imageKicker");
      this.elements.heading.textContent = t("choice.imageTitle");
      this.elements.hint.textContent = t("choice.imageHint");
      this.elements.imageOptions.forEach((option) => {
        option.querySelector("img").alt = t("choice.imageAlt", { option: option.dataset.option });
      });
      this.elements.imageLabels.forEach((label) => {
        label.textContent = t("choice.imageLabel", { option: label.dataset.imageLabel });
      });
      this.elements.optionCaptions.forEach((caption) => {
        caption.textContent = t(caption.dataset.captionKey);
      });
    } else {
      this.elements.kicker.textContent = t("choice.audioKicker");
      this.elements.heading.textContent = t("choice.audioHeading");
      this.elements.hint.textContent = t("choice.audioHint");
      this.elements.questionImage.alt = t("choice.questionImageAlt");
      this.elements.audioTitles.forEach((title) => {
        title.textContent = t("choice.audioTitle", { option: title.dataset.audioTitle });
      });
      this.elements.selectOptionButtons.forEach((button) => {
        button.textContent = t("choice.selectOption", { option: button.dataset.selectOption });
      });
    }
    this.updateUi();
  }

  submit() {
    if (this.elements.submitButton.disabled) return;
    this.onComplete({
      selectedOption: this.response.selectedOption,
      selectedValue: this.response.selectedValue,
    });
  }

  destroy() {
    this.audio.destroy();
  }
}
