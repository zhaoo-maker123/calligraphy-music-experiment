import { AudioController } from "./audio-controller.js";

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

    this.render();
    this.cacheElements();
    this.audio = new AudioController((playback) => this.handlePlaybackChange(playback));
    this.bindEvents();
    this.updateUi();
  }

  render() {
    if (this.task.kind === "image-choice") {
      const options = this.task.options.map((option) => `
        <button class="image-option" data-option="${option.id}" type="button">
          <img src="${option.src}" alt="书法选项 ${option.id}">
          <span class="option-label"><i></i>书法 ${option.id}</span>
        </button>
      `).join("");
      this.root.innerHTML = `
        <div class="choice-layout">
          <section class="panel audio-question-card">
            <span class="question-kicker">三字一音</span>
            <h2>完整听完音频，选择最匹配的书法</h2>
            <p class="sub">音频不可暂停，可以在听完后重新播放。</p>
            <button class="audio-play-button" id="questionAudioBtn" type="button">
              <span class="play-symbol">▶</span>
              <span id="questionAudioLabel">${this.response.audioCompleted ? "重新播放音频" : "播放本题音频"}</span>
            </button>
            <p class="audio-feedback" id="audioFeedback">${this.response.audioCompleted ? "已完整播放" : "请先完整听完一次"}</p>
          </section>
          <section class="panel choice-panel">
            <div class="image-choice-grid">${options}</div>
            <div class="choice-submit-row">
              <p class="validation-message" id="choiceValidation" aria-live="polite"></p>
              <button class="btn primary" id="submitChoiceBtn" disabled>确认选择，进入下一题</button>
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
          <strong>音频 ${option.id}</strong>
          <span class="heard-badge" data-heard="${option.id}">未听完</span>
        </div>
        <div class="audio-option-actions">
          <button class="btn outline audio-candidate-btn" data-audio-option="${option.id}" type="button">播放音频 ${option.id}</button>
          <button class="btn select-option-btn" data-select-option="${option.id}" type="button">选择音频 ${option.id}</button>
        </div>
      </article>
    `).join("");
    this.root.innerHTML = `
      <div class="choice-layout audio-choice-layout">
        <section class="drawing-card question-image-card">
          <span class="question-kicker">一字三音</span>
          <h2>观察书法，选择最匹配的音频</h2>
          <div class="question-image-wrap">
            <img src="${this.task.image}" alt="本题书法图片">
          </div>
        </section>
        <section class="panel choice-panel">
          <p class="sub">请依次完整听完音频 A、B、C，试听完成后单选一个。</p>
          <div class="audio-option-list">${audioOptions}</div>
          <div class="choice-submit-row">
            <p class="validation-message" id="choiceValidation" aria-live="polite"></p>
            <button class="btn primary" id="submitChoiceBtn" disabled>确认选择，进入下一题</button>
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
      questionAudioButton: find("#questionAudioBtn"),
      questionAudioLabel: find("#questionAudioLabel"),
      audioFeedback: find("#audioFeedback"),
      imageOptions: [...this.root.querySelectorAll(".image-option:not(.preview-only)")],
      candidateAudioButtons: [...this.root.querySelectorAll(".audio-candidate-btn")],
      selectOptionButtons: [...this.root.querySelectorAll(".select-option-btn")],
      audioOptionCards: [...this.root.querySelectorAll(".audio-option")],
    };
  }

  bindEvents() {
    this.elements.submitButton?.addEventListener("click", () => this.submit());
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
    if (this.task.kind === "image-choice") {
      const labels = {
        playing: "播放中…",
        ended: "重新播放音频",
        blocked: "点击重试播放",
        error: "音频加载失败",
      };
      const feedback = {
        playing: "请完整听完本题音频",
        ended: "已完整播放，可以选择书法",
        blocked: "浏览器未能开始播放，请再次点击",
        error: "音频加载失败，请刷新后重试",
      };
      this.elements.questionAudioLabel.textContent = labels[status] || "播放本题音频";
      this.elements.audioFeedback.textContent = feedback[status] || "请先完整听完一次";
      this.elements.questionAudioButton.disabled = status === "playing";
      return;
    }

    const isPlaying = status === "playing";
    this.elements.candidateAudioButtons.forEach((button) => {
      const optionId = button.dataset.audioOption;
      button.disabled = isPlaying;
      if (isPlaying && optionId === this.currentAudioOption) button.textContent = "播放中…";
      else button.textContent = this.heardOptions.has(optionId)
        ? `重新播放音频 ${optionId}`
        : `播放音频 ${optionId}`;
    });
    if (status === "blocked" || status === "error") {
      this.currentAudioOption = null;
      this.elements.candidateAudioButtons.forEach((button) => {
        button.disabled = false;
      });
      this.elements.validation.textContent = status === "blocked"
        ? "浏览器未能开始播放，请再次点击。"
        : "音频加载失败，请刷新后重试。";
    }
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
      heardBadge.textContent = heard ? "已听完" : "未听完";
      heardBadge.classList.toggle("done", heard);
    });
    this.elements.candidateAudioButtons.forEach((button) => {
      const optionId = button.dataset.audioOption;
      button.textContent = this.heardOptions.has(optionId)
        ? `重新播放音频 ${optionId}`
        : `播放音频 ${optionId}`;
    });

    const audioReady = this.task.kind === "image-choice"
      ? this.response.audioCompleted
      : this.heardOptions.size === this.task.options.length;
    this.elements.submitButton.disabled = !this.selectedOption || !audioReady;

    if (!this.selectedOption) {
      this.elements.validation.textContent = "请选择一个最匹配的选项。";
    } else if (!audioReady) {
      this.elements.validation.textContent = this.task.kind === "image-choice"
        ? "请先完整听完本题音频。"
        : "请完整听完音频 A、B、C。";
    } else {
      this.elements.validation.textContent = "";
    }
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
