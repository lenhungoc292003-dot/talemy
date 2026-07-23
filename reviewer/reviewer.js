(() => {
  "use strict";

  const API = "https://talemy-secure-api-gateway.pages.dev";
  const CONNECTION_ERROR = "Chưa thể kết nối với hệ thống Talemy. Vui lòng đợi vài giây rồi thử lại.";
  const state = { key: "", attempts: [], selectedId: null, query: "" };
  const el = (id) => document.getElementById(id);
  const arr = (value) => Array.isArray(value) ? value : [];
  const statusLabel = { in_progress: "Đang làm", completed: "Hoàn thành", timed_out: "Hết giờ", screened_out: "Dừng sau Round 1" };

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
  }

  function parse(value) {
    if (value && typeof value === "object") return value;
    try { return JSON.parse(value); } catch { return null; }
  }

  function fmtTime(seconds) {
    const value = Math.max(0, Number(seconds) || 0);
    return `${String(Math.floor(value / 60)).padStart(2, "0")}:${String(Math.floor(value % 60)).padStart(2, "0")}`;
  }

  function showError(target, message) {
    target.textContent = message;
    target.classList.toggle("hidden", !message);
  }

  function authHeaders() {
    return { authorization: `Bearer ${state.key}` };
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
    if (response.status === 401) throw new Error("Mã truy cập chưa đúng.");
    if (!response.ok || !data) throw new Error(data?.error || CONNECTION_ERROR);
    return data;
  }

  async function loadAttempts() {
    showError(el("dashboardError"), "");
    const data = await apiJson("/api/attempts", { cache: "no-store", headers: authHeaders() });
    state.attempts = arr(data.attempts);
    if (!state.selectedId || !state.attempts.some((item) => item.id === state.selectedId)) {
      state.selectedId = state.attempts[0]?.id ?? null;
    }
    render();
  }

  function round2Results(item) {
    const result = parse(item.risks);
    return ["round2-v2-results", "round2-v3-results"].includes(result?.version) ? result : null;
  }

  function round2Task(item, key) {
    const value = parse(item[key]);
    return ["round2-v2", "round2-v3"].includes(value?.version) ? value : null;
  }

  function filteredAttempts() {
    const term = state.query.trim().toLowerCase();
    if (!term) return state.attempts;
    return state.attempts.filter((item) =>
      `${item.candidateName} ${item.candidateEmail} ${item.candidateCode} ${item.role} ${item.status}`.toLowerCase().includes(term)
    );
  }

  function renderList() {
    const items = filteredAttempts();
    if (!items.length) {
      el("candidateList").innerHTML = '<div class="empty">Chưa có kết quả phù hợp.</div>';
      return;
    }
    el("candidateList").innerHTML = items.map((item) => {
      const result = round2Results(item);
      const score = result?.overall ?? item.round2Overall ?? (item.status === "in_progress" ? "…" : "R1");
      const label = result ? `Round 2 · ${result.band}` : (statusLabel[item.status] || item.status);
      return `<button class="candidate ${item.id === state.selectedId ? "active" : ""}" type="button" data-id="${Number(item.id)}">
        <span class="initial">${esc((item.candidateName || "?").slice(0,1).toUpperCase())}</span>
        <span><strong>${esc(item.candidateName || "Chưa có tên")}</strong><small>${esc(item.role || "—")}</small><em>${esc(label)} · ${esc(new Date(item.lastSavedAt).toLocaleString("vi-VN"))}</em></span>
        <b>${esc(score)}</b>
      </button>`;
    }).join("");
    el("candidateList").querySelectorAll("button[data-id]").forEach((button) => button.addEventListener("click", () => {
      state.selectedId = Number(button.dataset.id);
      render();
    }));
  }

  function boolCell(answer, correct) {
    if (answer === null || answer === undefined) return '<span class="neutral">—</span>';
    return `<span class="${answer === correct ? "ok" : "bad"}">${answer ? "Đúng" : "Sai"}</span>`;
  }

  function rubricRows(section) {
    if (!section?.criteria) return '<div class="empty">Chưa có điểm.</div>';
    return section.criteria.map((row) => `<div class="rubric-row">
      <span>${esc(row.criterion)}</span><b>${esc(row.earned)}/${esc(row.max)}</b>
      <p>${esc(row.reason)}${row.evidence ? ` Bằng chứng: “${esc(row.evidence)}”` : ""}</p>
    </div>`).join("");
  }

  function work(title, value) {
    return `<div class="work"><strong>${esc(title)}</strong><pre>${esc(value || "—")}</pre></div>`;
  }

  function transcript(task) {
    const messages = arr(task?.messages);
    return messages.length
      ? `<div class="transcript">${messages.map((message) => `<div class="message ${message.role === "user" ? "user" : "assistant"}"><span>${message.role === "user" ? "Ứng viên" : "Talemy AI"}</span><p>${esc(message.content)}</p></div>`).join("")}</div>`
      : "<p>Chưa có transcript.</p>";
  }

  function renderV2(item, result) {
    const travel = round2Task(item, "keyFindings") || {};
    const research = round2Task(item, "recommendation") || {};
    const round1Text = item.round1Score == null ? "—" : `${item.round1Score}/${item.round1Total}`;
    const questions = arr(result.delegation?.questionBreakdown);
    el("detail").innerHTML = `
      <div class="head">
        <div><p class="eyebrow">Attempt #${esc(item.id)} · ROUND 2 V2</p><h2>${esc(item.candidateName)}</h2><p>${esc(item.role)}${item.candidateCode ? ` · ${esc(item.candidateCode)}` : ""}${item.candidateEmail ? ` · ${esc(item.candidateEmail)}` : ""}</p></div>
        <div class="total"><strong>${esc(result.overall)}</strong><span>${esc(result.band)} · /100</span></div>
      </div>
      <div class="summary-grid">
        <article><span>Round 1</span><strong>${esc(round1Text)}</strong><small>${esc(item.round1Band || item.currentStage || "—")}</small></article>
        <article><span>Delegation Index</span><strong>${esc(result.delegation?.delegationIndex ?? "—")}</strong><small>70% Team + 30% Selectivity</small></article>
        <article><span>Description Index</span><strong>${esc(result.description?.descriptionIndex ?? "—")}</strong><small>${esc(result.description?.earned ?? 0)}/${esc(result.description?.max ?? 32)} rubric points</small></article>
        <article><span>Thời gian</span><strong>${fmtTime(item.timeSpentSeconds)}</strong><small>${item.autoSubmitted ? "Tự nộp khi hết giờ" : "Nộp chủ động"}</small></article>
      </div>
      <section class="band"><p class="eyebrow">WHY THIS DELEGATION SCORE</p><h3>${esc(result.delegation?.diagnosis || "Chưa có diễn giải")}</h3><p>Human ${esc(result.delegation?.humanPct)}% · AI benchmark ${esc(result.delegation?.aiPct)}% · Team ${esc(result.delegation?.teamPct)}% · Selectivity ${esc(result.delegation?.selectivityHits)}/${esc(result.delegation?.selectivityMax)} · Dùng ${esc(result.delegation?.askedCount)}/7 lượt.</p></section>

      <h3 class="section-title">Delegation · Breakdown 20 câu</h3>
      <div class="table-wrap"><table class="question-table">
        <thead><tr><th>#</th><th>Đáp án</th><th>Human</th><th>Hỏi AI</th><th>AI benchmark</th><th>Team</th><th>Giải thích</th></tr></thead>
        <tbody>${questions.map((row) => `<tr>
          <td>${esc(row.index)}</td>
          <td>${row.correctAnswer ? "Đúng" : "Sai"}</td>
          <td>${boolCell(row.humanAnswer, row.correctAnswer)}</td>
          <td class="${row.askedAi ? "ok" : "neutral"}">${row.askedAi ? "Có" : "Không"}${row.idealForAi ? " · Ideal" : ""}</td>
          <td>${boolCell(row.aiAnswer, row.correctAnswer)}</td>
          <td>${boolCell(row.teamAnswer, row.correctAnswer)}</td>
          <td class="reason">${esc(row.explanation)}</td>
        </tr>`).join("")}</tbody>
      </table></div>

      <h3 class="section-title">Description · Prompt và Output rubric</h3>
      <div class="tasks">
        ${[
          ["Task A · Travel Planning", travel, result.description?.travel],
          ["Task B · Research Project Planning", research, result.description?.research]
        ].map(([label, task, scores]) => `<article class="task">
          <p class="eyebrow">${esc(label)}</p><h3>${esc(task.taskId === "travel" ? "Lịch trình Nhật Bản 4 ngày" : "Đề xuất nghiên cứu Generative AI")}</h3>
          <div class="score-line"><span>Initial Prompt</span><b>${esc(scores?.prompt?.total ?? "—")}/6</b></div>
          <div class="rubric">${rubricRows(scores?.prompt)}</div>
          <div class="score-line"><span>Final Output</span><b>${esc(scores?.output?.total ?? "—")}/10</b></div>
          <div class="rubric">${rubricRows(scores?.output)}</div>
          <details open><summary>Prompt và đầu ra đã nộp</summary><div class="work-grid">${work("Initial Prompt", task.initialPrompt)}${work("Final Output", task.finalOutput)}</div></details>
          <details><summary>Transcript · ${arr(task.messages).length} messages</summary>${transcript(task)}</details>
        </article>`).join("")}
      </div>
    `;
  }

  function listHtml(items) {
    return arr(items).length ? `<ul>${arr(items).map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : "<p>—</p>";
  }

  function renderLegacy(item) {
    const grade = item.graderResult;
    el("detail").innerHTML = `
      <div class="head">
        <div><p class="eyebrow">Attempt #${esc(item.id)} · LEGACY</p><h2>${esc(item.candidateName)}</h2><p>${esc(item.role)}${item.candidateCode ? ` · ${esc(item.candidateCode)}` : ""}</p></div>
        <div class="total"><strong>${esc(item.round2Overall ?? "—")}</strong><span>Round 2 cũ /100</span></div>
      </div>
      <div class="summary-grid">
        <article><span>Round 1</span><strong>${item.round1Score == null ? "—" : `${esc(item.round1Score)}/${esc(item.round1Total)}`}</strong><small>${esc(item.round1Band || "—")}</small></article>
        <article><span>Round 2 cũ</span><strong>${esc(item.round2Overall ?? "—")}</strong><small>${esc(item.round2Band || item.gradingStatus || "—")}</small></article>
        <article><span>AI chat</span><strong>${esc(item.aiCallCount || 0)}</strong><small>lượt</small></article>
        <article><span>Thời gian</span><strong>${fmtTime(item.timeSpentSeconds)}</strong><small>${esc(statusLabel[item.status] || item.status)}</small></article>
      </div>
      <div class="legacy">
        <strong>Bài làm thuộc phiên bản Round 2 cũ.</strong>
        <p>Reviewer Center giữ tương thích để dữ liệu trước khi nâng cấp không bị mất.</p>
        ${grade ? `<h3>${esc(grade.band)} · ${esc(grade.overall)}/100</h3><p>${esc(grade.bandReason)}</p><p>${esc(grade.overallSynthesis)}</p><strong>Reviewer notes</strong>${listHtml(grade.reviewerNotes)}` : "<p>Bài làm chưa có kết quả chấm Round 2.</p>"}
      </div>
      <details open><summary>Nội dung bài làm cũ</summary><div class="work-grid">
        ${work("Delegation plan", item.delegationPlan)}
        ${work("Key findings", item.keyFindings)}
        ${work("Recommendation", item.recommendation)}
        ${work("Risks", item.risks)}
        ${work("Executive summary", item.executiveSummary)}
        ${work("Verification notes", item.verificationNotes)}
      </div></details>
      <details><summary>Transcript · ${arr(item.chatTranscript).length} messages</summary>${transcript({ messages: item.chatTranscript })}</details>
    `;
  }

  function renderDetail() {
    const item = state.attempts.find((attempt) => attempt.id === state.selectedId);
    if (!item) {
      el("detail").innerHTML = '<div class="placeholder"><strong>Chọn một ứng viên</strong><span>Chi tiết bài làm và lý do chấm sẽ xuất hiện tại đây.</span></div>';
      return;
    }
    const result = round2Results(item);
    if (result) renderV2(item, result);
    else renderLegacy(item);
  }

  function render() {
    const completed = state.attempts.filter((item) => ["completed", "timed_out"].includes(item.status) || round2Results(item)).length;
    el("attemptCount").textContent = state.attempts.length;
    el("completedCount").textContent = `lượt bắt đầu · ${completed} có kết quả`;
    renderList();
    renderDetail();
  }

  el("loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    showError(el("loginError"), "");
    state.key = el("accessKey").value.trim();
    if (!state.key) {
      showError(el("loginError"), "Hãy nhập mã truy cập.");
      return;
    }
    el("loginButton").disabled = true;
    el("loginButton").textContent = "Đang kiểm tra…";
    try {
      await loadAttempts();
      el("login").classList.add("hidden");
      el("dashboard").classList.remove("hidden");
      el("backLink").classList.add("hidden");
      el("logout").classList.remove("hidden");
    } catch (error) {
      state.key = "";
      showError(el("loginError"), error.message || "Chưa thể đăng nhập.");
    } finally {
      el("loginButton").disabled = false;
      el("loginButton").textContent = "Mở Reviewer Center →";
    }
  });

  el("search").addEventListener("input", (event) => {
    state.query = event.target.value;
    renderList();
  });

  el("refresh").addEventListener("click", () => loadAttempts().catch((error) => showError(el("dashboardError"), error.message)));

  el("logout").addEventListener("click", () => {
    state.key = "";
    state.attempts = [];
    state.selectedId = null;
    state.query = "";
    el("accessKey").value = "";
    el("search").value = "";
    el("dashboard").classList.add("hidden");
    el("login").classList.remove("hidden");
    el("backLink").classList.remove("hidden");
    el("logout").classList.add("hidden");
  });

  el("export").addEventListener("click", async () => {
    showError(el("dashboardError"), "");
    try {
      const response = await apiFetch("/api/attempts/export", { headers: authHeaders() });
      if (response.status === 401) throw new Error("Mã truy cập không hợp lệ.");
      if (!response.ok) throw new Error(CONNECTION_ERROR);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `talemy-ai-assessment-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      showError(el("dashboardError"), error.message || "Chưa thể xuất file CSV.");
    }
  });
})();
