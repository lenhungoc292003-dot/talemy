"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ASSESSMENT_DURATION_SECONDS,
  bandForScore,
  businessBrief,
  formatTime,
  recruitmentDataset,
  type AiGrade,
  type CandidateWork,
  type ChatMessage,
  type StrengthKey,
} from "../lib/assessment";

type View = "landing" | "round1" | "round2Intro" | "round2" | "results";
type Round2Step = 1 | 2 | 3;
type SaveState = "idle" | "saving" | "saved" | "error";
type Profile = { name: string; email: string; code: string; role: string };

type Round1Tally = Record<"D" | "Desc" | "Disc" | "Dil", { correct: number; total: number; strengths: string[]; gaps: string[] }>;
type Round1Result = {
  score: number;
  total: number;
  overallPct: number;
  band: { num: string; name: string; desc: string };
  tally: Round1Tally;
  completedAt: string;
};

const emptyWork: CandidateWork = {
  delegationPlan: "",
  keyFindings: "",
  recommendation: "",
  risks: "",
  executiveSummary: "",
  verificationNotes: "",
};

const strengthMeta: Record<StrengthKey, { label: string; short: string; description: string }> = {
  delegation: { label: "Delegation", short: "Phân vai đúng", description: "Dùng AI cho phần xử lý phù hợp, giữ phán đoán và trách nhiệm ở con người." },
  description: { label: "Description", short: "Brief phân tích rõ", description: "Đặt mục tiêu, metric, ràng buộc và định dạng đầu ra đủ rõ để AI hỗ trợ hiệu quả." },
  discernment: { label: "Discernment", short: "Kiểm chứng & quyết định", description: "Kiểm tra số liệu, nhận ra trade-off và đưa ra khuyến nghị dựa trên bằng chứng." },
};

const initialMessages: ChatMessage[] = [{
  id: "welcome",
  role: "assistant",
  content: "Chào bạn, mình là Talemy AI Analysis Copilot dùng mô hình OpenAI. Mình có thể giúp tính metric, so sánh kênh và kiểm tra giả định. Mình sẽ không chọn đáp án hoặc viết trọn báo cáo để nộp thay bạn.",
}];

const PRODUCTION_BACKEND_ORIGIN = "https://talemy-secure-api-proxy.talemy-ngo-2026.workers.dev";

function backendUrl(path: string) {
  const isGitHubPages = typeof window !== "undefined" && window.location.hostname.endsWith("github.io");
  return isGitHubPages ? `${PRODUCTION_BACKEND_ORIGIN}${path}` : path;
}

function reviewerUrl() {
  const isGitHubPages = typeof window !== "undefined" && window.location.hostname.endsWith("github.io");
  return isGitHubPages ? "./reviewer/" : "/reviewer";
}

function Logo({ compact = false }: { compact?: boolean }) {
  return <div className={`logo-lockup ${compact ? "compact" : ""}`}><img src="./talemy-logo.png" alt="Talemy" /><span>AI Skill Test</span></div>;
}

function AssessmentTimer({ remaining }: { remaining: number }) {
  const urgent = remaining <= 10 * 60;
  return <div className={`assessment-timer ${urgent ? "urgent" : ""}`}><span>THỜI GIAN CÒN LẠI</span><strong>{formatTime(remaining)}</strong></div>;
}

function StepProgress({ active }: { active: Round2Step }) {
  return <div className="step-progress" aria-label={`Bước ${active} trên 3`}>{[1, 2, 3].map((step) => <span key={step} className={step <= active ? "active" : ""}>{step}</span>)}</div>;
}

function DatasetTable() {
  return (
    <section className="dataset-card">
      <div className="dataset-head"><div><p className="eyebrow orange">DATASET · QUÝ GẦN NHẤT</p><h2>Hiệu quả các kênh sourcing</h2></div><span>Đơn vị chi phí: triệu VNĐ</span></div>
      <div className="dataset-scroll">
        <table>
          <thead><tr><th>Kênh</th><th>Applicants</th><th>Qualified</th><th>Interviews</th><th>Offers</th><th>Hires</th><th>Cost</th><th>Time-to-hire</th><th>Retention 90d</th></tr></thead>
          <tbody>{recruitmentDataset.map((row) => <tr key={row.channel}><th>{row.channel}</th><td>{row.applicants}</td><td>{row.qualified}</td><td>{row.interviews}</td><td>{row.offers}</td><td>{row.hires}</td><td>{row.costM}</td><td>{row.timeToHire} ngày</td><td>{row.retention90}%</td></tr>)}</tbody>
        </table>
      </div>
      <div className="metric-notes"><span><b>Qualified</b> đạt tiêu chí sàng lọc</span><span><b>Cost</b> tổng chi phí theo kênh</span><span><b>Retention 90d</b> còn làm việc sau 90 ngày</span></div>
    </section>
  );
}

