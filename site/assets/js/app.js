import { ChoiceTask } from "./choice-task.js";
import { getSection, SECTIONS, TASKS } from "./config.js";
import { getLanguage, setLanguage, t } from "./i18n.js";
import { createSession, ensureResponse, SessionStore } from "./session-store.js";
import { StrokeImageStore } from "./stroke-image-store.js";
import { TraceTask } from "./trace-task.js";
import { createExperimentZip, downloadBlob } from "./zip-exporter.js";

function sectionI18nKey(sectionId) {
  return sectionId === "audio-trace" ? "audioTrace" : sectionId;
}

export class ExperimentApp {
  constructor(root = document) {
    this.root = root;
    this.store = new SessionStore();
    this.strokeImageStore = new StrokeImageStore();
    this.session = this.store.load();
    this.activeTaskController = null;
    this.currentView = null;
    this.currentFinishStatus = null;
    this.exporting = false;
    this.saveStatusKey = "shell.notStarted";
    this.saveStatusVariables = {};
    this.cacheShell();
    this.bindShellEvents();
  }

  cacheShell() {
    const find = (selector) => this.root.querySelector(selector);
    this.elements = {
      siteTitle: find("#siteTitle"),
      sectionBadge: find("#sectionBadge"),
      headerSubtitle: find("#headerSubtitle"),
      progressPanel: find("#progressPanel"),
      progressText: find("#progressText"),
      progressNote: find("#progressNote"),
      progressFill: find("#progressFill"),
      sectionSteps: find("#sectionSteps"),
      earlyExitButton: find("#earlyExitBtn"),
      languageSwitch: find("#languageSwitch"),
      languageButtons: [...this.root.querySelectorAll("[data-language]")],
      screen: find("#screen"),
      saveStatus: find("#saveStatus"),
      storageNote: find("#storageNote"),
    };
  }

  bindShellEvents() {
    this.elements.earlyExitButton.addEventListener("click", () => this.endEarly());
    this.elements.languageButtons.forEach((button) => {
      button.addEventListener("click", () => this.changeLanguage(button.dataset.language));
    });
  }

  mount() {
    setLanguage(getLanguage());
    this.applyShellLanguage();
    if (this.session?.status === "completed" || this.session?.status === "incomplete") {
      this.renderFinished(this.session.status);
      return;
    }
    this.renderWelcome();
  }

  changeLanguage(language) {
    if (language === getLanguage()) return;
    setLanguage(language);
    this.applyShellLanguage();

    if (this.currentView === "task" && this.session?.status === "active") {
      const task = TASKS[this.session.currentTaskIndex];
      this.updateChrome(task);
      this.activeTaskController?.updateLanguage();
    } else if (this.currentView === "finished") {
      this.renderFinished(this.currentFinishStatus);
    } else {
      this.renderWelcome();
    }
  }

