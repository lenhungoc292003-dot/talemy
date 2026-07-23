(() => {
  "use strict";

  const API = "https://talemy-secure-api-gateway.pages.dev";
  const STORAGE_KEY = "talemy-assessment-v2";
  const DATA = window.TALEMY_ASSESSMENT;
  const app = document.getElementById("app");
  const CONNECTION_ERROR = "Chưa thể kết nối với hệ thống Talemy. Vui lòng đợi vài giây rồi thử lại.";
  const emptyTask = () => ({
    initialPrompt: "",
    promptLocked: false,
    messages: [],
    followup: "",
    finalOutput: "",
    startedAt: null,
    completedAt: null,
    scores: null
  });
  const freshState = () => ({
    version: DATA.version,
    stage: "landing",
    profile: { name: "", email: "", code: "", role: "" },
    attemptId: null,
    startedAt: null,
    expiresAt: null,
    round1: null,
    round1FrameHeight: 780,
    delegation: {
      humanAnswers: Array(DATA.delegation.questions.length).fill(null),
      humanIndex: 0,
      humanQuestionStartedAt: null,
      teamAnswers: Array(DATA.delegation.questions.length).fill(null),
      teamIndex: 0,
      asked: [],
      completedAt: null
    },
    description: {
      activeTask: "travel",
      travel: emptyTask(),
      research: emptyTask()
    },
    results: null,
    saveStatus: "",
    error: ""
  });

  let state = loadState();
  let busy = false;
  let ticker = null;

  function loadState() {
    try {
      const parsed = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
      if (parsed?.version === DATA.version) return parsed;
    } catch {}
    return freshState();
  }

  function persist() {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function resetState() {
    state = freshState();
    sessionStorage.removeItem(STORAGE_KEY);
    render();
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
  }

  function fmt(seconds) {
    const value = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(value % 60).padStart(2, "0")}`;
  }

  function nowSeconds() {
    if (!state.startedAt) return 0;
    return Math.max(0, Math.floor((Date.now() - new Date(state.startedAt).getTime()) / 1000));
  }

  function remainingGlobal() {
    if (!state.expiresAt) return 3600;
    return Math.max(0, Math.ceil((new Date(state.expiresAt).getTime() - Date.now()) / 1000));
  }

  function shell(content, progress = 0, label = "AI Skill Assessment") {
    return `
      <div class="shell">
        <header class="topbar">
          <a class="brand" href="./" aria-label="Talemy"><strong>talemy.</strong><span>${esc(label)}</span></a>
          <nav class="nav"><a href="./reviewer/">Dành cho người chấm ↗</a></nav>
          ${state.stage === "landing" ? "" : `<div class="timer"><span>Thời gian toàn bài</span><strong id="globalTimer">${fmt(remainingGlobal())}</strong></div>`}
        </header>
        ${progress ? `<div class="progress"><span style="width:${progress}%"></span></div>` : ""}
        ${content}
      </div>`;
  }

  async function apiFetch(path, init) {
    let response;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try { response = await fetch(`${API}${path}`, init); }
      catch { throw new Error(CONNECTION_ERROR); }
      if (response.status !== 522 || attempt === 1) break;
      await new Promise((resolve) => setTimeout(resolve, 800));
    }
    if (!response) throw new Error(CONNECTION_ERROR);
    return response;
  }

  async function apiJson(path, init) {
    const response = await apiFetch(path, init);
    const data = (response.headers.get("content-type") || "").includes("application/json")
      ? await response.json().catch(() => null)
      : null;
    if (!response.ok || !data) throw new Error(data?.error || CONNECTION_ERROR);
    return data;
  }

  function combinedTranscript() {
    return DATA.description.tasks.flatMap((task) => {
      const taskState = state.description[task.id];
      return taskState.messages.map((message) => ({ ...message, taskId: task.id }));
    });
  }

  function compactTask(taskId) {
    const task = state.description[taskId];
    return {
      version: DATA.version,
      taskId,
      initialPrompt: task.initialPrompt,
      firstAiOutput: task.messages.find((message) => message.role === "assistant")?.content || "",
      messages: task.messages,
      finalOutput: task.finalOutput,
      startedAt: task.startedAt,
      completedAt: task.completedAt,
      scores: task.scores
    };
  }

  async function saveAttempt(extra = {}) {
    if (!state.attemptId) return;
    state.saveStatus = "saving";
    updateSaveStatus();
    const payload = {
      attemptId: state.attemptId,
      delegationPlan: JSON.stringify({
        version: DATA.version,
        humanAnswers: state.delegation.humanAnswers,
        teamAnswers: state.delegation.teamAnswers,
        asked: state.delegation.asked,
        results: state.results?.delegation || null
      }),
      keyFindings: JSON.stringify(compactTask("travel")),
      recommendation: JSON.stringify(compactTask("research")),
      risks: JSON.stringify(state.results || { version: "round2-v2-results" }),
      executiveSummary: state.results?.summary || "",
      verificationNotes: JSON.stringify({
        version: DATA.version,
        methodology: "Delegation uses objective answers and a fixed AI benchmark. Description uses the six-point initial-prompt rubric and ten-point final-output rubric from the supplied specifications."
      }),
      chatTranscript: combinedTranscript(),
      timeSpentSeconds: nowSeconds(),
      ...extra
    };
    try {
      await apiJson("/api/attempts", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
        keepalive: true
      });
      state.saveStatus = "saved";
    } catch (error) {
      state.saveStatus = "error";
      state.error = error.message;
    }
    persist();
    updateSaveStatus();
  }

  function updateSaveStatus() {
    const element = document.getElementById("saveStatus");
    if (!element) return;
    element.className = `status ${state.saveStatus}`;
    element.textContent = state.saveStatus === "saving"
      ? "Đang lưu…"
      : state.saveStatus === "saved"
        ? "✓ Đã lưu vào database"
        : state.saveStatus === "error"
          ? "Lỗi lưu dữ liệu"
          : "";
  }

  function startTicker() {
    clearInterval(ticker);
    if (state.stage === "landing" || state.stage === "results") return;
    ticker = setInterval(() => {
      const global = document.getElementById("globalTimer");
      if (global) global.textContent = fmt(remainingGlobal());
      if (remainingGlobal() <= 0) {
        clearInterval(ticker);
        finishAssessment(true);
        return;
      }
      if (state.stage === "delegationHuman") tickHumanQuestion();
      if (state.stage === "descriptionTask") tickDescriptionTask();
    }, 500);
  }

  function render() {
    clearInterval(ticker);
    state.error = state.error || "";
    const views = {
      landing: renderLanding,
      round1: renderRound1,
      delegationIntro: renderDelegationIntro,
      delegationHuman: renderDelegationHuman,
      delegationTransition: renderDelegationTransition,
      delegationTeam: renderDelegationTeam,
      descriptionIntro: renderDescriptionIntro,
      descriptionTask: renderDescriptionTask,
      results: renderResults
    };
    (views[state.stage] || renderLanding)();
    persist();
    startTicker();
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function renderLanding() {
    app.innerHTML = shell(`
      <section class="hero">
        <div>
          <p class="eyebrow orange">TALEMY · AI APPLICATION ASSESSMENT</p>
          <h1>Hiểu AI là bước đầu.<br><span>Biết phân vai và mô tả đúng mới tạo ra kết quả tốt.</span></h1>
          <p class="lead">Bài đánh giá hai vòng đo nền tảng AI literacy, khả năng chọn đúng lúc cần AI và chất lượng cấu trúc prompt qua các tình huống thực tế.</p>
          <div class="facts">
            <div><strong>60</strong><span>phút toàn bài</span></div>
            <div><strong>20 × 2</strong><span>lượt quyết định Delegation</span></div>
            <div><strong>02</strong><span>task Description</span></div>
          </div>
        </div>
        <aside class="card">
          <p class="eyebrow orange">BẮT ĐẦU BÀI ĐÁNH GIÁ</p>
          <h2>Thông tin ứng viên</h2>
          <p>Đồng hồ 60 phút bắt đầu khi bạn nhấn nút bên dưới.</p>
          <label class="field">Họ và tên *<input id="candidateName" autocomplete="name" placeholder="Nguyễn Minh Anh" value="${esc(state.profile.name)}"></label>
          <div class="field-row">
            <label class="field">Email<input id="candidateEmail" type="email" autocomplete="email" placeholder="email@company.com" value="${esc(state.profile.email)}"></label>
            <label class="field">Mã ứng viên<input id="candidateCode" placeholder="TL-2401" value="${esc(state.profile.code)}"></label>
          </div>
          <label class="field">Nhóm vai trò *
            <select id="candidateRole">
              ${["", "HR / Recruitment", "Sales / Business Development", "Marketing", "Operations / Customer Service", "Finance / Admin", "Other knowledge work"].map((role) => `<option ${state.profile.role === role ? "selected" : ""} value="${esc(role)}">${role || "Chọn nhóm vai trò"}</option>`).join("")}
            </select>
          </label>
          ${state.error ? `<p class="error" role="alert">${esc(state.error)}</p>` : ""}
          <button id="startAssessment" class="button primary full" ${busy ? "disabled" : ""}>${busy ? "Đang tạo bài làm…" : "Bắt đầu Round 1 · 60:00 →"}</button>
        </aside>
      </section>
      <section class="journey" id="journey">
        <article>
          <p class="eyebrow">ROUND 1 · AI LITERACY</p>
          <h2>Nền tảng hiểu và sử dụng AI</h2>
          <p>Giữ nguyên 36 câu hỏi hiện tại. Từ Advanced Beginner sẽ mở Round 2.</p>
          <div class="chips"><span class="chip">~20 phút</span><span class="chip">36 câu</span></div>
        </article>
        <div class="journey-arrow">→</div>
        <article class="accent">
          <p class="eyebrow orange">ROUND 2 · HUMAN–AI COLLABORATION</p>
          <h2>Delegation + Description</h2>
          <p>So sánh hiệu suất tự làm và làm cùng AI, sau đó thực hiện hai task viết prompt có chatbox hỗ trợ.</p>
          <div class="chips"><span class="chip">20 câu × 2</span><span class="chip">2 task mở</span></div>
        </article>
      </section>
    `);
    document.getElementById("startAssessment").addEventListener("click", startAssessment);
  }

  async function startAssessment() {
    if (busy) return;
    const profile = {
      name: document.getElementById("candidateName").value.trim(),
      email: document.getElementById("candidateEmail").value.trim(),
      code: document.getElementById("candidateCode").value.trim(),
      role: document.getElementById("candidateRole").value
    };
    state.profile = profile;
    if (!profile.name || !profile.role) {
      state.error = "Vui lòng nhập họ tên và chọn nhóm vai trò.";
      render();
      return;
    }
    busy = true;
    state.error = "";
    renderLanding();
    try {
      const data = await apiJson("/api/attempts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          candidateName: profile.name,
          candidateEmail: profile.email,
          candidateCode: profile.code,
          role: profile.role
        })
      });
      if (!data.attemptId || !data.startedAt || !data.expiresAt) throw new Error(CONNECTION_ERROR);
      state.attemptId = data.attemptId;
      state.startedAt = data.startedAt;
      state.expiresAt = data.expiresAt;
      state.stage = "round1";
      persist();
      render();
    } catch (error) {
      state.error = error.message;
      busy = false;
      render();
    } finally {
      busy = false;
    }
  }

  function renderRound1() {
    const complete = Boolean(state.round1);
    const unlocked = Number(state.round1?.band?.num || 0) >= 2;
    app.innerHTML = shell(`
      <section class="page-head">
        <p class="eyebrow orange">ROUND 1 / 2 · AI LITERACY</p>
        <h1>Nền tảng hiểu và sử dụng AI</h1>
        <p>Hoàn thành 36 câu hỏi. Đồng hồ 60 phút áp dụng cho toàn bộ bài đánh giá.</p>
      </section>
      <div class="round1-frame"><iframe id="round1Frame" src="./round1.html" title="Talemy AI Skill Test Round 1" style="height:${Number(state.round1FrameHeight) || 780}px"></iframe></div>
      ${complete ? `
        <section class="unlock ${unlocked ? "" : "locked"}">
          <div class="unlock-icon">${unlocked ? "✓" : "↺"}</div>
          <div>
            <p class="eyebrow">${unlocked ? "ROUND 2 ĐÃ MỞ" : "CHƯA MỞ ROUND 2"}</p>
            <h2>${esc(state.round1.band?.name)} · ${state.round1.score}/${state.round1.total} câu đúng</h2>
            <p>${unlocked ? "Bạn đã đạt ngưỡng Advanced Beginner và có thể tiếp tục." : "Round 2 yêu cầu tối thiểu Advanced Beginner. Kết quả đã được lưu cho người chấm."}</p>
          </div>
          ${unlocked ? `<button id="continueRound2" class="button primary">Tiếp tục Round 2 →</button>` : `<button id="retryRound1" class="button secondary">Làm lại Round 1</button>`}
        </section>` : ""}
      <p id="saveStatus" class="status ${state.saveStatus}"></p>
    `, 18, "Round 1 · AI Literacy");
    if (complete && unlocked) document.getElementById("continueRound2").addEventListener("click", () => {
      state.stage = "delegationIntro";
      saveAttempt({ currentStage: "delegation_intro" });
      render();
    });
    if (complete && !unlocked) document.getElementById("retryRound1").addEventListener("click", () => {
      state.round1 = null;
      const frame = document.getElementById("round1Frame");
      frame.src = `./round1.html?retry=${Date.now()}`;
      render();
    });
    updateSaveStatus();
  }

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === "talemy-round1-height") {
      state.round1FrameHeight = Math.min(2200, Math.max(700, Number(event.data.height) || 780));
      const frame = document.getElementById("round1Frame");
      if (frame) frame.style.height = `${state.round1FrameHeight}px`;
    }
    if (event.data?.type === "talemy-round1-result") {
      state.round1 = event.data.result;
      saveAttempt({ round1Result: state.round1, currentStage: "round1_completed" });
      render();
    }
  });

  function renderDelegationIntro() {
    app.innerHTML = shell(`
      <section class="page-head">
        <p class="eyebrow orange">ROUND 2 · DELEGATION</p>
        <h1>Hai lượt làm bài để đo <span>cách bạn phân vai với AI</span></h1>
        <p>Phần 1 đo năng lực tự thân. Phần 2 đo khả năng phối hợp với AI. So sánh hai phần cho biết AI có thực sự giúp bạn làm tốt hơn hay không.</p>
      </section>
      <section class="intro-grid">
        <article><span>01 · HUMAN ALONE</span><h2>Tự làm 20 câu</h2><p>Mỗi câu có 20 giây. Không có AI hỗ trợ để tạo baseline năng lực tự thân sạch và đầy đủ.</p></article>
        <article><span>02 · TEAM PERFORMANCE</span><h2>Làm lại cùng AI</h2><p>Bạn được hỏi AI tối đa 7 lần. AI có thể đúng hoặc sai; bạn vẫn là người chốt đáp án.</p></article>
      </section>
      <div class="callout"><strong>Điểm quan trọng</strong><p>Không cần dùng hết 7 lượt. Hãy hỏi AI khi bạn tin rằng sự hỗ trợ đó có thể tạo ra giá trị.</p></div>
      <div class="center-action"><button id="startHuman" class="button primary">Bắt đầu Human-alone →</button></div>
    `, 30, "Round 2 · Delegation");
    document.getElementById("startHuman").addEventListener("click", () => {
      state.delegation.humanQuestionStartedAt = new Date().toISOString();
      state.stage = "delegationHuman";
      saveAttempt({ currentStage: "delegation_human" });
      render();
    });
  }

  function humanSecondsLeft() {
    const started = new Date(state.delegation.humanQuestionStartedAt || Date.now()).getTime();
    return Math.max(0, DATA.delegation.humanSecondsPerQuestion - Math.floor((Date.now() - started) / 1000));
  }

  function tickHumanQuestion() {
    const element = document.getElementById("questionTimer");
    if (element) element.textContent = String(humanSecondsLeft());
    if (humanSecondsLeft() <= 0) advanceHuman();
  }

  function renderDelegationHuman() {
    const index = state.delegation.humanIndex;
    const question = DATA.delegation.questions[index];
    app.innerHTML = shell(`
      <section class="page-head">
        <p class="eyebrow orange">DELEGATION · PHẦN 1 / 2</p>
        <h1>Human alone</h1>
        <p>Chọn Đúng hoặc Sai theo phán đoán của bạn. Câu chưa trả lời khi hết 20 giây được tính là bỏ qua.</p>
      </section>
      <section class="question-layout">
        <article class="question-card">
          <div class="question-kicker"><span>Câu ${index + 1} / ${DATA.delegation.questions.length}</span><strong>Không có AI hỗ trợ</strong></div>
          <p class="statement">${esc(question.statement)}</p>
          <h1>${esc(question.conclusion)}</h1>
          <p class="conclusion">Kết luận trên là:</p>
          <div class="answer-grid">
            <button class="answer ${state.delegation.humanAnswers[index] === true ? "selected" : ""}" data-answer="true">ĐÚNG</button>
            <button class="answer ${state.delegation.humanAnswers[index] === false ? "selected" : ""}" data-answer="false">SAI</button>
          </div>
          <div class="question-actions"><span></span><button id="nextHuman" class="button primary" ${state.delegation.humanAnswers[index] === null ? "disabled" : ""}>${index === DATA.delegation.questions.length - 1 ? "Hoàn thành Phần 1" : "Câu tiếp theo →"}</button></div>
        </article>
        <aside class="side-panel">
          <p class="eyebrow">THỜI GIAN MỖI CÂU</p>
          <div class="countdown"><strong id="questionTimer">${humanSecondsLeft()}</strong><span>giây còn lại</span></div>
          <h3>Phản xạ có căn cứ</h3>
          <p>Đọc dữ kiện, kiểm tra quan hệ logic và chọn đáp án tốt nhất trong thời gian cho phép.</p>
        </aside>
      </section>
    `, 34 + (index / DATA.delegation.questions.length) * 12, "Delegation · Human alone");
    app.querySelectorAll("[data-answer]").forEach((button) => button.addEventListener("click", () => {
      state.delegation.humanAnswers[index] = button.dataset.answer === "true";
      persist();
      renderDelegationHuman();
    }));
    document.getElementById("nextHuman").addEventListener("click", advanceHuman);
  }

  function advanceHuman() {
    if (state.stage !== "delegationHuman") return;
    if (state.delegation.humanIndex < DATA.delegation.questions.length - 1) {
      state.delegation.humanIndex += 1;
      state.delegation.humanQuestionStartedAt = new Date().toISOString();
      persist();
      renderDelegationHuman();
      return;
    }
    state.stage = "delegationTransition";
    saveAttempt({ currentStage: "delegation_transition" });
    render();
  }

  function renderDelegationTransition() {
    app.innerHTML = shell(`
      <section class="page-head">
        <p class="eyebrow orange">DELEGATION · CHUYỂN TIẾP</p>
        <h1>Baseline tự thân đã hoàn tất</h1>
        <p>Bây giờ bạn sẽ làm lại đúng 20 câu. Mỗi câu có nút “Hỏi AI”; bạn có tối đa 7 lượt cho toàn phần.</p>
      </section>
      <section class="intro-grid">
        <article><span>AI KHÔNG LUÔN ĐÚNG</span><h2>Đọc và phản biện gợi ý</h2><p>Gợi ý được lấy từ benchmark cố định. Một số gợi ý có chủ đích phản ánh lỗi thực tế của AI.</p></article>
        <article><span>BẠN CHỐT ĐÁP ÁN</span><h2>Không tự động điền theo AI</h2><p>Sau khi xem gợi ý, bạn vẫn chọn Đúng hoặc Sai bằng phán đoán cuối cùng của mình.</p></article>
      </section>
      <div class="center-action"><button id="startTeam" class="button primary">Bắt đầu Team performance →</button></div>
    `, 48, "Delegation · Chuyển tiếp");
    document.getElementById("startTeam").addEventListener("click", () => {
      state.stage = "delegationTeam";
      saveAttempt({ currentStage: "delegation_team" });
      render();
    });
  }

  function renderDelegationTeam() {
    const index = state.delegation.teamIndex;
    const question = DATA.delegation.questions[index];
    const asked = state.delegation.asked.includes(index);
    const remaining = DATA.delegation.maxAiRequests - state.delegation.asked.length;
    app.innerHTML = shell(`
      <section class="page-head">
        <p class="eyebrow orange">DELEGATION · PHẦN 2 / 2</p>
        <h1>Team performance</h1>
        <p>Chọn câu cần AI hỗ trợ một cách có chủ đích. Bạn có thể giữ hoặc bác bỏ gợi ý.</p>
      </section>
      <section class="question-layout">
        <article class="question-card">
          <div class="question-kicker"><span>Câu ${index + 1} / ${DATA.delegation.questions.length}</span><strong>${remaining}/7 lượt AI còn lại</strong></div>
          <p class="statement">${esc(question.statement)}</p>
          <h1>${esc(question.conclusion)}</h1>
          ${asked ? `<div class="ai-hint"><strong>Gợi ý từ AI benchmark</strong><p>${esc(question.aiHint)}</p></div>` : ""}
          <p class="conclusion">Kết luận cuối cùng của bạn:</p>
          <div class="answer-grid">
            <button class="answer ${state.delegation.teamAnswers[index] === true ? "selected" : ""}" data-team-answer="true">ĐÚNG</button>
            <button class="answer ${state.delegation.teamAnswers[index] === false ? "selected" : ""}" data-team-answer="false">SAI</button>
          </div>
          <div class="question-actions">
            <button id="askDelegationAi" class="button secondary" ${asked || remaining <= 0 ? "disabled" : ""}>${asked ? "✓ Đã hỏi AI" : remaining > 0 ? "Hỏi AI cho câu này" : "Đã dùng hết 7 lượt"}</button>
            <button id="nextTeam" class="button primary" ${state.delegation.teamAnswers[index] === null ? "disabled" : ""}>${index === DATA.delegation.questions.length - 1 ? "Hoàn thành Delegation" : "Câu tiếp theo →"}</button>
          </div>
        </article>
        <aside class="side-panel">
          <p class="eyebrow">QUYỀN HỎI AI</p>
          <div class="countdown"><strong>${state.delegation.asked.length}/7</strong><span>lượt đã dùng</span></div>
          <h3>Chọn lọc quan trọng hơn số lượng</h3>
          <p>Dùng hết lượt không tự động tốt hay xấu. Kết quả sẽ đối chiếu câu bạn hỏi với vùng AI benchmark làm tốt.</p>
        </aside>
      </section>
    `, 49 + (index / DATA.delegation.questions.length) * 15, "Delegation · Team performance");
    app.querySelectorAll("[data-team-answer]").forEach((button) => button.addEventListener("click", () => {
      state.delegation.teamAnswers[index] = button.dataset.teamAnswer === "true";
      persist();
      renderDelegationTeam();
    }));
    document.getElementById("askDelegationAi").addEventListener("click", () => {
      if (!state.delegation.asked.includes(index) && state.delegation.asked.length < DATA.delegation.maxAiRequests) {
        state.delegation.asked.push(index);
        persist();
        renderDelegationTeam();
      }
    });
    document.getElementById("nextTeam").addEventListener("click", () => {
      if (index < DATA.delegation.questions.length - 1) {
        state.delegation.teamIndex += 1;
        persist();
        renderDelegationTeam();
      } else {
        state.delegation.completedAt = new Date().toISOString();
        state.stage = "descriptionIntro";
        saveAttempt({ currentStage: "description_intro" });
        render();
      }
    });
  }

  function renderDescriptionIntro() {
    app.innerHTML = shell(`
      <section class="page-head">
        <p class="eyebrow orange">ROUND 2 · DESCRIPTION</p>
        <h1>Structured Prompt Quality qua <span>hai tình huống</span></h1>
        <p>Mỗi task chấm riêng Initial Prompt 0–6 và Final Output 0–10. Bạn có thể trao đổi tự do với chatbox trong thời gian của task.</p>
      </section>
      <section class="intro-grid">
        <article><span>TASK A · TRAVEL PLANNING</span><h2>Lịch trình Nhật Bản 4 ngày</h2><p>Đặt bối cảnh, ưu tiên và giới hạn đủ rõ để AI tạo lịch trình thực tế, có thể sử dụng.</p></article>
        <article><span>TASK B · RESEARCH PLANNING</span><h2>Đề xuất nghiên cứu đại học</h2><p>Mô tả mục tiêu, câu hỏi, phương pháp, timeline và đầu ra cho đề tài Generative AI.</p></article>
      </section>
      <div class="callout"><strong>Cách chấm</strong><p>Chỉ Initial Prompt đầu tiên được chấm cấu trúc. Các lượt sau giúp bạn cải thiện đầu ra; bạn chọn một Final Output để nộp.</p></div>
      <div class="center-action"><button id="startDescription" class="button primary">Bắt đầu Task A →</button></div>
    `, 65, "Round 2 · Description");
    document.getElementById("startDescription").addEventListener("click", () => {
      state.description.activeTask = "travel";
      state.description.travel.startedAt ||= new Date().toISOString();
      state.stage = "descriptionTask";
      saveAttempt({ currentStage: "description_travel" });
      render();
    });
  }

  function activeTaskConfig() {
    return DATA.description.tasks.find((task) => task.id === state.description.activeTask);
  }

  function descriptionSecondsLeft(taskState) {
    if (!taskState.startedAt) return DATA.description.taskSeconds;
    return Math.max(0, DATA.description.taskSeconds - Math.floor((Date.now() - new Date(taskState.startedAt).getTime()) / 1000));
  }

  function tickDescriptionTask() {
    const taskState = state.description[state.description.activeTask];
    const timer = document.getElementById("taskTimer");
    if (timer) timer.textContent = fmt(descriptionSecondsLeft(taskState));
  }

  function renderDescriptionTask() {
    const config = activeTaskConfig();
    const taskState = state.description[config.id];
    const isTravel = config.id === "travel";
    const latestAi = [...taskState.messages].reverse().find((message) => message.role === "assistant");
    app.innerHTML = shell(`
      <section class="page-head">
        <p class="eyebrow orange">DESCRIPTION · ${esc(config.label)}</p>
        <h1>${isTravel ? "Tạo đầu ra hữu ích từ một prompt có cấu trúc" : "Mô tả một nhiệm vụ nghiên cứu đủ rõ cho AI"}</h1>
        <p>Thời gian gợi ý 8 phút. Initial Prompt được khóa sau khi gửi lần đầu.</p>
      </section>
      <section class="task-shell">
        <article class="task-card">
          <div class="question-kicker"><span>${esc(config.label)}</span><strong id="taskTimer">${fmt(descriptionSecondsLeft(taskState))}</strong></div>
          <p class="scenario">${esc(config.scenario)}</p>
          <div class="task-brief"><strong>NHIỆM VỤ</strong><p>${esc(config.task)}</p><ul>${config.choices.map((choice) => `<li>${esc(choice)}</li>`).join("")}</ul></div>
          ${!taskState.promptLocked ? `
            <label class="field">Initial Prompt
              <textarea id="initialPrompt" rows="9" placeholder="Viết prompt đầu tiên bạn sẽ gửi cho AI…">${esc(taskState.initialPrompt)}</textarea>
            </label>
            <p class="status">Prompt này được chấm 6 tiêu chí và không thể sửa sau khi gửi.</p>
            ${state.error ? `<p class="error" role="alert">${esc(state.error)}</p>` : ""}
            <button id="sendInitialPrompt" class="button primary full" ${busy ? "disabled" : ""}>${busy ? "AI đang phản hồi…" : "Gửi Initial Prompt →"}</button>
          ` : `
            <div class="prompt-lock"><strong>INITIAL PROMPT ĐÃ KHÓA</strong><pre>${esc(taskState.initialPrompt)}</pre></div>
            <label class="field final-output">Final AI Output
              <textarea id="finalOutput" placeholder="Chọn hoặc chỉnh lý một đầu ra cuối cùng để nộp…">${esc(taskState.finalOutput)}</textarea>
            </label>
            <div class="mini-actions"><button id="useLatestOutput" class="button ghost" ${latestAi ? "" : "disabled"}>Dùng phản hồi AI gần nhất</button></div>
            ${state.error ? `<p class="error" role="alert">${esc(state.error)}</p>` : ""}
            <div class="question-actions"><span id="saveStatus" class="status ${state.saveStatus}"></span><button id="submitDescriptionTask" class="button primary">${isTravel ? "Nộp Task A & sang Task B →" : "Nộp Task B & xem kết quả →"}</button></div>
          `}
        </article>
        <aside class="chat">
          <div class="chat-head"><div class="ai-avatar">AI</div><div><strong>Talemy AI</strong><span>Trao đổi tự do trong thời gian task</span></div></div>
          ${taskState.promptLocked ? `
            <div id="messages" class="messages">
              ${taskState.messages.map((message) => `<div class="message ${message.role === "user" ? "user" : "assistant"}"><span>${message.role === "user" ? "Bạn" : "Talemy AI"}</span><p>${esc(message.content)}</p></div>`).join("")}
            </div>
            <div class="chat-compose">
              <textarea id="followup" placeholder="Yêu cầu AI bổ sung, sửa hoặc làm rõ…">${esc(taskState.followup)}</textarea>
              <button id="sendFollowup" class="button primary" ${busy ? "disabled" : ""}>${busy ? "Đang gửi…" : "Gửi cho AI"}</button>
            </div>
          ` : `<div class="chat-empty">Gửi Initial Prompt để mở chatbox.</div>`}
        </aside>
      </section>
    `, isTravel ? 72 : 84, `Description · ${config.label}`);
    if (!taskState.promptLocked) {
      document.getElementById("initialPrompt").addEventListener("input", (event) => {
        taskState.initialPrompt = event.target.value;
        persist();
      });
      document.getElementById("sendInitialPrompt").addEventListener("click", sendInitialPrompt);
    } else {
      document.getElementById("finalOutput").addEventListener("input", (event) => {
        taskState.finalOutput = event.target.value;
        persist();
      });
      document.getElementById("followup").addEventListener("input", (event) => {
        taskState.followup = event.target.value;
        persist();
      });
      document.getElementById("sendFollowup").addEventListener("click", sendFollowup);
      document.getElementById("useLatestOutput").addEventListener("click", () => {
        if (latestAi) {
          taskState.finalOutput = latestAi.content;
          persist();
          renderDescriptionTask();
        }
      });
      document.getElementById("submitDescriptionTask").addEventListener("click", submitDescriptionTask);
      const messages = document.getElementById("messages");
      if (messages) messages.scrollTop = messages.scrollHeight;
      updateSaveStatus();
    }
  }

  async function requestAi(config, taskState) {
    const messages = [
      { role: "user", content: `[Bối cảnh nhiệm vụ]\n${config.aiContext}\n\n[Prompt của ứng viên]\n${taskState.initialPrompt}` },
      ...taskState.messages.slice(1).map(({ role, content }) => ({ role, content }))
    ];
    const data = await apiJson("/api/ai/chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ attemptId: state.attemptId, messages })
    });
    if (!data.message) throw new Error(data.error || "AI chưa thể phản hồi.");
    return data.message;
  }

  async function sendInitialPrompt() {
    const config = activeTaskConfig();
    const taskState = state.description[config.id];
    taskState.initialPrompt = document.getElementById("initialPrompt").value.trim();
    if (taskState.initialPrompt.length < 30) {
      state.error = "Initial Prompt cần đủ chi tiết để thể hiện cách bạn mô tả nhiệm vụ.";
      renderDescriptionTask();
      return;
    }
    busy = true;
    state.error = "";
    renderDescriptionTask();
    const userMessage = { id: crypto.randomUUID(), role: "user", content: taskState.initialPrompt, createdAt: new Date().toISOString() };
    taskState.messages = [userMessage];
    try {
      const message = await requestAi(config, taskState);
      taskState.messages.push({ id: crypto.randomUUID(), role: "assistant", content: message, createdAt: new Date().toISOString() });
      taskState.promptLocked = true;
      taskState.finalOutput = message;
      await saveAttempt({ currentStage: `description_${config.id}_chat` });
    } catch (error) {
      taskState.messages = [];
      state.error = error.message;
    } finally {
      busy = false;
      persist();
      renderDescriptionTask();
    }
  }

  async function sendFollowup() {
    const config = activeTaskConfig();
    const taskState = state.description[config.id];
    const content = document.getElementById("followup").value.trim();
    if (!content || busy) return;
    taskState.messages.push({ id: crypto.randomUUID(), role: "user", content, createdAt: new Date().toISOString() });
    taskState.followup = "";
    busy = true;
    state.error = "";
    renderDescriptionTask();
    try {
      const message = await requestAi(config, taskState);
      taskState.messages.push({ id: crypto.randomUUID(), role: "assistant", content: message, createdAt: new Date().toISOString() });
      taskState.finalOutput = message;
      await saveAttempt({ currentStage: `description_${config.id}_chat` });
    } catch (error) {
      state.error = error.message;
    } finally {
      busy = false;
      persist();
      renderDescriptionTask();
    }
  }

  function submitDescriptionTask() {
    const config = activeTaskConfig();
    const taskState = state.description[config.id];
    taskState.finalOutput = document.getElementById("finalOutput").value.trim();
    if (taskState.finalOutput.length < 120) {
      state.error = "Final Output cần đủ nội dung để chấm theo rubric 0–10.";
      renderDescriptionTask();
      return;
    }
    taskState.scores = scoreDescription(config, taskState);
    taskState.completedAt = new Date().toISOString();
    state.error = "";
    if (config.id === "travel") {
      state.description.activeTask = "research";
      state.description.research.startedAt ||= new Date().toISOString();
      saveAttempt({ currentStage: "description_research" });
      render();
    } else {
      finishAssessment(false);
    }
  }

  function scoreDescription(config, taskState) {
    const prompt = taskState.initialPrompt;
    const criterionNames = {
      verb: "Verb",
      focus: "Focus",
      context: "Context",
      condition: "Focus & Condition",
      alignment: "Alignment",
      constraints: "Constraints & Limitations"
    };
    const promptCriteria = Object.entries(config.promptPatterns).map(([key, pattern]) => {
      const earned = pattern.test(prompt) ? 1 : 0;
      return {
        criterion: criterionNames[key],
        earned,
        max: 1,
        reason: earned
          ? `Prompt có tín hiệu rõ cho tiêu chí ${criterionNames[key]}.`
          : `Prompt chưa thể hiện đủ rõ tiêu chí ${criterionNames[key]}.`,
        evidence: earned ? evidenceSnippet(prompt, pattern) : ""
      };
    });
    const output = taskState.finalOutput;
    const lines = output.split(/\n+/).filter((line) => line.trim());
    const isTravel = config.id === "travel";
    const outputChecks = isTravel
      ? [
          ["Deliverable", /\b(day|ngày)\s*[1-4]\b/i, "Có cấu trúc lịch trình theo ngày"],
          ["Coverage", /\b(chỗ ở|khách sạn|hotel|accommodation)\b/i, "Chỗ ở", /\b(phương tiện|tàu|bus|transport)\b/i, "Di chuyển", /\b(ẩm thực|món|food)\b/i, "Ẩm thực"],
          ["Practicality", /\b(¥|jpy|yen|chi phí|ngân sách|budget|phút|giờ|km)\b/i, "Có chi phí, thời lượng hoặc dữ kiện thực thi"],
          ["Organization", null, "Đầu ra có cấu trúc dễ đọc"],
          ["Decision usefulness", /\b(tổng chi phí|total cost|lưu ý|tips|đặt trước|nên|recommend)\b/i, "Có tổng hợp hoặc lời khuyên hành động"]
        ]
      : [
          ["Deliverable", /\b(đề xuất nghiên cứu|research proposal|kế hoạch nghiên cứu)\b/i, "Đúng loại đầu ra nghiên cứu"],
          ["Coverage", /\b(câu hỏi nghiên cứu|research question)\b/i, "Câu hỏi nghiên cứu", /\b(phương pháp|methodology|method)\b/i, "Phương pháp", /\b(timeline|thời gian)\b/i, "Timeline"],
          ["Practicality", /\b(mẫu|sample|người tham gia|participants|thu thập dữ liệu|data collection|tuần|tháng)\b/i, "Có đối tượng, dữ liệu hoặc thời lượng thực thi"],
          ["Organization", null, "Đầu ra có cấu trúc dễ đọc"],
          ["Decision usefulness", /\b(kết quả kỳ vọng|expected outcome|deliverable|rủi ro|đạo đức|ethic|giới hạn|limitation)\b/i, "Có đầu ra, rủi ro hoặc giới hạn để ra quyết định"]
        ];
    const outputCriteria = outputChecks.map((check) => {
      const [criterion, pattern, description, second, secondLabel, third, thirdLabel] = check;
      let earned = 0;
      let reason = "";
      if (criterion === "Organization") {
        earned = lines.length >= 8 ? 2 : lines.length >= 4 ? 1 : 0;
        reason = earned === 2 ? "Có nhiều mục/dòng rõ ràng, dễ quét." : earned === 1 ? "Có cấu trúc cơ bản nhưng chưa thật rõ." : "Đầu ra còn thành khối, khó sử dụng.";
      } else if (criterion === "Coverage") {
        const hits = [[pattern, description], [second, secondLabel], [third, thirdLabel]].filter(([candidate]) => candidate).filter(([candidate]) => candidate.test(output));
        earned = hits.length >= 3 ? 2 : hits.length >= 1 ? 1 : 0;
        reason = hits.length ? `Có: ${hits.map(([, label]) => label).join(", ")}.` : "Thiếu các thành phần cốt lõi của nhiệm vụ.";
      } else {
        const hit = pattern.test(output);
        const lengthBonus = output.length >= 550;
        earned = hit && lengthBonus ? 2 : hit || lengthBonus ? 1 : 0;
        reason = earned === 2 ? `${description}; nội dung đủ độ sâu.` : earned === 1 ? `${description} nhưng mức chi tiết còn hạn chế.` : `Chưa có bằng chứng rõ cho ${criterion}.`;
      }
      return { criterion, earned, max: 2, reason };
    });
    return {
      prompt: { total: promptCriteria.reduce((sum, row) => sum + row.earned, 0), max: 6, criteria: promptCriteria },
      output: { total: outputCriteria.reduce((sum, row) => sum + row.earned, 0), max: 10, criteria: outputCriteria }
    };
  }

  function evidenceSnippet(text, pattern) {
    const match = text.match(pattern);
    if (!match) return "";
    const start = Math.max(0, match.index - 35);
    return text.slice(start, Math.min(text.length, match.index + match[0].length + 55)).trim();
  }

  function calculateResults() {
    const questions = DATA.delegation.questions;
    const humanCorrect = questions.filter((question, index) => state.delegation.humanAnswers[index] === question.answer).length;
    const teamCorrect = questions.filter((question, index) => state.delegation.teamAnswers[index] === question.answer).length;
    const aiCorrect = questions.filter((question) => question.aiAnswer === question.answer).length;
    const ideal = questions.map((question, index) => question.idealForAi ? index : null).filter((index) => index !== null);
    const selectivityHits = state.delegation.asked.filter((index) => ideal.includes(index)).length;
    const humanPct = Math.round(humanCorrect / questions.length * 100);
    const teamPct = Math.round(teamCorrect / questions.length * 100);
    const aiPct = Math.round(aiCorrect / questions.length * 100);
    const selectivityPct = Math.round(selectivityHits / DATA.delegation.maxAiRequests * 100);
    const delegationIndex = Math.round(teamPct * .7 + selectivityPct * .3);
    const delegationDiagnosis = diagnoseDelegation({ humanPct, teamPct, aiPct, selectivityHits, asked: state.delegation.asked.length });
    const travel = state.description.travel.scores || scoreDescription(DATA.description.tasks[0], state.description.travel);
    const research = state.description.research.scores || scoreDescription(DATA.description.tasks[1], state.description.research);
    const descriptionEarned = travel.prompt.total + travel.output.total + research.prompt.total + research.output.total;
    const descriptionMax = 32;
    const descriptionIndex = Math.round(descriptionEarned / descriptionMax * 100);
    const overall = Math.round((delegationIndex + descriptionIndex) / 2);
    const band = overall >= 85 ? "Xuất sắc" : overall >= 70 ? "Vững" : overall >= 55 ? "Đang phát triển" : "Cần củng cố";
    return {
      version: "round2-v2-results",
      overall,
      band,
      delegation: {
        humanCorrect, humanPct, aiCorrect, aiPct, teamCorrect, teamPct,
        selectivityHits,
        selectivityMax: DATA.delegation.maxAiRequests,
        askedCount: state.delegation.asked.length,
        delegationIndex,
        diagnosis: delegationDiagnosis,
        questionBreakdown: questions.map((question, index) => ({
          index: index + 1,
          correctAnswer: question.answer,
          humanAnswer: state.delegation.humanAnswers[index],
          humanCorrect: state.delegation.humanAnswers[index] === question.answer,
          askedAi: state.delegation.asked.includes(index),
          aiAnswer: question.aiAnswer,
          aiCorrect: question.aiAnswer === question.answer,
          teamAnswer: state.delegation.teamAnswers[index],
          teamCorrect: state.delegation.teamAnswers[index] === question.answer,
          idealForAi: question.idealForAi,
          explanation: question.explanation
        }))
      },
      description: {
        travel,
        research,
        earned: descriptionEarned,
        max: descriptionMax,
        descriptionIndex
      },
      summary: `Round 2: ${overall}/100 (${band}). Delegation Index ${delegationIndex}/100; Description Index ${descriptionIndex}/100.`,
      completedAt: new Date().toISOString()
    };
  }

  function diagnoseDelegation({ humanPct, teamPct, aiPct, selectivityHits, asked }) {
    const closeToHuman = Math.abs(teamPct - humanPct) <= 5;
    if (teamPct > humanPct && teamPct > aiPct && selectivityHits >= 5) {
      return "Delegation tốt: hiệu suất kết hợp vượt cả hai baseline và lựa chọn hỏi AI tập trung đúng vào vùng benchmark mạnh.";
    }
    if (teamPct < humanPct) {
      return selectivityHits <= 2
        ? "Cảnh báo over-reliance: hiệu suất khi có AI thấp hơn tự làm và độ chọn lọc thấp. Một số can thiệp của AI đã làm giảm kết quả."
        : "Hiệu suất Team thấp hơn Human-alone dù độ chọn lọc không thấp; cần xem từng câu để xác định bạn đã theo AI sai hay thay đổi đáp án đúng.";
    }
    if (closeToHuman) {
      return asked <= 3
        ? "Dấu hiệu under-reliance: kết quả gần như không đổi và bạn dùng ít lượt AI; có thể chưa tận dụng được hỗ trợ ở các câu bất định."
        : "AI chưa tạo ra cải thiện rõ so với tự làm. Cần tăng khả năng chọn đúng câu để hỏi hoặc phản biện gợi ý hiệu quả hơn.";
    }
    if (teamPct < aiPct) {
      return "Team performance vẫn thấp hơn AI-alone. Hãy xem thêm Human-alone để phân biệt năng lực tự thân yếu với việc chọn sai câu cần hỗ trợ.";
    }
    return selectivityHits >= 4
      ? "Bạn tạo được mức cải thiện tích cực và có độ chọn lọc khá. Cần tiếp tục kiểm tra các câu AI sai để tránh tin theo phản xạ."
      : "Kết quả kết hợp có cải thiện, nhưng độ chọn lọc còn trung bình; phần tăng điểm có thể đến từ phản biện tốt hơn là chọn đúng câu để hỏi.";
  }

  async function finishAssessment(autoSubmitted) {
    if (busy || state.stage === "results") return;
    busy = true;
    state.results = calculateResults();
    state.stage = "results";
    state.error = "";
    persist();
    app.innerHTML = shell(`<div class="loading"><strong>Đang lưu và tổng hợp kết quả…</strong><p>Vui lòng giữ trang mở trong giây lát.</p></div>`, 100, "Đang hoàn tất");
    await saveAttempt({
      currentStage: "completed",
      status: autoSubmitted ? "timed_out" : "completed",
      gradingStatus: "completed",
      round2Overall: state.results.overall,
      round2Band: state.results.band,
      autoSubmitted: Boolean(autoSubmitted)
    });
    try {
      await apiJson("/api/ai/grade", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attemptId: state.attemptId,
          work: {
            delegationPlan: state.results.delegation.diagnosis,
            keyFindings: `Travel prompt ${state.results.description.travel.prompt.total}/6; output ${state.results.description.travel.output.total}/10.`,
            recommendation: `Research prompt ${state.results.description.research.prompt.total}/6; output ${state.results.description.research.output.total}/10.`,
            risks: `Delegation selectivity ${state.results.delegation.selectivityHits}/7; Team ${state.results.delegation.teamPct}%.`,
            executiveSummary: state.results.summary,
            verificationNotes: "Round2-v2 uses deterministic rubric scoring from the supplied Delegation and Description specifications."
          },
          transcript: combinedTranscript(),
          timeSpentSeconds: nowSeconds(),
          autoSubmitted: Boolean(autoSubmitted)
        })
      });
    } catch {
      // The v2 result is already persisted. Legacy grading is used only to mark
      // older backend records complete and must never block the candidate report.
    }
    busy = false;
    persist();
    render();
  }

  function rubricRows(section) {
    return section.criteria.map((row) => `
      <div class="rubric-row">
        <span>${esc(row.criterion)}</span><b>${row.earned}/${row.max}</b>
        <p>${esc(row.reason)}${row.evidence ? ` Bằng chứng: “${esc(row.evidence)}”` : ""}</p>
      </div>`).join("");
  }

  function renderResults() {
    const result = state.results;
    if (!result) {
      state.stage = "landing";
      render();
      return;
    }
    app.innerHTML = shell(`
      <section class="result-hero">
        <div>
          <p class="eyebrow orange">TALEMY AI SKILL REPORT</p>
          <h1>${esc(state.profile.name)}</h1>
          <p class="lead">${esc(state.profile.role)}${state.profile.code ? ` · ${esc(state.profile.code)}` : ""}</p>
        </div>
        <div class="overall">
          <div class="score-ring" style="--score:${result.overall * 3.6}deg"><strong>${result.overall}</strong></div>
          <div><span>ROUND 2 OVERALL</span><strong>${esc(result.band)}</strong><p>Trung bình Delegation Index và Description Index.</p></div>
        </div>
      </section>
      ${state.error ? `<p class="error">${esc(state.error)}</p>` : ""}
      <section class="section-head"><div><p class="eyebrow">DELEGATION</p><h2>Hiệu suất người–AI</h2></div><p>Bốn chỉ số được đọc cùng nhau; không có chỉ số đơn lẻ nào đủ để kết luận.</p></section>
      <div class="metric-grid">
        <article class="metric"><span>Human alone</span><strong>${result.delegation.humanPct}%</strong><p>${result.delegation.humanCorrect}/20 câu đúng</p></article>
        <article class="metric"><span>AI alone benchmark</span><strong>${result.delegation.aiPct}%</strong><p>${result.delegation.aiCorrect}/20 câu đúng</p></article>
        <article class="metric"><span>Team performance</span><strong>${result.delegation.teamPct}%</strong><p>${result.delegation.teamCorrect}/20 câu đúng</p></article>
        <article class="metric"><span>Selectivity</span><strong>${result.delegation.selectivityHits}/7</strong><p>Dùng ${result.delegation.askedCount}/7 lượt AI</p></article>
      </div>
      <div class="diagnosis"><p class="eyebrow orange">DIỄN GIẢI DELEGATION</p><h3>Delegation Index ${result.delegation.delegationIndex}/100</h3><p>${esc(result.delegation.diagnosis)}</p></div>
      <section class="section-head"><div><p class="eyebrow">DESCRIPTION</p><h2>Structured Prompt + Final Output</h2></div><p>Initial Prompt và Final Output được chấm riêng cho từng task.</p></section>
      <div class="task-results">
        ${DATA.description.tasks.map((task) => {
          const scores = result.description[task.id];
          return `<article class="task-result">
            <p class="eyebrow orange">${esc(task.label)}</p><h3>${esc(task.task)}</h3>
            <div class="score-line"><span>Initial Prompt</span><strong>${scores.prompt.total}/6</strong></div>
            <div class="rubric-list">${rubricRows(scores.prompt)}</div>
            <div class="score-line"><span>Final Output</span><strong>${scores.output.total}/10</strong></div>
            <div class="rubric-list">${rubricRows(scores.output)}</div>
          </article>`;
        }).join("")}
      </div>
      <footer class="result-footer">
        <p>✓ Bài làm, transcript và logic điểm đã được lưu cho người chấm. Điểm này là một nguồn bằng chứng hỗ trợ, không phải căn cứ tuyển dụng duy nhất.</p>
        <div><button id="printResult" class="button secondary">In / Lưu PDF</button></div>
      </footer>
    `, 100, "Candidate Report");
    document.getElementById("printResult").addEventListener("click", () => window.print());
  }

  window.addEventListener("beforeunload", () => {
    persist();
    if (state.attemptId && state.stage !== "results") {
      const body = JSON.stringify({
        attemptId: state.attemptId,
        delegationPlan: JSON.stringify({
          version: DATA.version,
          humanAnswers: state.delegation.humanAnswers,
          teamAnswers: state.delegation.teamAnswers,
          asked: state.delegation.asked
        }),
        keyFindings: JSON.stringify(compactTask("travel")),
        recommendation: JSON.stringify(compactTask("research")),
        chatTranscript: combinedTranscript(),
        timeSpentSeconds: nowSeconds(),
        currentStage: state.stage
      });
      fetch(`${API}/api/attempts`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  });

  render();
})();