function ChatPanel(props: {
  messages: ChatMessage[];
  value: string;
  busy: boolean;
  error: string;
  remainingCalls: number;
  onChange: (value: string) => void;
  onSend: () => void;
}) {
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [props.messages, props.busy]);
  return (
    <aside className="ai-chat real-ai" aria-label="Talemy AI Analysis Copilot">
      <div className="chat-head"><div className="ai-avatar">AI</div><div><strong>Talemy AI</strong><span><i /> OpenAI · Analysis Copilot</span></div><b>{props.remainingCalls}/20 lượt</b></div>
      <div className="chat-boundary"><strong>Copilot, không phải đáp án</strong><span>AI hỗ trợ tính toán và chất vấn. Bạn tự chốt báo cáo.</span></div>
      <div className="chat-messages">
        {props.messages.map((message) => <div key={message.id} className={`chat-message ${message.role}`}><span>{message.role === "user" ? "Bạn" : "Talemy AI"}</span><p>{message.content}</p></div>)}
        {props.busy && <div className="chat-message assistant"><span>Talemy AI</span><p className="typing">Đang phân tích dataset…</p></div>}
        <div ref={endRef} />
      </div>
      {props.error && <p className="chat-error">{props.error}</p>}
      <div className="chat-compose"><textarea value={props.value} onChange={(event) => props.onChange(event.target.value)} rows={3} maxLength={3000} placeholder="Ví dụ: Tính cost-per-hire và hire rate từng kênh, nêu công thức…" onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); props.onSend(); } }} /><div><span>{props.value.length}/3000</span><button type="button" onClick={props.onSend} disabled={props.busy || props.value.trim().length < 4 || props.remainingCalls <= 0}>Gửi ↗</button></div></div>
    </aside>
  );
}

function TextAreaField(props: { label: string; hint: string; value: string; min?: number; rows?: number; onChange: (value: string) => void }) {
  return <label className="analysis-field"><span><strong>{props.label}</strong><small>{props.hint}</small></span><textarea rows={props.rows ?? 7} value={props.value} onChange={(event) => props.onChange(event.target.value)} /><em>{props.value.length} ký tự{props.min ? ` · tối thiểu ${props.min}` : ""}</em></label>;
}

function ScoreRing({ score, small = false }: { score: number; small?: boolean }) {
  return <div className={`score-ring ${small ? "small" : ""}`} style={{ "--score": `${score * 3.6}deg` } as React.CSSProperties}><strong>{score}</strong><span>/100</span></div>;
}

