"use client";

import { type FormEvent, useMemo, useState } from "react";
import {
  cleanAiText,
  formatTime,
  strengthMeta,
  type ChatMessage,
  type DelegationResult,
  type DescriptionWork,
  type DiscernmentFinding,
  type FinalAssessmentResult,
  type StrengthKey,
} from "../../lib/assessment";

type Attempt = {
  id: number;
  attemptId: string;
  status: string;
  currentStage: string;
  candidateName: string;
  candidateEmail: string;
  candidateCode: string;
  role: string;
  startedAt: string;
  completedAt: string | null;
  timeSpentSeconds: number;
  autoSubmitted: boolean;
  round1Score: number | null;
  round1Total: number | null;
  round1Band: string | null;
  round1Breakdown: unknown;
  chatTranscript: ChatMessage[];
  aiCallCount: number;
  gradingStatus: string;
  round2Overall: number | null;
  round2Band: string | null;
  round2Scores: Record<string, number> | null;
  gradingVersion: string;
  assessmentVersion: string;
  skippedRound1: boolean;
  round2State: {
    descriptionWork?: DescriptionWork;
    discernmentFindings?: DiscernmentFinding[];
    [key: string]: unknown;
  };
  delegationState: {
    result?: DelegationResult;
    consulted?: string[];
    [key: string]: unknown;
  };
  finalResult: FinalAssessmentResult | null;
  legacyWork?: Record<string, string>;
  lastSavedAt: string;
};

type ReviewerRubric = {
  gradingVersion: string;
  bands: Array<{ name: string; range: string; meaning: string }>;
  formulas: string[];
  criteria: Record<
    "delegation" | "description" | "discernment",
    Array<{ criterion: string; max: number }>
  >;
  discernmentGroundTruth: Array<{
    code: string;
    type: string;
    expected: string;
  }>;
};

const API_ORIGINS = [
  "https://talemy-secure-api-gateway.pages.dev",
  "https://talemy-secure-api-proxy.talemy-ngo-2026.workers.dev",
] as const;

const statusLabel: Record<string, string> = {
  in_progress: "Đang làm",
  completed: "Hoàn thành",
  timed_out: "Hết giờ",
  screened_out: "Dừng sau Round 1",
};

function apiUrls(path: string) {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const isLocal =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "";
  const direct = API_ORIGINS.map((origin) => `${origin}${path}`);
  return isLocal ? [...direct, path] : direct;
}

async function reviewerFetch(path: string, init?: RequestInit) {
  let lastError = new Error(
    "Chưa thể kết nối với database Talemy. Vui lòng thử lại.",
  );
  for (const url of apiUrls(path)) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), 18_000);
      try {
        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
        });
        window.clearTimeout(timer);
        if (
          response.ok ||
          (response.status >= 400 &&
            response.status < 500 &&
            response.status !== 408)
        ) {
          return response;
        }
      } catch (error) {
        window.clearTimeout(timer);
        if (error instanceof Error && error.name !== "AbortError") {
          lastError = error;
        }
      }
      if (attempt === 0) {
        await new Promise((resolve) => window.setTimeout(resolve, 650));
      }
    }
  }
  throw lastError;
}

function WorkBlock({
  title,
  value,
}: {
  title: string;
  value: string | undefined;
}) {
  return (
    <div className="reviewer-work-block">
      <strong>{title}</strong>
      <pre>{value?.trim() || "—"}</pre>
    </div>
  );
}

