import { ChoiceTask } from "./choice-task.js";
import { downloadCsv } from "./csv-exporter.js";
import { getSection, SECTIONS, TASKS } from "./config.js";
import { createSession, ensureResponse, SessionStore } from "./session-store.js";
import { TraceTask } from "./trace-task.js";

export class ExperimentApp {
  constructor(root = document) {
    this.root = root;
    this.store = new SessionStore();
    this.session = this.store.load();
    this.activeTaskController = null;
    this.cacheShell();
    this.bindShellEvents();
  }

  cacheShell() {
    const find = (selector) => this.root.querySelector(selector);
    this.elements = {
      sectionBadge: find("#sectionBadge"),
      headerSubtitle: find("#headerSubtitle"),
      progressPanel: find("#progressPanel"),
      progressText: find("#progressText"),
      progressFill: find("#progressFill"),
      sectionSteps: find("#sectionSteps"),
      earlyExitButton: find("#earlyExitBtn"),
      screen: find("#screen"),
      saveStatus: find("#saveStatus"),
    };
  }

  bindShellEvents() {
    this.elements.earlyExitButton.addEventListener("click", () => this.endEarly());
  }

  mount() {
    if (this.session?.status === "completed" || this.session?.status === "incomplete") {
      this.renderFinished(this.session.status);
      return;
    }
    this.renderWelcome();
  }

  renderWelcome() {
    this.destroyActiveTask();
    this.elements.sectionBadge.textContent = "实验说明";
    this.elements.headerSubtitle.textContent = "书法书写与音乐匹配度网页调研";
    this.elements.progressPanel.classList.add("hidden");
    this.elements.earlyExitButton.classList.add("hidden");

    const resumePanel = this.session?.status === "active"
      ? `
        <div class="resume-card">
          <div>
            <strong>检测到未完成的实验</strong>
            <span>已保存到第 ${Math.min(this.session.currentTaskIndex + 1, TASKS.length)} / ${TASKS.length} 题</span>
          </div>
          <div class="resume-actions">
            <button class="btn primary" id="resumeBtn">继续上次实验</button>
            <button class="btn outline" id="exportSavedBtn">结束并导出未完成数据</button>
          </div>
        </div>
      `
      : "";

    this.elements.screen.innerHTML = `
      <section class="welcome-card">
        <span class="welcome-kicker">匿名网页实验 · 共 3 部分 18 道题</span>
        <h2>请在安静环境中完成书法与音乐匹配实验</h2>
        <p class="welcome-lead">实验将依次进行笔画描摹、书法与音乐匹配选择、伴随音乐描摹。题目顺序固定，提交后不能返回修改。</p>
        <div class="instruction-grid">
          <article>
            <span>01</span>
            <h3>逐笔描摹</h3>
            <p>每完成一笔，至少选择一个、最多选择三个运动状态。</p>
          </article>
          <article>
            <span>02</span>
            <h3>完成试听</h3>
            <p>选择题需要完整听完规定音频，之后才能提交答案。</p>
          </article>
          <article>
            <span>03</span>
            <h3>保存结果</h3>
            <p>完成或提前结束时，请下载 CSV 文件并发送给研究人员。</p>
          </article>
        </div>
        ${resumePanel}
        <div class="welcome-actions">
          <button class="btn primary large" id="startExperimentBtn">开始新的实验</button>
        </div>
        <p class="privacy-note">本实验不采集姓名、年龄等个人信息，也不保存描摹轨迹。</p>
      </section>
    `;

    this.elements.screen.querySelector("#startExperimentBtn")
      .addEventListener("click", () => this.startNewSession());
    this.elements.screen.querySelector("#resumeBtn")
      ?.addEventListener("click", () => this.resumeSession());
    this.elements.screen.querySelector("#exportSavedBtn")
      ?.addEventListener("click", () => this.endEarly());
    this.updateSaveStatus("实验数据尚未开始");
  }

