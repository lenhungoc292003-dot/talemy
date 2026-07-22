"use client";

import { useEffect, useMemo, useState } from "react";

type Message = { id: string; role: "assistant" | "user"; content: string };
type Feedback = Record<string, { strengths: string[]; gaps: string[]; reasons: string[] }>;
type Submission = {
  id: number;
  candidateName: string;
  candidateEmail: string;
  candidateCode: string;
  role: string;
  round1Score: number;
  round1Total: number;
  round1Band: string;
  round1Breakdown: Record<string, { correct: number; total: number }> | null;
  round2Overall: number | null;
  round2Scores: Record<string, number> | null;
  round2Feedback: Feedback | null;
  round2Answers: { delegation?: Record<string, string>; audits?: string[]; revision?: string; aiDraft?: string } | null;
  chatTranscript: Message[] | null;
  gradingVersion: string;
  completedAt: string;
};

const labels: Record<string, string> = {
  delegation: "Delegation",
  description: "Description",
  discernment: "Discernment",
};

export default function ReviewerClient({ reviewerName }: { reviewerName: string }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    void fetch("/api/submissions")
      .then(async (response) => {
        if (!response.ok) throw new Error("Không thể tải kết quả");
        return response.json() as Promise<{ submissions: Submission[] }>;
      })
      .then((data) => {
        setSubmissions(data.submissions);
        setSelectedId(data.submissions[0]?.id ?? null);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) return submissions;
    return submissions.filter((item) => `${item.candidateName} ${item.candidateEmail} ${item.candidateCode} ${item.role}`.toLowerCase().includes(term));
  }, [query, submissions]);
  const selected = submissions.find((item) => item.id === selectedId) ?? null;

  return (
    <main className="reviewer-page">
      <header className="reviewer-header">
        <div className="reviewer-brand"><img src="/talemy-logo.png" alt="Talemy" /><span>Reviewer Center</span></div>
        <div><span>Đang đăng nhập</span><strong>{reviewerName}</strong><a href="/signout-with-chatgpt?return_to=/">Đăng xuất</a></div>
      </header>

      <section className="reviewer-title">
        <div><p className="eyebrow orange">KHU VỰC DÀNH CHO NGƯỜI CHẤM</p><h1>Kết quả và lý do chấm</h1><p>Xem điểm Round 1, breakdown 3 strengths Round 2, câu trả lời và toàn bộ transcript với Talemy AI.</p></div>
        <div className="reviewer-count"><strong>{submissions.length}</strong><span>lượt nộp</span></div>
      </section>

      <section className="reviewer-layout">
        <aside className="submission-list">
          <label>Tìm ứng viên<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Tên, email hoặc mã..." /></label>
          {status === "loading" && <p className="reviewer-empty">Đang tải kết quả...</p>}
          {status === "error" && <p className="reviewer-empty error">Chưa tải được dữ liệu. Vui lòng thử lại.</p>}
          {status === "ready" && !filtered.length && <p className="reviewer-empty">Chưa có kết quả phù hợp.</p>}
          <div>
            {filtered.map((item) => (
              <button key={item.id} type="button" className={selectedId === item.id ? "active" : ""} onClick={() => setSelectedId(item.id)}>
                <span className="candidate-initial">{item.candidateName.slice(0, 1).toUpperCase()}</span>
                <span><strong>{item.candidateName}</strong><small>{item.role}</small><em>{new Date(item.completedAt).toLocaleString("vi-VN")}</em></span>
                <b>{item.round2Overall == null ? "R1" : item.round2Overall}</b>
              </button>
            ))}
          </div>
        </aside>

        <section className="reviewer-detail">
          {!selected && <div className="reviewer-placeholder"><strong>Chọn một ứng viên</strong><p>Chi tiết bài làm và lý do chấm sẽ xuất hiện tại đây.</p></div>}
          {selected && (
            <>
              <div className="candidate-detail-head">
                <div><p className="eyebrow orange">SUBMISSION #{selected.id}</p><h2>{selected.candidateName}</h2><p>{selected.role}{selected.candidateCode ? ` · ${selected.candidateCode}` : ""}{selected.candidateEmail ? ` · ${selected.candidateEmail}` : ""}</p></div>
                <div className="candidate-total"><strong>{selected.round2Overall ?? "—"}</strong><span>Round 2 /100</span></div>
              </div>

              <div className="reviewer-rounds">
                <article><span>Round 1</span><strong>{selected.round1Score}/{selected.round1Total}</strong><small>{selected.round1Band}</small></article>
                <article><span>Round 2</span><strong>{selected.round2Overall ?? "Chưa làm"}</strong><small>{selected.round2Overall == null ? "Không đủ điều kiện / chưa hoàn thành" : selected.gradingVersion}</small></article>
              </div>

              {selected.round2Scores && (
                <section className="reviewer-strengths">
                  <h3>Breakdown 3 strengths</h3>
                  {Object.entries(selected.round2Scores).map(([key, score]) => (
                    <article key={key}>
                      <div><strong>{labels[key] ?? key}</strong><b>{score}/100</b></div>
                      <div className="reviewer-bar"><span style={{ width: `${score}%` }} /></div>
                      {selected.round2Feedback?.[key] && (
                        <div className="review-reasons">
                          <div><span>Điểm mạnh</span><ul>{selected.round2Feedback[key].strengths.map((item) => <li key={item}>{item}</li>)}</ul></div>
                          <div><span>Cần cải thiện</span><ul>{selected.round2Feedback[key].gaps.map((item) => <li key={item}>{item}</li>)}</ul></div>
                          <details><summary>Xem logic chấm</summary><ul>{selected.round2Feedback[key].reasons.map((item) => <li key={item}>{item}</li>)}</ul></details>
                        </div>
                      )}
                    </article>
                  ))}
                </section>
              )}

              {selected.chatTranscript && (
                <details className="reviewer-section" open>
                  <summary>Transcript với Talemy AI</summary>
                  <div className="reviewer-transcript">{selected.chatTranscript.map((message) => <div key={message.id} className={message.role}><span>{message.role === "user" ? "Ứng viên" : "Talemy AI"}</span><p>{message.content}</p></div>)}</div>
                </details>
              )}

              {selected.round2Answers && (
                <details className="reviewer-section">
                  <summary>Câu trả lời và bản sửa cuối</summary>
                  <div className="reviewer-answer"><strong>Các lỗi ứng viên đã chọn</strong><p>{selected.round2Answers.audits?.join(", ") || "—"}</p><strong>Email cuối cùng</strong><pre>{selected.round2Answers.revision || "—"}</pre></div>
                </details>
              )}
            </>
          )}
        </section>
      </section>
    </main>
  );
}
