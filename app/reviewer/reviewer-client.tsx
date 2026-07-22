"use client";

import { type FormEvent, useMemo, useState } from "react";
import { formatTime, type AiGrade, type ChatMessage, type StrengthKey } from "../../lib/assessment";

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
  expiresAt: string;
  completedAt: string | null;
  timeSpentSeconds: number;
  autoSubmitted: boolean;
  round1Score: number | null;
  round1Total: number | null;
  round1Band: string | null;
  round1Breakdown: unknown;
  delegationPlan: string;
  keyFindings: string;
  recommendation: string;
  risks: string;
  executiveSummary: string;
  verificationNotes: string;
  chatTranscript: ChatMessage[] | null;
  aiCallCount: number;
  gradingStatus: string;
  graderResult: AiGrade | null;
  round2Overall: number | null;
  round2Band: string | null;
  round2Scores: Record<StrengthKey, number> | null;
  gradingVersion: string;
  lastSavedAt: string;
};

const labels: Record<StrengthKey, string> = { delegation: "Delegation", description: "Description", discernment: "Discernment" };
const statusLabel: Record<string, string> = { in_progress: "Đang làm", completed: "Hoàn thành", timed_out: "Hết giờ", screened_out: "Dừng sau Round 1" };

function WorkBlock({ title, value }: { title: string; value: string }) {
  return <div className="reviewer-work-block"><strong>{title}</strong><pre>{value || "—"}</pre></div>;
}