export default function Home() {
  const [view, setView] = useState<View>("landing");
  const [profile, setProfile] = useState<Profile>({ name: "", email: "", code: "", role: "" });
  const [attemptId, setAttemptId] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [deadline, setDeadline] = useState(0);
  const [remaining, setRemaining] = useState(ASSESSMENT_DURATION_SECONDS);
  const [round1Result, setRound1Result] = useState<Round1Result | null>(null);
  const [round1Height, setRound1Height] = useState(760);
  const [round1Key, setRound1Key] = useState(0);
  const [round2Step, setRound2Step] = useState<Round2Step>(1);
  const [work, setWork] = useState<CandidateWork>(emptyWork);
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [chatInput, setChatInput] = useState("");
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");
  const [remainingCalls, setRemainingCalls] = useState(20);
  const [grade, setGrade] = useState<AiGrade | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState("");
  const [resultMessage, setResultMessage] = useState("");
  const submittedRef = useRef(false);
  const restoredRef = useRef(false);

  const unlocked = Boolean(round1Result && round1Result.score >= 12);
  const timeSpentSeconds = useMemo(() => startedAt ? Math.min(ASSESSMENT_DURATION_SECONDS, Math.max(0, Math.round((Date.now() - new Date(startedAt).getTime()) / 1000))) : 0, [startedAt, remaining]);

  const updateWork = (key: keyof CandidateWork, value: string) => setWork((current) => ({ ...current, [key]: value }));

  const saveProgress = useCallback(async (extra: Record<string, unknown> = {}) => {
    if (!attemptId) return;
    setSaveState("saving");
    try {
      const response = await fetch(backendUrl("/api/attempts"), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attemptId, ...work, chatTranscript: messages, timeSpentSeconds, ...extra }),
        keepalive: true,
      });
      if (!response.ok) throw new Error("save failed");
      setSaveState("saved");
    } catch { setSaveState("error"); }
  }, [attemptId, messages, timeSpentSeconds, work]);

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const raw = sessionStorage.getItem("talemy-active-attempt");
    if (!raw) return;
    try {
      const stored = JSON.parse(raw) as { attemptId?: string; startedAt?: string; expiresAt?: string; profile?: Profile };
      if (!stored.attemptId || !stored.startedAt || !stored.expiresAt || !stored.profile) return;
      void fetch(backendUrl(`/api/attempts?attemptId=${encodeURIComponent(stored.attemptId)}`), { cache: "no-store" })
        .then(async (response) => { if (!response.ok) throw new Error("restore failed"); return response.json() as Promise<{ attempt: Record<string, unknown> }>; })
        .then(({ attempt }) => {
          setAttemptId(stored.attemptId!);
          setStartedAt(stored.startedAt!);
          setDeadline(new Date(stored.expiresAt!).getTime());
          setProfile(stored.profile!);
          setWork({
            delegationPlan: String(attempt.delegationPlan ?? ""),
            keyFindings: String(attempt.keyFindings ?? ""),
            recommendation: String(attempt.recommendation ?? ""),
            risks: String(attempt.risks ?? ""),
            executiveSummary: String(attempt.executiveSummary ?? ""),
            verificationNotes: String(attempt.verificationNotes ?? ""),
          });
          if (Array.isArray(attempt.chatTranscript) && attempt.chatTranscript.length) setMessages(attempt.chatTranscript as ChatMessage[]);
          setRemainingCalls(Math.max(0, 20 - Number(attempt.aiCallCount ?? 0)));
          if (attempt.round1Score != null) {
            const name = String(attempt.round1Band ?? "Novice");
            const bandNum = ({ Novice: "1", "Advanced Beginner": "2", Competent: "3", Proficient: "4", Expert: "5" } as Record<string, string>)[name] ?? "1";
            setRound1Result({ score: Number(attempt.round1Score), total: Number(attempt.round1Total ?? 36), overallPct: Math.round(Number(attempt.round1Score) / Number(attempt.round1Total ?? 36) * 100), band: { num: bandNum, name, desc: "Kết quả Round 1 đã được khôi phục từ database." }, tally: (attempt.round1Breakdown ?? {}) as Round1Tally, completedAt: String(attempt.lastSavedAt ?? stored.startedAt) });
          }
          if (attempt.graderResult) {
            setGrade(attempt.graderResult as AiGrade);
            setResultMessage("Bài làm và kết quả đã được khôi phục từ database.");
            setView("results");
            return;
          }
          const stage = String(attempt.currentStage ?? "round1");
          if (stage.startsWith("round2_step_")) {
            setRound2Step(Math.max(1, Math.min(3, Number(stage.at(-1)) || 1)) as Round2Step);
            setView("round2");
          } else if (stage === "round2_intro") setView("round2Intro");
          else setView("round1");
        })
        .catch(() => sessionStorage.removeItem("talemy-active-attempt"));
    } catch { sessionStorage.removeItem("talemy-active-attempt"); }
  }, []);

  const saveProgressRef = useRef(saveProgress);
  useEffect(() => { saveProgressRef.current = saveProgress; }, [saveProgress]);

  useEffect(() => {
    if (!deadline) return;
    const tick = () => setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  useEffect(() => {
    if (!attemptId || view === "landing" || view === "results") return;
    const timer = window.setInterval(() => { void saveProgressRef.current({ currentStage: view === "round2" ? `round2_step_${round2Step}` : view }); }, 30000);
    return () => window.clearInterval(timer);
  }, [attemptId, round2Step, view]);

  const submitAssessment = useCallback(async (autoSubmitted = false) => {
    if (!attemptId || submittedRef.current) return;
    submittedRef.current = true;
    setGrading(true);
    setError("");
    try {
      const response = await fetch(backendUrl("/api/ai/grade"), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attemptId, work, transcript: messages, timeSpentSeconds, autoSubmitted }),
      });
      const data = await response.json() as { grade?: AiGrade; error?: string };
      if (!response.ok || !data.grade) throw new Error(data.error || "Chưa thể chấm bài.");
      setGrade(data.grade);
      setResultMessage(autoSubmitted ? "Hết 60 phút — hệ thống đã tự động nộp phần bài làm hiện có." : "Bài làm đã được lưu và chấm bằng Talemy AI Grader.");
      setView("results");
      sessionStorage.removeItem("talemy-active-attempt");
    } catch (submissionError) {
      setError(submissionError instanceof Error ? submissionError.message : "Chưa thể chấm bài.");
      if (autoSubmitted) {
        setResultMessage("Hết 60 phút. Bài làm đã được lưu nhưng AI Grader đang chờ xử lý lại.");
        setView("results");
      }
    } finally {
      setGrading(false);
      submittedRef.current = false;
    }
  }, [attemptId, messages, timeSpentSeconds, work]);

  useEffect(() => {
    if (remaining !== 0 || !attemptId) return;
    if (view === "round1") {
      const frame = document.querySelector<HTMLIFrameElement>('iframe[title="Talemy AI Skill Test Round 1"]');
      frame?.contentWindow?.postMessage({ type: "talemy-force-submit" }, "*");
      return;
    }
    if (view === "round2Intro" || view === "round2") void submitAssessment(true);
  }, [attemptId, remaining, submitAssessment, view]);

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "talemy-round1-height" && Number.isFinite(event.data.height)) setRound1Height(Math.max(720, Number(event.data.height) + 12));
      if (event.data?.type !== "talemy-round1-result") return;
      const result = event.data.result as Round1Result;
      setRound1Result(result);
      void saveProgress({ currentStage: result.score >= 12 ? "round2_intro" : "screened_out", status: result.score >= 12 ? "in_progress" : remaining === 0 ? "timed_out" : "screened_out", round1Score: result.score, round1Total: result.total, round1Band: result.band.name, round1Breakdown: result.tally });
      if (remaining === 0) {
        if (result.score >= 12) void submitAssessment(true);
        else {
          setResultMessage("Hết 60 phút. Round 2 chưa được mở vì kết quả Round 1 dưới Advanced Beginner.");
          setView("results");
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [remaining, saveProgress, submitAssessment]);

  const startAssessment = async () => {
    if (!profile.name.trim() || !profile.role) { setError("Vui lòng nhập họ tên và chọn nhóm vai trò."); return; }
    setError("");
    setSaveState("saving");
    try {
      const response = await fetch(backendUrl("/api/attempts"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ candidateName: profile.name, candidateEmail: profile.email, candidateCode: profile.code, role: profile.role }) });
      const data = await response.json() as { attemptId?: string; startedAt?: string; expiresAt?: string; error?: string };
      if (!response.ok || !data.attemptId || !data.startedAt || !data.expiresAt) throw new Error(data.error || "Không thể tạo bài làm trong database.");
      setAttemptId(data.attemptId);
      setStartedAt(data.startedAt);
      const deadlineMs = new Date(data.expiresAt).getTime();
      setDeadline(deadlineMs);
      setRemaining(ASSESSMENT_DURATION_SECONDS);
      sessionStorage.setItem("talemy-active-attempt", JSON.stringify({ attemptId: data.attemptId, startedAt: data.startedAt, expiresAt: data.expiresAt, profile }));
      setView("round1");
      setSaveState("saved");
    } catch (startError) {
      setSaveState("error");
      setError(startError instanceof Error ? startError.message : "Không thể bắt đầu bài test.");
    }
  };

  const sendChat = async () => {
    const value = chatInput.trim();
    if (!value || chatBusy || remainingCalls <= 0 || !attemptId) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), role: "user", content: value, createdAt: new Date().toISOString() };
    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setChatInput("");
    setChatBusy(true);
    setChatError("");
    try {
      const response = await fetch(backendUrl("/api/ai/chat"), { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ attemptId, messages: nextMessages }) });
      const data = await response.json() as { message?: ChatMessage; remainingCalls?: number; error?: string };
      if (!response.ok || !data.message) throw new Error(data.error || "Talemy AI chưa thể phản hồi.");
      setMessages((current) => [...current, data.message!]);
      setRemainingCalls(data.remainingCalls ?? Math.max(0, remainingCalls - 1));
    } catch (chatFailure) {
      setChatError(chatFailure instanceof Error ? chatFailure.message : "Talemy AI chưa thể phản hồi.");
    } finally { setChatBusy(false); }
  };

  const nextRound2 = async () => {
    let validation = "";
    if (round2Step === 1 && work.delegationPlan.trim().length < 80) validation = "Hãy mô tả cách phân vai AI–con người tối thiểu 80 ký tự.";
    if (round2Step === 2 && (!messages.some((message) => message.role === "user") || work.keyFindings.trim().length < 150)) validation = "Hãy trao đổi ít nhất một lượt với Talemy AI và ghi tối thiểu 150 ký tự về các phát hiện chính.";
    if (round2Step === 3 && [work.recommendation, work.risks, work.executiveSummary, work.verificationNotes].some((value) => value.trim().length < 80)) validation = "Hãy hoàn thành mỗi phần tối thiểu 80 ký tự trước khi nộp.";
    if (validation) { setError(validation); return; }
    setError("");
    if (round2Step < 3) {
      await saveProgress({ currentStage: `round2_step_${round2Step + 1}` });
      setRound2Step((round2Step + 1) as Round2Step);
    } else await submitAssessment(false);
  };

  const resetAll = () => {
    sessionStorage.removeItem("talemy-active-attempt");
    setView("landing"); setProfile({ name: "", email: "", code: "", role: "" }); setAttemptId(""); setStartedAt(""); setDeadline(0); setRemaining(ASSESSMENT_DURATION_SECONDS); setRound1Result(null); setRound1Key((value) => value + 1); setRound2Step(1); setWork(emptyWork); setMessages(initialMessages); setGrade(null); setError(""); setResultMessage(""); setRemainingCalls(20);
  };

  if (view === "landing") return (
    <main className="site-shell landing-page">
      <header className="main-header"><Logo /><nav><a href="#journey">Cấu trúc bài test</a><a href={reviewerUrl()}>Dành cho người chấm ↗</a></nav></header>
      <section className="landing-hero">
        <div className="hero-copy"><p className="eyebrow orange">TALEMY · AI APPLICATION ASSESSMENT</p><h1>Hiểu AI là bước đầu.<br /><span>Biết phân tích cùng AI mới tạo ra quyết định tốt.</span></h1><p className="hero-lead">Bài đánh giá hai vòng đo nền tảng AI literacy và cách ứng viên dùng AI thật để phân tích dữ liệu, kiểm chứng insight và tổng hợp báo cáo quyết định.</p><div className="hero-facts"><div><strong>60</strong><span>phút cho toàn bài</span></div><div><strong>36</strong><span>câu hỏi Round 1</span></div><div><strong>03</strong><span>strengths Round 2</span></div></div></div>
        <aside className="candidate-card"><div className="card-label"><i /> BẮT ĐẦU BÀI ĐÁNH GIÁ</div><h2>Thông tin ứng viên</h2><p>Đồng hồ 60 phút bắt đầu ngay khi bạn nhấn nút bên dưới.</p><label>Họ và tên *<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} placeholder="Nguyễn Minh Anh" /></label><div className="two-inputs"><label>Email<input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} placeholder="email@company.com" /></label><label>Mã ứng viên<input value={profile.code} onChange={(event) => setProfile({ ...profile, code: event.target.value })} placeholder="TL-2401" /></label></div><label>Nhóm vai trò *<select value={profile.role} onChange={(event) => setProfile({ ...profile, role: event.target.value })}><option value="">Chọn nhóm vai trò</option><option>HR / Recruitment</option><option>Sales / Business Development</option><option>Marketing</option><option>Operations / Customer Service</option><option>Finance / Admin</option><option>Other knowledge work</option></select></label>{error && <p className="form-error" role="alert">{error}</p>}<button type="button" className="primary-button" onClick={startAssessment} disabled={saveState === "saving"}>{saveState === "saving" ? "Đang tạo bài làm…" : "Bắt đầu Round 1 · 60:00"} <span>→</span></button><p className="privacy-line">Bài làm, transcript AI và kết quả được lưu tập trung cho người chấm.</p></aside>
      </section>
      <section className="journey" id="journey"><article><div className="round-number">01</div><p className="eyebrow">AI LITERACY</p><h2>Round 1 · Hiểu AI</h2><p>Giữ nguyên 36 câu hỏi trắc nghiệm của MVP hiện tại. Từ Advanced Beginner sẽ mở Round 2.</p><span className="time-chip">~20 phút</span></article><div className="journey-arrow">→</div><article className="accent-card"><div className="round-number">02</div><p className="eyebrow">DATA-TO-DECISION</p><h2>Round 2 · Phân tích cùng AI</h2><p>Dùng ChatGPT thật để phân tích dataset, tìm vấn đề và viết báo cáo hỗ trợ quyết định.</p><span className="time-chip">Phần thời gian còn lại</span></article></section>
    </main>
  );

  if (view === "round1") return (
    <main className="assessment-shell"><header className="assessment-header"><Logo compact /><div><span>ROUND 1 / 2</span><strong>AI Literacy</strong></div><AssessmentTimer remaining={remaining} /></header><div className="round-progress"><span style={{ width: round1Result ? "50%" : "16%" }} /></div><section className="round-title-block"><p className="eyebrow orange">ROUND 1 · 36 CÂU HỎI MVP</p><h1>Nền tảng hiểu và sử dụng AI</h1><p>Round 1 giữ nguyên câu hỏi và cách tính band. Đồng hồ 60 phút áp dụng cho cả hai vòng.</p></section><div className="round1-frame-wrap"><iframe key={round1Key} src="./round1.html" title="Talemy AI Skill Test Round 1" style={{ height: `${round1Height}px` }} /></div>{round1Result && <section className={`unlock-card ${unlocked ? "unlocked" : "locked"}`}><div className="unlock-icon">{unlocked ? "✓" : "↺"}</div><div><p className="eyebrow">{unlocked ? "ROUND 2 ĐÃ MỞ" : "CHƯA MỞ ROUND 2"}</p><h2>{round1Result.band.name} · {round1Result.score}/{round1Result.total} câu đúng</h2><p>{unlocked ? "Bạn đạt từ Advanced Beginner và có thể tiếp tục phần phân tích dataset." : "Round 2 yêu cầu tối thiểu Advanced Beginner. Kết quả đã được lưu cho người chấm."}</p></div>{unlocked && remaining > 0 ? <button type="button" className="primary-button" onClick={() => { setView("round2Intro"); void saveProgress({ currentStage: "round2_intro" }); }}>Tiếp tục Round 2 <span>→</span></button> : remaining > 0 ? <button type="button" className="secondary-button" onClick={() => { setRound1Result(null); setRound1Key((value) => value + 1); }}>Làm lại Round 1</button> : null}</section>}</main>
  );

  if (view === "round2Intro") return (
    <main className="assessment-shell rubric-page"><header className="assessment-header"><Logo compact /><div><span>ROUND 2 / 2</span><strong>Data-to-Decision</strong></div><AssessmentTimer remaining={remaining} /></header><section className="rubric-hero"><div><p className="eyebrow orange">TRƯỚC KHI BẮT ĐẦU</p><h1>AI hỗ trợ phân tích. Bạn chịu trách nhiệm cho quyết định.</h1><p>Người chấm sẽ xem cả cách bạn phân vai, prompt, phản hồi AI, số liệu bạn chọn và báo cáo cuối.</p></div><div className="rubric-note"><strong>{formatTime(remaining)}</strong><span>thời gian còn lại</span></div></section><section className="rubric-grid">{(Object.keys(strengthMeta) as StrengthKey[]).map((key, index) => <article key={key}><span>0{index + 1}</span><h2>{strengthMeta[key].label}</h2><strong>{strengthMeta[key].short}</strong><p>{strengthMeta[key].description}</p></article>)}</section><section className="case-preview decision-case"><div><p className="eyebrow">BUSINESS CASE</p><h2>{businessBrief.title}</h2></div><ul><li>{businessBrief.budget}</li><li>{businessBrief.hiringGoal}</li><li>{businessBrief.qualityGoal}</li><li>{businessBrief.speedGoal}</li><li>{businessBrief.decision}</li></ul></section><div className="center-action"><button type="button" className="primary-button" onClick={() => { setRound2Step(1); setView("round2"); void saveProgress({ currentStage: "round2_step_1" }); }}>Bắt đầu phân tích <span>→</span></button></div><p className="rubric-disclaimer">Round 2 không chấm Diligence. Talemy AI không được cung cấp rubric hoặc đáp án mẫu trong lúc làm bài.</p></main>
  );

  if (view === "round2") return (
    <main className="assessment-shell round2-shell dataset-assessment"><header className="assessment-header"><Logo compact /><div><span>ROUND 2 / 2</span><strong>Data-to-Decision</strong></div><AssessmentTimer remaining={remaining} /></header><div className="round2-topline"><StepProgress active={round2Step} /><span>BƯỚC {round2Step} / 3</span><em className={`save-indicator ${saveState}`}>{saveState === "saving" ? "Đang lưu…" : saveState === "saved" ? "✓ Đã lưu database" : saveState === "error" ? "Lỗi lưu" : ""}</em></div><DatasetTable /><section className="round2-layout"><div className="task-column">
      {round2Step === 1 && <><p className="eyebrow orange">01 · DELEGATION</p><h1>Lập kế hoạch làm việc với AI</h1><p className="task-lead">Trước khi chat, hãy nói rõ phần nào bạn giao cho AI, phần nào bạn tự làm và cách bạn sẽ kiểm tra kết quả.</p><TextAreaField label="Kế hoạch phân vai AI–con người" hint="Ví dụ: AI tính metric và so sánh; tôi kiểm tra phép tính, cân nhắc trade-off và chốt khuyến nghị." min={80} rows={10} value={work.delegationPlan} onChange={(value) => updateWork("delegationPlan", value)} /><div className="simple-instructions"><strong>Keep in mind</strong><ul><li>AI phù hợp với tính toán, tổng hợp và phản biện giả định.</li><li>Con người chịu trách nhiệm cho ưu tiên kinh doanh và quyết định cuối.</li><li>Nêu cách bạn sẽ đối chiếu số liệu hoặc sửa đầu ra AI.</li></ul></div></>}
      {round2Step === 2 && <><p className="eyebrow orange">02 · DESCRIPTION</p><h1>Phân tích dataset cùng Talemy AI</h1><p className="task-lead">Dùng chatbox để tính metric, so sánh hiệu quả và đào sâu các điểm bất thường. AI không viết báo cáo cuối thay bạn.</p><div className="analysis-prompts"><span>Có thể bắt đầu bằng:</span><button type="button" onClick={() => setChatInput("Tính cost-per-hire, applicant-to-hire rate và offer-to-hire rate cho từng kênh. Nêu công thức và trình bày thành bảng.")}>Tính hiệu quả từng kênh</button><button type="button" onClick={() => setChatInput("Tìm 3 trade-off quan trọng giữa chi phí, tốc độ và retention. Chỉ dùng dữ liệu trong bảng và nêu giả định nếu có.")}>Tìm trade-off</button><button type="button" onClick={() => setChatInput("Hãy chất vấn các kết luận sơ bộ của tôi: metric nào có thể gây hiểu lầm vì dataset còn thiếu thông tin?")}>Chất vấn giả định</button></div><TextAreaField label="Các phát hiện chính của bạn" hint="Ghi ít nhất 3 findings, mỗi finding nên có số liệu hoặc phép tính làm bằng chứng." min={150} rows={11} value={work.keyFindings} onChange={(value) => updateWork("keyFindings", value)} /></>}
      {round2Step === 3 && <><p className="eyebrow orange">03 · DISCERNMENT</p><h1>Tổng hợp báo cáo hỗ trợ quyết định</h1><p className="task-lead">Bạn tự chốt khuyến nghị. Đừng chỉ sao chép AI — hãy kiểm tra số liệu, nêu trade-off và giới hạn dữ liệu.</p><TextAreaField label="Khuyến nghị và phân bổ" hint="Chọn tối đa 3 kênh, giải thích cách đáp ứng ngân sách, số hires, chất lượng và tốc độ." min={80} value={work.recommendation} onChange={(value) => updateWork("recommendation", value)} /><TextAreaField label="Rủi ro, trade-off và dữ liệu còn thiếu" hint="Điều gì có thể làm quyết định này sai hoặc chưa chắc chắn?" min={80} value={work.risks} onChange={(value) => updateWork("risks", value)} /><TextAreaField label="Executive summary" hint="Tóm tắt kết luận cho Hiring/Business Lead trong 5–8 câu." min={80} value={work.executiveSummary} onChange={(value) => updateWork("executiveSummary", value)} /><TextAreaField label="Bạn đã kiểm tra hoặc sửa AI như thế nào?" hint="Nêu phép tính, nhận định hoặc giả định AI đưa ra mà bạn đã đối chiếu." min={80} value={work.verificationNotes} onChange={(value) => updateWork("verificationNotes", value)} /></>}
      {error && <p className="form-error" role="alert">{error}</p>}<div className="task-actions"><button type="button" className="secondary-button" onClick={() => { setError(""); if (round2Step === 1) setView("round2Intro"); else setRound2Step((round2Step - 1) as Round2Step); }}>← Quay lại</button><button type="button" className="primary-button" onClick={nextRound2} disabled={grading}>{grading ? "Talemy AI đang chấm…" : round2Step === 3 ? "Nộp bài & xem kết quả" : "Lưu & tiếp tục"} <span>→</span></button></div>
    </div>{round2Step >= 2 ? <ChatPanel messages={messages} value={chatInput} busy={chatBusy} error={chatError} remainingCalls={remainingCalls} onChange={setChatInput} onSend={sendChat} /> : <aside className="ai-chat locked-chat"><div className="ai-avatar">AI</div><h3>Talemy AI sẽ mở ở bước 2</h3><p>Hoàn thành kế hoạch phân vai trước khi bắt đầu trao đổi với AI.</p></aside>}</section></main>
  );

  const overallBand = grade ? bandForScore(grade.overall) : null;
  return (
    <main className="assessment-shell results-page"><header className="assessment-header"><Logo compact /><div><span>HOÀN THÀNH</span><strong>Candidate Report</strong></div></header><section className="result-hero"><div><p className="eyebrow orange">TALEMY AI SKILL REPORT</p><h1>{profile.name}</h1><p>{profile.role}{profile.code ? ` · ${profile.code}` : ""}</p><div className="result-chips"><span>Round 1 · {round1Result?.band.name ?? "Chưa hoàn tất"}</span><span>Round 2 · {grade?.band ?? "Đang chờ chấm"}</span><span>{formatTime(Math.max(0, ASSESSMENT_DURATION_SECONDS - timeSpentSeconds))} còn lại</span></div></div>{grade ? <div className="overall-score"><ScoreRing score={grade.overall} /><div><span>ROUND 2</span><strong>{grade.band}</strong><p>{grade.bandReason}</p></div></div> : <div className="pending-grade"><div className="ai-avatar">AI</div><strong>Đang chờ AI Grader</strong><p>{error || resultMessage}</p></div>}</section>{resultMessage && <div className="result-alert">{resultMessage}</div>}
      <section className="round-summary-grid"><article><p className="eyebrow">ROUND 1 · AI LITERACY</p><h2>{round1Result ? `${round1Result.score}/${round1Result.total}` : "—"}</h2><strong>{round1Result ? `Band ${round1Result.band.num} · ${round1Result.band.name}` : "Chưa hoàn tất"}</strong><p>{round1Result?.band.desc}</p></article><article className="orange-card"><p className="eyebrow">ROUND 2 · DATA-TO-DECISION</p><h2>{grade ? `${grade.overall}/100` : "Pending"}</h2><strong>{overallBand ? `Band ${overallBand.level} · ${grade?.band}` : "Bài làm đã lưu"}</strong><p>Chỉ chấm Delegation, Description và Discernment; không chấm Diligence.</p></article></section>
      {grade && <><section className="result-section-head"><div><p className="eyebrow">WHY THIS BAND</p><h2>Vì sao bạn rơi vào band {grade.band}?</h2></div><p>{grade.bandReason}</p></section><section className="strength-results">{(Object.keys(strengthMeta) as StrengthKey[]).map((key, index) => { const result = grade.strengths[key]; const band = bandForScore(result.score); return <article key={key}><div className="strength-head"><span>0{index + 1}</span><div><h3>{strengthMeta[key].label}</h3><p>{result.summary}</p></div><ScoreRing score={result.score} small /></div><div className="band-row"><span>Band {band.level}/5</span><strong>{result.band}</strong></div><div className="feedback good"><h4>Điểm mạnh có bằng chứng</h4><ul>{result.strengths.map((item) => <li key={item}>{item}</li>)}</ul></div><div className="feedback improve"><h4>Điểm cần cải thiện</h4><ul>{result.gaps.map((item) => <li key={item}>{item}</li>)}</ul></div><details className="score-logic"><summary>Logic tính {result.score}/100</summary>{result.scoringBreakdown.map((item) => <div key={item.criterion}><span>{item.criterion}</span><strong>{item.awarded}/{item.max}</strong><p>{item.reason}</p></div>)}</details></article>; })}</section><section className="grader-note"><div className="ai-avatar">AI</div><div><p className="eyebrow orange">TALEMY AI GRADER · CONFIDENCE {grade.confidence.toUpperCase()}</p><h2>Đánh giá chất lượng quyết định</h2><p>{grade.decisionQuality}</p><strong>{grade.overallSynthesis}</strong></div></section></>}
      {!grade && error && <div className="center-action"><button type="button" className="primary-button" onClick={() => void submitAssessment(false)} disabled={grading}>{grading ? "Đang chấm lại…" : "Thử chấm lại"}</button></div>}<footer className="result-footer"><div><strong>{grade ? "✓ Bài làm, transcript và logic chấm đã lưu vào database" : "Bài làm đã lưu; kết quả AI đang chờ xử lý"}</strong><span>Không dùng điểm này làm căn cứ duy nhất cho quyết định tuyển dụng.</span></div><div><button type="button" className="secondary-button" onClick={() => window.print()}>In / Lưu PDF</button><button type="button" className="primary-button" onClick={resetAll}>Làm bài mới</button></div></footer>
    </main>
  );
}