  applyShellLanguage() {
    document.title = t("site.title");
    this.elements.siteTitle.textContent = t("site.title");
    this.elements.earlyExitButton.textContent = t("shell.earlyExit");
    this.elements.progressPanel.setAttribute("aria-label", t("shell.progressAria"));
    this.elements.progressNote.textContent = t("shell.noBack");
    this.elements.storageNote.textContent = t("shell.localOnly");
    this.elements.languageSwitch.setAttribute("aria-label", t("shell.language"));
    this.elements.languageButtons.forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.language === getLanguage()));
    });
    this.updateSaveStatus(this.saveStatusKey, this.saveStatusVariables);
  }

  renderWelcome() {
    this.destroyActiveTask();
    this.currentView = "welcome";
    this.elements.sectionBadge.textContent = t("shell.instructions");
    this.elements.headerSubtitle.textContent = t("site.subtitle");
    this.elements.progressPanel.classList.add("hidden");
    this.elements.earlyExitButton.classList.add("hidden");

    const resumePanel = this.session?.status === "active"
      ? `
        <div class="resume-card">
          <div>
            <strong>${t("welcome.resumeTitle")}</strong>
            <span>${t("welcome.resumeProgress", {
              current: Math.min(this.session.currentTaskIndex + 1, TASKS.length),
              total: TASKS.length,
            })}</span>
          </div>
          <div class="resume-actions">
            <button class="btn primary" id="resumeBtn">${t("welcome.resume")}</button>
            <button class="btn outline" id="exportSavedBtn">${t("welcome.exportIncomplete")}</button>
          </div>
        </div>
      `
      : "";

    this.elements.screen.innerHTML = `
      <section class="welcome-card">
        <span class="welcome-kicker">${t("welcome.kicker")}</span>
        <h2>${t("welcome.title")}</h2>
        <p class="welcome-lead">${t("welcome.lead")}</p>
        <div class="instruction-grid">
          <article>
            <span>01</span>
            <h3>${t("welcome.traceTitle")}</h3>
            <p>${t("welcome.traceBody")}</p>
          </article>
          <article>
            <span>02</span>
            <h3>${t("welcome.listenTitle")}</h3>
            <p>${t("welcome.listenBody")}</p>
          </article>
          <article>
            <span>03</span>
            <h3>${t("welcome.saveTitle")}</h3>
            <p>${t("welcome.saveBody")}</p>
          </article>
        </div>
        ${resumePanel}
        <div class="welcome-actions">
          <button class="btn primary large" id="startExperimentBtn">${t("welcome.start")}</button>
        </div>
        <p class="privacy-note">${t("welcome.privacy")}</p>
      </section>
    `;

    this.elements.screen.querySelector("#startExperimentBtn")
      .addEventListener("click", () => this.startNewSession());
    this.elements.screen.querySelector("#resumeBtn")
      ?.addEventListener("click", () => this.resumeSession());
    this.elements.screen.querySelector("#exportSavedBtn")
      ?.addEventListener("click", () => this.endEarly());
    this.updateSaveStatus("shell.notStarted");
  }

  async startNewSession() {
    if (
      this.session?.status === "active"
      && !window.confirm(t("confirm.replace"))
    ) return;

    if (this.session?.sessionId) {
      await this.strokeImageStore.deleteSession(this.session.sessionId);
    }
    this.session = createSession();
    this.store.save(this.session);
    this.renderCurrentTask();
  }

  resumeSession() {
    if (!this.session || this.session.status !== "active") return;
    this.renderCurrentTask();
  }

  renderCurrentTask() {
    this.destroyActiveTask();
    if (this.session.currentTaskIndex >= TASKS.length) {
      this.completeExperiment();
      return;
    }

    this.currentView = "task";
    const task = TASKS[this.session.currentTaskIndex];
    const response = ensureResponse(this.session, task);
    this.store.save(this.session);
    this.updateChrome(task);
    this.elements.screen.innerHTML = "";

    if (task.kind === "trace" || task.kind === "audio-trace") {
      this.activeTaskController = new TraceTask({
        root: this.elements.screen,
        task,
        response,
        onStroke: async (stroke, imageBlob) => {
          await this.strokeImageStore.save({
            sessionId: this.session.sessionId,
            task,
            strokeNumber: stroke.strokeNumber,
            blob: imageBlob,
          });
          response.strokes.push(stroke);
          try {
            this.saveProgress();
          } catch (error) {
            response.strokes.pop();
            throw error;
          }
        },
        onAudioCompleted: () => {
          response.audioCompleted = true;
          this.saveProgress();
        },
        onComplete: () => {
          response.status = "completed";
          this.advanceTask();
        },
      });
      return;
    }

    this.activeTaskController = new ChoiceTask({
      root: this.elements.screen,
      task,
      response,
      onProgress: () => this.saveProgress(),
      onComplete: ({ selectedOption, selectedValue }) => {
        response.selectedOption = selectedOption;
        response.selectedValue = selectedValue;
        response.status = "completed";
        this.advanceTask();
      },
    });
  }

  updateChrome(task) {
    const section = getSection(task.sectionId);
    const key = sectionI18nKey(task.sectionId);
    const overallQuestion = this.session.currentTaskIndex + 1;
    const sectionTasks = TASKS.filter((candidate) => candidate.sectionId === task.sectionId);
    this.elements.sectionBadge.textContent = t("section.badge", { order: section.order });
    this.elements.headerSubtitle.textContent = t(`section.${key}.title`);
    this.elements.progressPanel.classList.remove("hidden");
    this.elements.earlyExitButton.classList.remove("hidden");
    this.elements.progressText.textContent = t("progress.summary", {
      overall: overallQuestion,
      total: TASKS.length,
      current: task.questionOrder,
      sectionTotal: sectionTasks.length,
    });
    this.elements.progressFill.style.width = `${((overallQuestion - 1) / TASKS.length) * 100}%`;
    this.elements.sectionSteps.innerHTML = SECTIONS.map((item) => {
      const state = item.order < section.order
        ? "done"
        : item.order === section.order
          ? "current"
          : "";
      const itemKey = sectionI18nKey(item.id);
      return `<div class="section-step ${state}"><i></i><span>${t(`section.${itemKey}.short`)}</span></div>`;
    }).join("");
  }

  saveProgress() {
    this.store.save(this.session);
    this.updateSaveStatus("save.auto");
  }

  advanceTask() {
    this.session.currentTaskIndex += 1;
    this.store.save(this.session);
    this.renderCurrentTask();
  }

  completeExperiment() {
    this.session.status = "completed";
    this.session.endedAt = new Date().toISOString();
    this.store.save(this.session);
    this.renderFinished("completed");
  }

  async endEarly() {
    if (!this.session || this.session.status !== "active") return;
    const confirmed = window.confirm(t("confirm.earlyExit"));
    if (!confirmed) return;

    this.destroyActiveTask();
    this.session.status = "incomplete";
    this.session.endedAt = new Date().toISOString();
    this.store.save(this.session);
    await this.downloadArchive();
    this.renderFinished("incomplete");
  }

  async downloadArchive(button = null) {
    if (this.exporting) return false;
    this.exporting = true;
    if (button) {
      button.disabled = true;
      button.textContent = t("export.preparing");
    }
    this.updateSaveStatus("export.preparing");
    try {
      const images = await this.strokeImageStore.getSessionImages(this.session.sessionId);
      const archive = await createExperimentZip(this.session, TASKS, images);
      downloadBlob(archive.blob, archive.filename);
      return true;
    } catch {
      window.alert(t("export.failed"));
      return false;
    } finally {
      this.exporting = false;
      const currentButton = this.elements.screen.querySelector("#downloadArchiveBtn");
      if (currentButton) {
        currentButton.disabled = false;
        currentButton.textContent = t("finish.download");
      }
    }
  }

  renderFinished(status) {
    this.destroyActiveTask();
    this.currentView = "finished";
    this.currentFinishStatus = status;
    this.elements.progressPanel.classList.add("hidden");
    this.elements.earlyExitButton.classList.add("hidden");
    this.elements.sectionBadge.textContent = t(status === "completed"
      ? "finish.completedBadge"
      : "finish.incompleteBadge");
    this.elements.headerSubtitle.textContent = t("finish.subtitle");

    const strokeCount = Object.values(this.session.responses)
      .reduce((total, response) => total + (response.strokes?.length || 0), 0);
    const choiceCount = Object.values(this.session.responses)
      .filter((response) => response.selectedOption).length;
    const title = t(status === "completed"
      ? "finish.completedTitle"
      : "finish.incompleteTitle");
    const description = t(status === "completed"
      ? "finish.completedBody"
      : "finish.incompleteBody");

    this.elements.screen.innerHTML = `
      <section class="finish-card">
        <div class="finish-icon">✓</div>
        <span class="welcome-kicker">${status === "completed" ? "COMPLETED" : "INCOMPLETE"}</span>
        <h2>${title}</h2>
        <p>${description}</p>
        <div class="result-summary">
          <div><strong>${strokeCount}</strong><span>${t("finish.strokes")}</span></div>
          <div><strong>${choiceCount}</strong><span>${t("finish.choices")}</span></div>
          <div><strong>${this.session.currentTaskIndex}</strong><span>${t("finish.questions")}</span></div>
        </div>
        <div class="finish-actions">
          <button class="btn primary large" id="downloadArchiveBtn" ${this.exporting ? "disabled" : ""}>${t(this.exporting ? "export.preparing" : "finish.download")}</button>
          <button class="btn outline" id="newSessionBtn">${t("finish.new")}</button>
        </div>
        <p class="privacy-note">${t("finish.downloadHint")}</p>
      </section>
    `;
    this.elements.screen.querySelector("#downloadArchiveBtn")
      .addEventListener("click", (event) => this.downloadArchive(event.currentTarget));
    this.elements.screen.querySelector("#newSessionBtn")
      .addEventListener("click", async () => {
        await this.strokeImageStore.deleteSession(this.session.sessionId);
        this.store.clear();
        this.session = null;
        this.renderWelcome();
      });
    this.updateSaveStatus(status === "completed" ? "save.completed" : "save.incomplete");
  }

  updateSaveStatus(key, variables = {}) {
    this.saveStatusKey = key;
    this.saveStatusVariables = variables;
    this.elements.saveStatus.textContent = t(key, variables);
  }

  destroyActiveTask() {
    this.activeTaskController?.destroy();
    this.activeTaskController = null;
  }
}