export default function ReviewerClient() {
  const [accessKey, setAccessKey] = useState("");
  const [reviewerName, setReviewerName] = useState("Talemy Reviewer");
  const [authenticated, setAuthenticated] = useState(false);
  const [authError, setAuthError] = useState("");
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">("idle");

  const loadAttempts = async (key = accessKey) => {
    if (!key.trim()) return;
    setStatus("loading");
    setAuthError("");
    try {
      const response = await fetch("/api/attempts", {
        cache: "no-store",
        headers: { authorization: `Bearer ${key.trim()}` },
      });
      if (response.status === 401) throw new Error("Mã truy cập chưa đúng.");
      if (!response.ok) throw new Error("Chưa thể tải database. Vui lòng thử lại.");
      const data = await response.json() as { reviewer?: { name?: string }; attempts: Attempt[] };
      setReviewerName(data.reviewer?.name || "Talemy Reviewer");
      setAttempts(data.attempts);
      setSelectedId((current) => current ?? data.attempts[0]?.id ?? null);
      setAuthenticated(true);
      setStatus("ready");
    } catch (error) {
      setAuthenticated(false);
      setStatus("error");
      setAuthError(error instanceof Error ? error.message : "Chưa thể đăng nhập.");
    }
  };

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadAttempts(accessKey);
  };

  const signOut = () => {
    setAccessKey("");
    setAuthenticated(false);
    setAttempts([]);
    setSelectedId(null);
    setStatus("idle");
    setAuthError("");
  };

  const exportCsv = async () => {
    setAuthError("");
    try {
      const response = await fetch("/api/attempts/export", {
        headers: { authorization: `Bearer ${accessKey.trim()}` },
      });
      if (response.status === 401) throw new Error("Phiên truy cập không hợp lệ. Vui lòng đăng nhập lại.");
      if (!response.ok) throw new Error("Chưa thể xuất file CSV.");
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `talemy-ai-assessment-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      setAuthError(error instanceof Error ? error.message : "Chưa thể xuất file CSV.");
    }
  };

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return attempts;
    return attempts.filter((item) => `${item.candidateName} ${item.candidateEmail} ${item.candidateCode} ${item.role} ${item.status}`.toLowerCase().includes(term));
  }, [attempts, query]);
  const selected = attempts.find((item) => item.id === selectedId) ?? null;
  const completedCount = attempts.filter((item) => item.status === "completed" || item.status === "timed_out").length;

  if (!authenticated) return (
    <main className="reviewer-login-page">
      <header className="reviewer-header"><div className="reviewer-brand"><img src="/talemy-logo.png" alt="Talemy" /><span>Reviewer Center</span></div><a href="/">← Về trang bài test</a></header>
      <section className="reviewer-login-card">
        <div className="reviewer-login-icon">R</div>
        <p className="eyebrow orange">KHU VỰC BẢO MẬT</p>
        <h1>Đăng nhập người chấm</h1>
        <p>Nhập mã truy cập Talemy để xem database bài làm, transcript AI và logic chấm điểm.</p>
        <form onSubmit={handleLogin}>
          <label>Mã truy cập người chấm<input type="password" value={accessKey} onChange={(event) => setAccessKey(event.target.value)} autoComplete="current-password" placeholder="Nhập mã truy cập" autoFocus /></label>
          {authError && <p className="form-error" role="alert">{authError}</p>}
          <button type="submit" className="primary-button" disabled={!accessKey.trim() || status === "loading"}>{status === "loading" ? "Đang kiểm tra…" : "Mở Reviewer Center →"}</button>
        </form>
        <small>Mã truy cập không được lưu trên trình duyệt. Khi đóng hoặc tải lại trang, bạn cần nhập lại.</small>
      </section>
    </main>
  );

  return (
    <main className="reviewer-page">
      <header className="reviewer-header"><div className="reviewer-brand"><img src="/talemy-logo.png" alt="Talemy" /><span>Reviewer Center</span></div><div><span>Đang đăng nhập</span><strong>{reviewerName}</strong><button type="button" onClick={signOut}>Đăng xuất</button></div></header>
      <section className="reviewer-title"><div><p className="eyebrow orange">KHU VỰC DÀNH CHO NGƯỜI CHẤM</p><h1>Database bài làm & logic chấm</h1><p>Xem tiến độ theo thời gian thực, toàn bộ prompt/response, báo cáo cuối, bằng chứng và từng điểm rubric.</p><div className="reviewer-actions"><button type="button" className="secondary-button" onClick={() => void loadAttempts()}>↻ Làm mới</button><button type="button" className="primary-button" onClick={() => void exportCsv()}>Xuất CSV / Excel ↗</button></div>{authError && <p className="form-error" role="alert">{authError}</p>}</div><div className="reviewer-count"><strong>{attempts.length}</strong><span>lượt bắt đầu · {completedCount} đã nộp</span></div></section>
      <section className="reviewer-layout">
        <aside className="submission-list"><label>Tìm ứng viên<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên, email, mã hoặc trạng thái..." /></label>{status === "loading" && <p className="reviewer-empty">Đang tải database...</p>}{status === "error" && <p className="reviewer-empty error">Chưa tải được dữ liệu. Vui lòng thử lại.</p>}{status === "ready" && !filtered.length && <p className="reviewer-empty">Chưa có kết quả phù hợp.</p>}<div>{filtered.map((item) => <button key={item.id} type="button" className={selectedId === item.id ? "active" : ""} onClick={() => setSelectedId(item.id)}><span className="candidate-initial">{item.candidateName.slice(0, 1).toUpperCase()}</span><span><strong>{item.candidateName}</strong><small>{item.role}</small><em>{statusLabel[item.status] ?? item.status} · {new Date(item.lastSavedAt).toLocaleString("vi-VN")}</em></span><b>{item.round2Overall ?? (item.status === "in_progress" ? "…" : "R1")}</b></button>)}</div></aside>
        <section className="reviewer-detail">
          {!selected && <div className="reviewer-placeholder"><strong>Chọn một ứng viên</strong><p>Chi tiết bài làm và lý do chấm sẽ xuất hiện tại đây.</p></div>}
          {selected && <><div className="candidate-detail-head"><div><p className="eyebrow orange">ATTEMPT #{selected.id} · {statusLabel[selected.status] ?? selected.status}</p><h2>{selected.candidateName}</h2><p>{selected.role}{selected.candidateCode ? ` · ${selected.candidateCode}` : ""}{selected.candidateEmail ? ` · ${selected.candidateEmail}` : ""}</p></div><div className="candidate-total"><strong>{selected.round2Overall ?? "—"}</strong><span>Round 2 /100</span></div></div>
            <div className="reviewer-rounds"><article><span>Round 1</span><strong>{selected.round1Score == null ? "Chưa xong" : `${selected.round1Score}/${selected.round1Total}`}</strong><small>{selected.round1Band ?? selected.currentStage}</small></article><article><span>Round 2</span><strong>{selected.round2Overall ?? (selected.gradingStatus === "in_progress" ? "Đang chấm" : "Chưa có điểm")}</strong><small>{selected.round2Band ?? selected.gradingStatus}</small></article><article><span>Thời gian</span><strong>{formatTime(selected.timeSpentSeconds)}</strong><small>{selected.autoSubmitted ? "Tự nộp khi hết giờ" : `AI chat: ${selected.aiCallCount}/20 lượt`}</small></article></div>
            {selected.graderResult && <><section className="reviewer-band-reason"><p className="eyebrow orange">WHY THIS BAND · CONFIDENCE {selected.graderResult.confidence.toUpperCase()}</p><h3>{selected.graderResult.band} · {selected.graderResult.overall}/100</h3><p>{selected.graderResult.bandReason}</p><strong>{selected.graderResult.overallSynthesis}</strong></section><section className="reviewer-strengths"><h3>Breakdown 3 strengths & logic điểm</h3>{(Object.keys(labels) as StrengthKey[]).map((key) => { const result = selected.graderResult!.strengths[key]; return <article key={key}><div><strong>{labels[key]}</strong><b>{result.score}/100 · {result.band}</b></div><div className="reviewer-bar"><span style={{ width: `${result.score}%` }} /></div><p>{result.summary}</p><div className="review-reasons"><div><span>Điểm mạnh</span><ul>{result.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div><div><span>Cần cải thiện</span><ul>{result.gaps.map((item) => <li key={item}>{item}</li>)}</ul></div><details open><summary>Logic tính điểm</summary><div className="reviewer-score-breakdown">{result.scoringBreakdown.map((item) => <div key={item.criterion}><span>{item.criterion}</span><strong>{item.awarded}/{item.max}</strong><p>{item.reason}</p></div>)}</div></details><details><summary>Bằng chứng trích từ bài làm</summary><ul>{result.evidence.map((item, index) => <li key={`${item.source}-${index}`}><b>{item.source}:</b> “{item.quote}” — {item.why}</li>)}</ul></details></div></article>; })}</section></>}
            <details className="reviewer-section" open><summary>Báo cáo cuối của ứng viên</summary><div className="reviewer-work-grid"><WorkBlock title="Kế hoạch phân vai AI–con người" value={selected.delegationPlan} /><WorkBlock title="Các phát hiện chính" value={selected.keyFindings} /><WorkBlock title="Khuyến nghị" value={selected.recommendation} /><WorkBlock title="Rủi ro & trade-off" value={selected.risks} /><WorkBlock title="Executive summary" value={selected.executiveSummary} /><WorkBlock title="Cách kiểm tra/sửa AI" value={selected.verificationNotes} /></div></details>
            <details className="reviewer-section" open><summary>Transcript với Talemy AI · {selected.chatTranscript?.length ?? 0} messages</summary><div className="reviewer-transcript">{selected.chatTranscript?.map((message) => <div key={message.id} className={message.role}><span>{message.role === "user" ? "Ứng viên" : "Talemy AI"}</span><p>{message.content}</p></div>) || <p>Chưa có transcript.</p>}</div></details>
            {selected.graderResult && <details className="reviewer-section"><summary>Ghi chú riêng cho người chấm</summary><div className="reviewer-answer"><strong>Decision quality</strong><p>{selected.graderResult.decisionQuality}</p><strong>Red flags</strong><ul>{selected.graderResult.redFlags.map((item) => <li key={item}>{item}</li>)}</ul><strong>Reviewer notes</strong><ul>{selected.graderResult.reviewerNotes.map((item) => <li key={item}>{item}</li>)}</ul></div></details>}
          </>}
        </section>
      </section>
    </main>
  );
}