  startNewSession() {
    if (
      this.session?.status === "active"
      && !window.confirm("开始新实验会替换当前未完成进度，确定继续吗？")
    ) return;

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
        onStroke: (stroke) => {
          response.strokes.push(stroke);
          this.saveProgress();
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
    const overallQuestion = this.session.currentTaskIndex + 1;
    const sectionTasks = TASKS.filter((candidate) => candidate.sectionId === task.sectionId);
    this.elements.sectionBadge.textContent = `第 ${section.order} 部分`;
    this.elements.headerSubtitle.textContent = section.title;
    this.elements.progressPanel.classList.remove("hidden");
    this.elements.earlyExitButton.classList.remove("hidden");
    this.elements.progressText.textContent = `总进度 ${overallQuestion} / ${TASKS.length} · 本部分 ${task.questionOrder} / ${sectionTasks.length}`;
    this.elements.progressFill.style.width = `${((overallQuestion - 1) / TASKS.length) * 100}%`;
    this.elements.sectionSteps.innerHTML = SECTIONS.map((item) => {
      const state = item.order < section.order
        ? "done"
        : item.order === section.order
          ? "current"
          : "";
      return `<div class="section-step ${state}"><i></i><span>${item.shortTitle}</span></div>`;
    }).join("");
  }

  saveProgress() {
    this.store.save(this.session);
    this.updateSaveStatus("进度已自动保存在本机");
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

  endEarly() {
    if (!this.session || this.session.status !== "active") return;
    const confirmed = window.confirm("确定提前结束吗？系统会下载当前未完成数据，之后不能继续本次实验。");
    if (!confirmed) return;

    this.destroyActiveTask();
    this.session.status = "incomplete";
    this.session.endedAt = new Date().toISOString();
    this.store.save(this.session);
    downloadCsv(this.session, TASKS);
    this.renderFinished("incomplete");
  }

  renderFinished(status) {
    this.destroyActiveTask();
    this.elements.progressPanel.classList.add("hidden");
    this.elements.earlyExitButton.classList.add("hidden");
    this.elements.sectionBadge.textContent = status === "completed" ? "实验完成" : "实验已结束";
    this.elements.headerSubtitle.textContent = "请保存并发送实验数据";

    const strokeCount = Object.values(this.session.responses)
      .reduce((total, response) => total + (response.strokes?.length || 0), 0);
    const choiceCount = Object.values(this.session.responses)
      .filter((response) => response.selectedOption).length;
    const title = status === "completed" ? "感谢完成全部实验" : "未完成数据已经保留";
    const description = status === "completed"
      ? "请下载 CSV 文件，并按照研究人员提供的方式发送。"
      : "你仍然可以再次下载当前的不完整 CSV 文件并发送给研究人员。";

    this.elements.screen.innerHTML = `
      <section class="finish-card">
        <div class="finish-icon">✓</div>
        <span class="welcome-kicker">${status === "completed" ? "COMPLETED" : "INCOMPLETE"}</span>
        <h2>${title}</h2>
        <p>${description}</p>
        <div class="result-summary">
          <div><strong>${strokeCount}</strong><span>已记录笔画</span></div>
          <div><strong>${choiceCount}</strong><span>已完成选择题</span></div>
          <div><strong>${this.session.currentTaskIndex}</strong><span>已推进题目</span></div>
        </div>
        <div class="finish-actions">
          <button class="btn primary large" id="downloadCsvBtn">下载 CSV 数据</button>
          <button class="btn outline" id="newSessionBtn">开始新的实验</button>
        </div>
        <p class="privacy-note">下载完成后，请确认文件已保存在设备中。</p>
      </section>
    `;
    this.elements.screen.querySelector("#downloadCsvBtn")
      .addEventListener("click", () => downloadCsv(this.session, TASKS));
    this.elements.screen.querySelector("#newSessionBtn")
      .addEventListener("click", () => {
        this.store.clear();
        this.session = null;
        this.renderWelcome();
      });
    this.updateSaveStatus(status === "completed" ? "实验已完成" : "实验以未完成状态结束");
  }

  updateSaveStatus(text) {
    this.elements.saveStatus.textContent = text;
  }

  destroyActiveTask() {
    this.activeTaskController?.destroy();
    this.activeTaskController = null;
  }
}