function DetailJson({
  title,
  value,
}: {
  title: string;
  value: unknown;
}) {
  return (
    <details className="reviewer-section">
      <summary>{title}</summary>
      <pre className="reviewer-json">{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

export default function ReviewerClient() {
  const [accessKey, setAccessKey] = useState("");
  const [reviewerName, setReviewerName] = useState("Talemy Reviewer");
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [rubric, setRubric] = useState<ReviewerRubric | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<
    "idle" | "loading" | "ready" | "error"
  >("idle");
  const [deleting, setDeleting] = useState(false);

  const loadAttempts = async (key = accessKey) => {
    if (!key.trim()) return;
    setStatus("loading");
    setAuthError("");
    try {
      const response = await reviewerFetch("/api/attempts", {
        cache: "no-store",
        headers: { authorization: `Bearer ${key.trim()}` },
      });
      const data = (await response.json().catch(() => null)) as
        | {
            reviewer?: { name?: string };
            rubric?: ReviewerRubric;
            attempts?: Attempt[];
            error?: string;
          }
        | null;
      if (response.status === 401) throw new Error("Mã truy cập chưa đúng.");
      if (!response.ok || !Array.isArray(data?.attempts)) {
        throw new Error(data?.error || "Chưa thể tải database.");
      }
      setReviewerName(data.reviewer?.name || "Talemy Reviewer");
      setRubric(data.rubric ?? null);
      setAttempts(data.attempts);
      setSelectedId((current) =>
        data.attempts!.some((item) => item.id === current)
          ? current
          : (data.attempts![0]?.id ?? null),
      );
      setAuthenticated(true);
      setStatus("ready");
    } catch (error) {
      setAuthenticated(false);
      setStatus("error");
      setAuthError(
        error instanceof Error ? error.message : "Chưa thể đăng nhập.",
      );
    }
  };

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadAttempts();
  };

  const signOut = () => {
    setAccessKey("");
    setAuthenticated(false);
    setAttempts([]);
    setRubric(null);
    setSelectedId(null);
    setStatus("idle");
    setAuthError("");
  };

  const exportExcel = async () => {
    setAuthError("");
    try {
      const response = await reviewerFetch("/api/attempts/export", {
        headers: { authorization: `Bearer ${accessKey.trim()}` },
      });
      if (response.status === 401) {
        throw new Error("Phiên truy cập không hợp lệ.");
      }
      if (!response.ok) throw new Error("Chưa thể xuất file Excel.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `talemy-ai-assessment-${new Date().toISOString().slice(0, 10)}.xls`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Chưa thể xuất file Excel.",
      );
    }
  };

  const deleteSelected = async () => {
    const selected = attempts.find((item) => item.id === selectedId);
    if (!selected || deleting) return;
    const confirmed = window.confirm(
      `Xoá vĩnh viễn lượt làm của ${selected.candidateName}? Hành động này không thể hoàn tác.`,
    );
    if (!confirmed) return;
    setDeleting(true);
    setAuthError("");
    try {
      const response = await reviewerFetch(
        `/api/attempts?attemptId=${encodeURIComponent(selected.attemptId)}`,
        {
          method: "DELETE",
          headers: { authorization: `Bearer ${accessKey.trim()}` },
        },
      );
      const data = (await response.json().catch(() => null)) as
        | { error?: string }
        | null;
      if (!response.ok) {
        throw new Error(data?.error || "Chưa thể xoá lượt làm.");
      }
      setAttempts((current) =>
        current.filter((item) => item.attemptId !== selected.attemptId),
      );
      const remaining = attempts.filter(
        (item) => item.attemptId !== selected.attemptId,
      );
      setSelectedId(remaining[0]?.id ?? null);
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Chưa thể xoá lượt làm.",
      );
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return attempts;
    return attempts.filter((item) =>
      `${item.candidateName} ${item.candidateEmail} ${item.candidateCode} ${item.role} ${item.status}`
        .toLowerCase()
        .includes(term),
    );
  }, [attempts, query]);
  const selected = attempts.find((item) => item.id === selectedId) ?? null;
  const completedCount = attempts.filter(
    (item) => item.status === "completed" || item.status === "timed_out",
  ).length;

  if (!authenticated) {
    return (
      <main className="reviewer-login-page">
        <header className="reviewer-header">
          <div className="reviewer-brand">
            <img src="../talemy-logo.png" alt="Talemy" />
            <span>Reviewer Center</span>
          </div>
          <a href="../">← Về trang bài test</a>
        </header>
        <section className="reviewer-login-card">
          <div className="reviewer-login-icon">R</div>
          <p className="eyebrow orange">KHU VỰC BẢO MẬT</p>
          <h1>Đăng nhập người chấm</h1>
          <p>
            Nhập mã Reviewer để xem database, transcript, kết quả Round 2 và
            reasoning theo rubric.
          </p>
          <form onSubmit={handleLogin}>
            <label>
              Mã truy cập người chấm
              <input
                type="password"
                value={accessKey}
                onChange={(event) => setAccessKey(event.target.value)}
                autoComplete="current-password"
                placeholder="Nhập mã truy cập"
                autoFocus
              />
            </label>
            {authError && (
              <p className="form-error" role="alert">
                {authError}
              </p>
            )}
            <button
              type="submit"
              className="primary-button"
              disabled={!accessKey.trim() || status === "loading"}
            >
              {status === "loading"
                ? "Đang kiểm tra…"
                : "Mở Reviewer Center →"}
            </button>
          </form>
          <small>
            Mã truy cập chỉ được giữ trong tab hiện tại và không ghi vào file
            export.
          </small>
        </section>
      </main>
    );
  }

  const finalResult = selected?.finalResult ?? null;
  const descriptionWork = selected?.round2State?.descriptionWork;
  const discernmentFindings =
    selected?.round2State?.discernmentFindings ?? [];
  const delegation = finalResult?.round2.delegation ??
    selected?.delegationState?.result;
  const rankedStrengths = finalResult
    ? (Object.keys(strengthMeta) as StrengthKey[])
        .map((key) => ({
          key,
          score: finalResult.final.strengths[key].score,
        }))
        .filter((item) => item.score != null)
        .sort((a, b) => Number(b.score) - Number(a.score))
    : [];
  const strongestResult = rankedStrengths[0];
  const priorityResult = rankedStrengths.at(-1);

  return (
    <main className="reviewer-page">
      <header className="reviewer-header">
        <div className="reviewer-brand">
          <img src="../talemy-logo.png" alt="Talemy" />
          <span>Reviewer Center</span>
        </div>
        <div>
          <span>Đang đăng nhập</span>
          <strong>{reviewerName}</strong>
          <button type="button" onClick={signOut}>
            Đăng xuất
          </button>
        </div>
      </header>
      <section className="reviewer-title">
        <div>
          <p className="eyebrow orange">KHU VỰC DÀNH CHO NGƯỜI CHẤM</p>
          <h1>Database bài làm & reasoning</h1>
          <p>
            Một nguồn dữ liệu duy nhất cho Round 1, Round 2, transcript, rubric,
            version và kết quả 4D.
          </p>
          <div className="reviewer-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => void loadAttempts()}
            >
              ↻ Làm mới
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={() => void exportExcel()}
            >
              Xuất Excel (.xls) ↗
            </button>
            <button
              type="button"
              className="danger-button"
              onClick={() => void deleteSelected()}
              disabled={!selected || deleting}
            >
              {deleting ? "Đang xoá…" : "Xoá lượt đang chọn"}
            </button>
          </div>
          {authError && (
            <p className="form-error" role="alert">
              {authError}
            </p>
          )}
        </div>
        <div className="reviewer-count">
          <strong>{attempts.length}</strong>
          <span>lượt bắt đầu · {completedCount} đã nộp</span>
        </div>
      </section>
      {rubric && (
        <details className="reviewer-methodology">
          <summary>
            Rubric chuẩn & logic chấm · {rubric.gradingVersion}
          </summary>
          <div className="reviewer-methodology-grid">
            <section>
              <h3>Công thức tổng hợp</h3>
              <ol>
                {rubric.formulas.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </section>
            <section>
              <h3>Ngưỡng phân band</h3>
              <div className="reviewer-band-grid">
                {rubric.bands.map((band) => (
                  <div key={band.name}>
                    <strong>{band.name}</strong>
                    <span>{band.range}</span>
                    <small>{band.meaning}</small>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <div className="reviewer-criteria-grid">
            {(
              Object.keys(rubric.criteria) as Array<
                keyof ReviewerRubric["criteria"]
              >
            ).map((key) => (
              <section key={key}>
                <h3>{strengthMeta[key].label} · Round 2</h3>
                {rubric.criteria[key].map((item) => (
                  <div key={item.criterion}>
                    <span>{item.criterion}</span>
                    <strong>{item.max} điểm</strong>
                  </div>
                ))}
              </section>
            ))}
          </div>
        </details>
      )}
      <section className="reviewer-layout">
        <aside className="submission-list">
          <label>
            Tìm ứng viên
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Tên, email, mã hoặc trạng thái..."
            />
          </label>
          {status === "loading" && (
            <p className="reviewer-empty">Đang tải database...</p>
          )}
          {status === "error" && (
            <p className="reviewer-empty error">
              Chưa tải được dữ liệu. Vui lòng thử lại.
            </p>
          )}
          {status === "ready" && !filtered.length && (
            <p className="reviewer-empty">Chưa có kết quả phù hợp.</p>
          )}
          <div>
            {filtered.map((item) => (
              <button
                key={item.id}
                type="button"
                className={selectedId === item.id ? "active" : ""}
                onClick={() => setSelectedId(item.id)}
              >
                <span className="candidate-initial">
                  {item.candidateName.slice(0, 1).toUpperCase()}
                </span>
                <span>
                  <strong>{item.candidateName}</strong>
                  <small>{item.role}</small>
                  <em>
                    {statusLabel[item.status] ?? item.status} ·{" "}
                    {new Date(item.lastSavedAt).toLocaleString("vi-VN")}
                  </em>
                </span>
                <b>
                  {item.finalResult?.final.overall ??
                    item.finalResult?.round2.score ??
                    item.round2Overall ??
                    (item.status === "in_progress" ? "…" : "R1")}
                </b>
              </button>
            ))}
          </div>
        </aside>
        <section className="reviewer-detail">
          {!selected && (
            <div className="reviewer-placeholder">
              <strong>Chọn một ứng viên</strong>
              <p>Chi tiết bài làm và reasoning sẽ xuất hiện tại đây.</p>
            </div>
          )}
          {selected && (
            <>
              <div className="candidate-detail-head">
                <div>
                  <p className="eyebrow orange">
                    ATTEMPT #{selected.id} ·{" "}
                    {statusLabel[selected.status] ?? selected.status}
                  </p>
                  <h2>{selected.candidateName}</h2>
                  <p>
                    {selected.role}
                    {selected.candidateCode
                      ? ` · ${selected.candidateCode}`
                      : ""}
                    {selected.candidateEmail
                      ? ` · ${selected.candidateEmail}`
                      : ""}
                  </p>
                </div>
                <div className="candidate-total">
                  <strong>
                    {finalResult?.final.overall ??
                      finalResult?.round2.score ??
                      selected.round2Overall ??
                      "—"}
                  </strong>
                  <span>
                    {finalResult?.final.overall == null
                      ? "ROUND 2 /100"
                      : "OVERALL /100"}
                  </span>
                </div>
              </div>
              <div className="reviewer-rounds four">
                <article>
                  <span>Round 1</span>
                  <strong>
                    {selected.skippedRound1
                      ? "Skipped"
                      : selected.round1Score == null
                        ? "Chưa xong"
                        : `${selected.round1Score}/${selected.round1Total}`}
                  </strong>
                  <small>{selected.round1Band ?? selected.currentStage}</small>
                </article>
                <article>
                  <span>Round 2</span>
                  <strong>
                    {finalResult?.round2.score ??
                      selected.round2Overall ??
                      "—"}
                  </strong>
                  <small>
                    {finalResult?.round2.band ??
                      selected.round2Band ??
                      selected.gradingStatus}
                  </small>
                </article>
                <article>
                  <span>Overall</span>
                  <strong>{finalResult?.final.overall ?? "N/A"}</strong>
                  <small>{finalResult?.final.band ?? "Không đủ dữ liệu"}</small>
                </article>
                <article>
                  <span>Thời gian</span>
                  <strong>{formatTime(selected.timeSpentSeconds)}</strong>
                  <small>
                    {selected.autoSubmitted
                      ? "Tự nộp khi hết giờ"
                      : `AI chat ${selected.aiCallCount}/20`}
                  </small>
                </article>
              </div>

              {finalResult ? (
                <>
                  <section className="reviewer-score-map">
                    <div>
                      <p className="eyebrow orange">AUDITABLE SCORE MAP</p>
                      <h3>Round 1 → Round 2 → Final strength</h3>
                    </div>
                    <div className="score-matrix-wrap">
                      <table className="score-matrix">
                        <thead>
                          <tr>
                            <th>Core strength</th>
                            <th>Round 1</th>
                            <th>Round 2</th>
                            <th>Final</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(Object.keys(strengthMeta) as StrengthKey[]).map(
                            (key) => (
                              <tr key={key}>
                                <th>{strengthMeta[key].label}</th>
                                <td>
                                  {finalResult.round1.strengthScores[key] ??
                                    "N/A"}
                                </td>
                                <td>
                                  {key === "diligence"
                                    ? "Không đo"
                                    : finalResult.round2.strengths[key].score}
                                </td>
                                <td>
                                  <strong>
                                    {finalResult.final.strengths[key].score ??
                                      "N/A"}
                                  </strong>
                                </td>
                              </tr>
                            ),
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>
                  <section className="reviewer-band-reason">
                    <p className="eyebrow orange">
                      WHY THIS BAND · {finalResult.graderMode.replaceAll("_", " ")} ·
                      CONFIDENCE {finalResult.confidence.toUpperCase()}
                    </p>
                    <h3>
                      {finalResult.final.band ?? finalResult.round2.band} ·{" "}
                      {finalResult.final.overall ?? finalResult.round2.score}/100
                    </h3>
                    <p>{finalResult.overallReasoning}</p>
                    <strong>{finalResult.final.formula}</strong>
                    <ul>
                      {finalResult.reviewerReasoning.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </section>
                  <section className="reviewer-decision-summary">
                    <article>
                      <span>Năng lực nổi bật</span>
                      <strong>
                        {strongestResult
                          ? `${strengthMeta[strongestResult.key].label} · ${strongestResult.score}/100`
                          : "Chưa đủ dữ liệu"}
                      </strong>
                      <p>
                        {strongestResult
                          ? finalResult.final.strengths[strongestResult.key]
                              .strengths[0] ||
                            finalResult.final.strengths[strongestResult.key]
                              .summary
                          : "—"}
                      </p>
                    </article>
                    <article>
                      <span>Ưu tiên phát triển</span>
                      <strong>
                        {priorityResult
                          ? `${strengthMeta[priorityResult.key].label} · ${priorityResult.score}/100`
                          : "Chưa đủ dữ liệu"}
                      </strong>
                      <p>
                        {priorityResult
                          ? finalResult.final.strengths[priorityResult.key]
                              .gaps[0] ||
                            finalResult.final.strengths[priorityResult.key]
                              .summary
                          : "—"}
                      </p>
                    </article>
                    <article className="interview-probe">
                      <span>Gợi ý interview probe</span>
                      <strong>Kiểm chứng hành vi, không hỏi lại lý thuyết</strong>
                      <p>
                        Yêu cầu ứng viên walk-through một quyết định thực tế ở{" "}
                        {priorityResult
                          ? strengthMeta[priorityResult.key].label
                          : "core strength thấp nhất"}
                        : dữ kiện nào đã dùng, AI đã ảnh hưởng ra sao và bước
                        kiểm chứng cuối cùng là gì.
                      </p>
                    </article>
                  </section>
                  <section className="reviewer-strengths">
                    <h3>Breakdown 4 core strengths & logic điểm</h3>
                    {(Object.keys(strengthMeta) as StrengthKey[]).map((key) => {
                      const strength = finalResult.final.strengths[key];
                      const round2Strength =
                        key === "diligence"
                          ? null
                          : finalResult.round2.strengths[key];
                      return (
                        <article key={key}>
                          <div>
                            <strong>{strengthMeta[key].label}</strong>
                            <b>
                              {strength.score == null
                                ? "N/A"
                                : `${strength.score}/100 · ${strength.band}`}
                            </b>
                          </div>
                          <div className="reviewer-bar">
                            <span
                              style={{ width: `${strength.score ?? 0}%` }}
                            />
                          </div>
                          <p>{strength.summary}</p>
                          <div className="review-reasons">
                            <div>
                              <span>Điểm mạnh</span>
                              <ul>
                                {strength.strengths.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <span>Cần cải thiện</span>
                              <ul>
                                {strength.gaps.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                            <details open>
                              <summary>Logic điểm tổng hợp</summary>
                              <div className="reviewer-score-breakdown">
                                {strength.breakdown.map((item) => (
                                  <div key={item.criterion}>
                                    <span>{item.criterion}</span>
                                    <strong>
                                      {item.awarded}/{item.max}
                                    </strong>
                                    <p>{item.reason}</p>
                                    {item.evidence && (
                                      <em>Evidence: {item.evidence}</em>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </details>
                            {round2Strength && (
                              <details open>
                                <summary>
                                  Rubric Round 2 · {round2Strength.score}/100
                                </summary>
                                <div className="reviewer-score-breakdown">
                                  {round2Strength.breakdown.map((item) => (
                                    <div key={item.criterion}>
                                      <span>{item.criterion}</span>
                                      <strong>
                                        {item.awarded}/{item.max}
                                      </strong>
                                      <p>{item.reason}</p>
                                      {item.evidence && (
                                        <em>Evidence: {item.evidence}</em>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                            <details>
                              <summary>Evidence</summary>
                              <ul>
                                {strength.evidence.map((item, index) => (
                                  <li key={`${key}-${index}`}>{item}</li>
                                ))}
                              </ul>
                            </details>
                          </div>
                        </article>
                      );
                    })}
                  </section>
                </>
              ) : (
                <div className="reviewer-pending">
                  <strong>Chưa có final result</strong>
                  <p>
                    Stage hiện tại: {selected.currentStage}. Dữ liệu đang làm vẫn
                    được hiển thị bên dưới để reviewer theo dõi.
                  </p>
                </div>
              )}

              {delegation && (
                <details className="reviewer-section" open>
                  <summary>Delegation · Human / AI / Team</summary>
                  <div className="reviewer-metric-grid">
                    <span>
                      Human <b>{delegation.humanAlone}%</b>
                    </span>
                    <span>
                      AI <b>{delegation.aiAlone}%</b>
                    </span>
                    <span>
                      Team <b>{delegation.teamPerformance}%</b>
                    </span>
                    <span>
                      AI-use decision{" "}
                      <b>
                        {delegation.selectivity.matched}/
                        {delegation.selectivity.total}
                      </b>
                    </span>
                  </div>
                  <div className="reviewer-delegation-rows">
                    {delegation.breakdown.map((item) => (
                      <div key={item.id} className={item.tone}>
                        <strong>{item.id}</strong>
                        <span>{item.feedback}</span>
                        <small>
                          R1 {item.part1Correct ? "đúng" : "sai"} ·{" "}
                          {item.consulted ? "có AI" : "không AI"} · R2{" "}
                          {item.finalCorrect ? "đúng" : "sai"}
                        </small>
                      </div>
                    ))}
                  </div>
                </details>
              )}

              {descriptionWork && (
                <details className="reviewer-section" open>
                  <summary>Description · Task A & B</summary>
                  {(["description_a", "description_b"] as const).map((key) => (
                    <div key={key} className="reviewer-task-block">
                      <h4>
                        {key === "description_a"
                          ? "Task A · Travel"
                          : "Task B · Academic"}
                      </h4>
                      <div className="reviewer-work-grid">
                        <WorkBlock
                          title="Final prompt"
                          value={descriptionWork[key]?.finalPrompt}
                        />
                        <WorkBlock
                          title="Kết quả đã chốt"
                          value={descriptionWork[key]?.finalPlan}
                        />
                        <WorkBlock
                          title="Reflection / Verification"
                          value={descriptionWork[key]?.reflection}
                        />
                      </div>
                    </div>
                  ))}
                </details>
              )}

              <details className="reviewer-section" open>
                <summary>
                  Transcript Talemy AI · {selected.chatTranscript?.length ?? 0}{" "}
                  messages
                </summary>
                <div className="reviewer-transcript">
                  {selected.chatTranscript?.length ? (
                    selected.chatTranscript.map((message) => (
                      <div key={message.id} className={message.role}>
                        <span>
                          {message.role === "user" ? "Ứng viên" : "Talemy AI"}
                          {message.taskKey ? ` · ${message.taskKey}` : ""}
                          {message.role === "assistant" && message.provider
                            ? ` · ${message.provider.replaceAll("_", " ")}`
                            : ""}
                        </span>
                        <p>{cleanAiText(message.content)}</p>
                      </div>
                    ))
                  ) : (
                    <p>Chưa có transcript.</p>
                  )}
                </div>
              </details>

              {discernmentFindings.length > 0 && (
                <details className="reviewer-section" open>
                  <summary>
                    Discernment · Candidate findings & ground-truth result
                  </summary>
                  <div className="reviewer-findings">
                    {discernmentFindings.map((finding, index) => (
                      <article key={finding.id}>
                        <b>{index + 1}</b>
                        <div>
                          <strong>{finding.problem}</strong>
                          <p>{finding.why}</p>
                          <small>Cách sửa: {finding.improvement}</small>
                        </div>
                      </article>
                    ))}
                  </div>
                  {finalResult && (
                    <div className="reviewer-ground-truth">
                      {finalResult.round2.discernmentErrors.map((item) => (
                        <div
                          key={item.code}
                          className={item.detected ? "detected" : "missed"}
                        >
                          <strong>
                            {item.code} · {item.type}
                          </strong>
                          <span>
                            {item.pointsAwarded}/{item.maxPoints}
                          </span>
                          <p>{item.feedback}</p>
                          <small>{item.candidateEvidence}</small>
                        </div>
                      ))}
                    </div>
                  )}
                  {rubric && (
                    <details className="ground-truth-key">
                      <summary>
                        Ground truth key · chỉ dành cho Reviewer
                      </summary>
                      <div>
                        {rubric.discernmentGroundTruth.map((item) => (
                          <article key={item.code}>
                            <strong>
                              {item.code} · {item.type}
                            </strong>
                            <p>{item.expected}</p>
                          </article>
                        ))}
                      </div>
                    </details>
                  )}
                </details>
              )}

              {selected.legacyWork &&
                Object.values(selected.legacyWork).some(Boolean) && (
                  <details className="reviewer-section">
                    <summary>Dữ liệu bài làm legacy</summary>
                    <div className="reviewer-work-grid">
                      {Object.entries(selected.legacyWork).map(([key, value]) => (
                        <WorkBlock key={key} title={key} value={value} />
                      ))}
                    </div>
                  </details>
                )}
              <DetailJson
                title="Audit JSON · versioned result"
                value={{
                  assessmentVersion: selected.assessmentVersion,
                  gradingVersion: selected.gradingVersion,
                  finalResult,
                }}
              />
            </>
          )}
        </section>
      </section>
    </main>
  );
}
