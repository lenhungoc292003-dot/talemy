"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type View = "landing" | "round1" | "round2Intro" | "round2" | "results";
type Round2Step = 1 | 2 | 3;
type DelegationChoice = "ai" | "collaborate" | "human" | "";
type StrengthKey = "delegation" | "description" | "discernment";

type Round1Tally = Record<
  "D" | "Desc" | "Disc" | "Dil",
  { correct: number; total: number; strengths: string[]; gaps: string[] }
>;

type Round1Result = {
  score: number;
  total: number;
  overallPct: number;
  band: { num: string; name: string; desc: string };
  tally: Round1Tally;
  completedAt: string;
};

type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  kind?: "help" | "draft";
};

const delegationTasks = [
  {
    id: "summary",
    title: "Tóm tắt ghi chú phỏng vấn thành 5 ý chính",
    note: "AI có thể hỗ trợ xử lý nội dung; con người cần kiểm tra lại ghi chú gốc.",
  },
  {
    id: "decision",
    title: "Quyết định ứng viên có được vào vòng tiếp theo",
    note: "Quyết định này ảnh hưởng trực tiếp đến ứng viên.",
  },
  {
    id: "draft",
    title: "Soạn bản nháp email cập nhật cho ứng viên",
    note: "Bản nháp chưa được gửi ra ngoài.",
  },
  {
    id: "send",
    title: "Kiểm tra thông tin và gửi email chính thức",
    note: "Email đại diện cho doanh nghiệp và phải đúng trạng thái tuyển dụng.",
  },
] as const;

const idealDelegation: Record<string, DelegationChoice> = {
  summary: "collaborate",
  decision: "human",
  draft: "collaborate",
  send: "human",
};

const descriptionSignals = [
  { id: "goal", label: "nói rõ cần soạn email follow-up", terms: ["email", "thư", "follow-up", "follow up", "phản hồi"] },
  { id: "name", label: "dùng đúng tên Trần Ngọc Lan", terms: ["trần ngọc lan", "ngọc lan"] },
  { id: "context", label: "nêu rõ chưa có quyết định tuyển dụng", terms: ["chưa có quyết định", "chưa quyết định", "đang xem xét", "đang review", "chưa có kết quả"] },
  { id: "timeline", label: "giữ cam kết 2 ngày làm việc", terms: ["2 ngày làm việc", "hai ngày làm việc", "2 ngày"] },
  { id: "tone", label: "yêu cầu giọng chuyên nghiệp và thân thiện", terms: ["chuyên nghiệp", "thân thiện", "ấm áp", "lịch sự", "tôn trọng"] },
  { id: "format", label: "nêu định dạng đầu ra", terms: ["tiêu đề", "subject", "bản nháp", "cấu trúc", "ngắn gọn"] },
];

const auditOptions = [
  { id: "wrongName", text: "AI dùng sai tên ứng viên: “Anh Minh” thay vì “Trần Ngọc Lan”.", correct: true },
  { id: "premature", text: "AI tự thông báo ứng viên đã vào vòng tiếp theo dù chưa có quyết định.", correct: true },
  { id: "timing", text: "AI đổi mốc phản hồi từ 2 ngày làm việc thành “cuối tuần này”.", correct: true },
  { id: "paragraphs", text: "Email có ba đoạn ngắn nên không thể sử dụng được.", correct: false },
];

const strengthMeta: Record<StrengthKey, { label: string; short: string; question: string }> = {
  delegation: {
    label: "Delegation",
    short: "Phân việc đúng",
    question: "Bạn có giao đúng phần việc cho AI và giữ đúng phần trách nhiệm cho con người?",
  },
  description: {
    label: "Description",
    short: "Brief rõ ràng",
    question: "Bạn có cung cấp đủ mục tiêu, bối cảnh và yêu cầu để AI tạo đầu ra hữu ích?",
  },
  discernment: {
    label: "Discernment",
    short: "Kiểm tra đầu ra",
    question: "Bạn có phát hiện lỗi quan trọng và sửa bản nháp dựa trên dữ kiện gốc?",
  },
};

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

const includesAny = (value: string, terms: string[]) => {
  const normalized = normalize(value);
  return terms.some((term) => normalized.includes(normalize(term)));
};

const bandForPct = (score: number) => {
  if (score >= 90) return { level: 5, name: "Expert", note: "Thể hiện hành vi ứng dụng AI nhất quán và có chủ đích." };
  if (score >= 75) return { level: 4, name: "Proficient", note: "Có quy trình làm việc rõ và chủ động chất vấn đầu ra AI." };
  if (score >= 60) return { level: 3, name: "Competent", note: "Ứng dụng AI tốt trong tình huống quen thuộc và có bước kiểm tra." };
  if (score >= 40) return { level: 2, name: "Advanced Beginner", note: "Đã có nền tảng nhưng một số hành vi chưa ổn định." };
  return { level: 1, name: "Novice", note: "Cần thêm hướng dẫn và thực hành theo quy trình." };
};

const initialChat: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    kind: "help",
    content:
      "Chào bạn, mình là Talemy AI. Ở Round 2, bạn có thể brief cho mình như khi làm việc thật. Mình sẽ tạo bản nháp để bạn kiểm tra — đầu ra có thể có lỗi.",
  },
];

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`logo-lockup ${compact ? "compact" : ""}`}>
      <img src="./talemy-logo.png" alt="Talemy" />
      <span>AI Skill Test</span>
    </div>
  );
}

function ScoreRing({ score, small = false }: { score: number; small?: boolean }) {
  const style = { "--score": `${Math.max(0, Math.min(100, score)) * 3.6}deg` } as React.CSSProperties;
  return (
    <div className={`score-ring ${small ? "small" : ""}`} style={style}>
      <div><strong>{score}</strong><span>/100</span></div>
    </div>
  );
}

function StepDots({ active }: { active: Round2Step }) {
  return (
    <div className="step-dots" aria-label={`Bước ${active} trên 3`}>
      {[1, 2, 3].map((step) => (
        <span key={step} className={step <= active ? "active" : ""}>{step}</span>
      ))}
    </div>
  );
}

function AiChat({
  messages,
  input,
  setInput,
  onSend,
}: {
  messages: ChatMessage[];
  input: string;
  setInput: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <aside className="ai-chat" aria-label="Talemy AI chatbox">
      <div className="chat-head">
        <div className="ai-avatar">AI</div>
        <div><strong>Talemy AI</strong><span><i /> Sẵn sàng hỗ trợ</span></div>
      </div>
      <div className="chat-context">
        <strong>Case đang làm</strong>
        <span>Email follow-up sau phỏng vấn</span>
      </div>
      <div className="chat-messages" aria-live="polite">
        {messages.map((message) => (
          <div key={message.id} className={`chat-message ${message.role}`}>
            <span>{message.role === "assistant" ? "Talemy AI" : "Bạn"}</span>
            <p>{message.content}</p>
          </div>
        ))}
      </div>
      <div className="chat-compose">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          placeholder="Nhập brief hoặc hỏi Talemy AI..."
          rows={4}
        />
        <div><span>{input.length} ký tự</span><button type="button" onClick={onSend} disabled={!input.trim()}>Gửi ↗</button></div>
      </div>
      <p className="chat-note">Nội dung chat được dùng làm bằng chứng cho Description.</p>
    </aside>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("landing");
  const [profile, setProfile] = useState({ name: "", email: "", code: "", role: "" });
  const [error, setError] = useState("");
  const [round1Result, setRound1Result] = useState<Round1Result | null>(null);
  const [round1Height, setRound1Height] = useState(760);
  const [round1Key, setRound1Key] = useState(0);
  const [round2Step, setRound2Step] = useState<Round2Step>(1);
  const [delegation, setDelegation] = useState<Record<string, DelegationChoice>>({});
  const [messages, setMessages] = useState<ChatMessage[]>(initialChat);
  const [chatInput, setChatInput] = useState("");
  const [aiDraft, setAiDraft] = useState("");
  const [audits, setAudits] = useState<string[]>([]);
  const [revision, setRevision] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "local">("idle");
  const savedNoviceRef = useRef(false);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || !event.data) return;
      if (event.data.type === "talemy-round1-height") {
        setRound1Height(Math.max(720, Math.min(4400, Number(event.data.height) || 760)));
      }
      if (event.data.type === "talemy-round1-result") {
        setRound1Result(event.data as Round1Result);
        window.setTimeout(() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }), 120);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [view, round2Step]);

  const userPrompt = useMemo(
    () => messages.filter((message) => message.role === "user" && message.kind !== "help").map((message) => message.content).join("\n"),
    [messages],
  );

  const round2Results = useMemo(() => {
    const delegationHits = delegationTasks.filter((task) => delegation[task.id] === idealDelegation[task.id]);
    const delegationScore = Math.round((delegationHits.length / delegationTasks.length) * 100);

    const descriptionHits = descriptionSignals.filter((signal) => includesAny(userPrompt, signal.terms));
    const descriptionScore = Math.round((descriptionHits.length / descriptionSignals.length) * 100);

    const correctAuditIds = auditOptions.filter((option) => option.correct).map((option) => option.id);
    const correctAuditHits = audits.filter((id) => correctAuditIds.includes(id)).length;
    const falseAuditHits = audits.filter((id) => !correctAuditIds.includes(id)).length;
    const auditScore = Math.max(0, Math.min(65, correctAuditHits * (65 / correctAuditIds.length) - falseAuditHits * 16));
    const revisionSignals = [
      includesAny(revision, ["trần ngọc lan", "ngọc lan"]),
      includesAny(revision, ["chưa có quyết định", "đang xem xét", "đang review", "chưa có kết quả"]),
      includesAny(revision, ["2 ngày làm việc", "hai ngày làm việc", "2 ngày"]),
      includesAny(revision, ["cảm ơn", "trân trọng", "thân mến"]),
    ];
    const revisionScore = (revisionSignals.filter(Boolean).length / revisionSignals.length) * 35;
    const discernmentScore = Math.round(Math.min(100, auditScore + revisionScore));

    const scores: Record<StrengthKey, number> = {
      delegation: delegationScore,
      description: descriptionScore,
      discernment: discernmentScore,
    };
    const overall = Math.round((delegationScore + descriptionScore + discernmentScore) / 3);

    const feedback: Record<StrengthKey, { strengths: string[]; gaps: string[]; reasons: string[] }> = {
      delegation: {
        strengths: delegationHits.map((task) => `Phân vai phù hợp: ${task.title}.`).slice(0, 3),
        gaps: delegationTasks.filter((task) => delegation[task.id] !== idealDelegation[task.id]).map((task) => `Xem lại cách phân vai cho: ${task.title}.`).slice(0, 3),
        reasons: delegationTasks.map((task) => `${task.title}: chọn ${delegation[task.id] || "chưa chọn"}; rubric ${idealDelegation[task.id]}.`),
      },
      description: {
        strengths: descriptionHits.map((signal) => `Brief đã ${signal.label}.`).slice(0, 3),
        gaps: descriptionSignals.filter((signal) => !descriptionHits.includes(signal)).map((signal) => `Nên ${signal.label}.`).slice(0, 3),
        reasons: descriptionSignals.map((signal) => `${signal.label}: ${descriptionHits.includes(signal) ? "có bằng chứng" : "chưa thấy"}.`),
      },
      discernment: {
        strengths: [
          ...(audits.includes("wrongName") ? ["Phát hiện AI dùng sai tên ứng viên."] : []),
          ...(audits.includes("premature") ? ["Không chấp nhận kết luận tuyển dụng do AI tự thêm."] : []),
          ...(audits.includes("timing") ? ["Đối chiếu đúng mốc thời gian với dữ kiện gốc."] : []),
          ...(revisionSignals.filter(Boolean).length >= 3 ? ["Bản sửa cuối khôi phục phần lớn thông tin quan trọng."] : []),
        ].slice(0, 3),
        gaps: [
          ...(!audits.includes("wrongName") ? ["Cần kiểm tra tên và dữ kiện nhận diện trước khi gửi."] : []),
          ...(!audits.includes("premature") ? ["Cần phát hiện khi AI tự suy diễn kết quả tuyển dụng."] : []),
          ...(!audits.includes("timing") ? ["Cần đối chiếu cam kết thời gian với brief gốc."] : []),
          ...(falseAuditHits ? ["Có đánh dấu một điểm không phải lỗi; nên phân biệt lỗi thực tế với lựa chọn phong cách."] : []),
          ...(revisionSignals.filter(Boolean).length < 3 ? ["Bản sửa cuối còn thiếu dữ kiện quan trọng của case."] : []),
        ].slice(0, 3),
        reasons: [
          `Phát hiện đúng ${correctAuditHits}/${correctAuditIds.length} lỗi; đánh dấu sai ${falseAuditHits}.`,
          `Bản sửa giữ được ${revisionSignals.filter(Boolean).length}/4 dữ kiện bắt buộc.`,
        ],
      },
    };

    (Object.keys(feedback) as StrengthKey[]).forEach((key) => {
      if (!feedback[key].strengths.length) feedback[key].strengths.push("Chưa có đủ bằng chứng hành vi mạnh ở phần này.");
      if (!feedback[key].gaps.length) feedback[key].gaps.push("Tiếp tục kiểm tra kỹ năng trên một case mới để xác nhận tính ổn định.");
    });

    return { scores, overall, feedback, descriptionHits, delegationHits, correctAuditHits, falseAuditHits, revisionSignals };
  }, [audits, delegation, revision, userPrompt]);

  const saveSubmission = async (includeRound2: boolean) => {
    if (!round1Result) return;
    setSaveStatus("saving");
    const payload = {
      candidateName: profile.name,
      candidateEmail: profile.email,
      candidateCode: profile.code,
      role: profile.role,
      round1Score: round1Result.score,
      round1Total: round1Result.total,
      round1Band: round1Result.band.name,
      round1Breakdown: round1Result.tally,
      round2Overall: includeRound2 ? round2Results.overall : null,
      round2Scores: includeRound2 ? round2Results.scores : null,
      round2Feedback: includeRound2 ? round2Results.feedback : null,
      round2Answers: includeRound2 ? { delegation, audits, revision, aiDraft } : null,
      chatTranscript: includeRound2 ? messages : null,
      gradingVersion: "talemy-r2-3d-v1",
      completedAt: new Date().toISOString(),
    };
    try {
      const response = await fetch("api/submissions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error("save failed");
      setSaveStatus("saved");
    } catch {
      const local = JSON.parse(window.localStorage.getItem("talemy-submissions") || "[]") as unknown[];
      window.localStorage.setItem("talemy-submissions", JSON.stringify([payload, ...local].slice(0, 20)));
      setSaveStatus("local");
    }
  };

  useEffect(() => {
    if (round1Result && round1Result.score < 12 && !savedNoviceRef.current) {
      savedNoviceRef.current = true;
      void saveSubmission(false);
    }
    // saveSubmission is intentionally triggered once for a completed Novice attempt.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round1Result]);

  const startRound1 = () => {
    if (!profile.name.trim() || !profile.role) {
      setError("Vui lòng nhập họ tên và chọn nhóm vai trò trước khi bắt đầu.");
      return;
    }
    setError("");
    setRound1Result(null);
    setView("round1");
  };

  const resetAll = () => {
    setView("landing");
    setRound1Result(null);
    setRound1Key((value) => value + 1);
    setRound2Step(1);
    setDelegation({});
    setMessages(initialChat);
    setChatInput("");
    setAiDraft("");
    setAudits([]);
    setRevision("");
    setError("");
    setSaveStatus("idle");
    savedNoviceRef.current = false;
  };

  const sendChat = () => {
    const content = chatInput.trim();
    if (!content) return;
    const asksForHelp = includesAny(content, ["làm gì", "hướng dẫn", "rubric", "giải thích đề", "yêu cầu là gì"]);
    const userMessage: ChatMessage = {
      id: `u-${Date.now()}`,
      role: "user",
      content,
      kind: asksForHelp ? "help" : "draft",
    };
    if (asksForHelp) {
      setMessages((current) => [...current, userMessage, {
        id: `a-${Date.now()}`,
        role: "assistant",
        kind: "help",
        content: "Bạn hãy giao cho mình một brief như khi làm việc thật: cần viết gì, cho ai, dựa trên dữ kiện nào, giọng điệu ra sao và điều gì không được tự suy diễn. Mình không thể cho bạn đáp án rubric.",
      }]);
    } else {
      const draft = "Tiêu đề: Chúc mừng bạn đã vượt qua vòng phỏng vấn\n\nChào Anh Minh,\n\nCảm ơn bạn đã dành thời gian phỏng vấn cho vị trí Business Development Consultant. Chúng tôi rất vui thông báo bạn sẽ được mời vào vòng tiếp theo.\n\nĐội ngũ tuyển dụng sẽ liên hệ lại với bạn vào cuối tuần này.\n\nTrân trọng,\nTalemy Recruitment Team";
      setAiDraft(draft);
      setMessages((current) => [...current, userMessage, {
        id: `a-${Date.now()}`,
        role: "assistant",
        kind: "draft",
        content: `Mình đã tạo bản nháp dưới đây. Hãy kiểm tra lại trước khi dùng:\n\n${draft}`,
      }]);
    }
    setChatInput("");
  };

  const nextRound2 = () => {
    let message = "";
    if (round2Step === 1 && delegationTasks.some((task) => !delegation[task.id])) {
      message = "Hãy chọn cách phân vai cho đủ 4 đầu việc.";
    }
    if (round2Step === 2 && (!aiDraft || userPrompt.trim().length < 40)) {
      message = "Hãy gửi cho Talemy AI một brief tối thiểu 40 ký tự để tạo bản nháp.";
    }
    if (round2Step === 3 && (!audits.length || revision.trim().length < 80)) {
      message = "Hãy đánh dấu ít nhất một vấn đề và viết bản sửa tối thiểu 80 ký tự.";
    }
    if (message) {
      setError(message);
      return;
    }
    setError("");
    if (round2Step < 3) {
      setRound2Step((round2Step + 1) as Round2Step);
      return;
    }
    setView("results");
    void saveSubmission(true);
  };

  if (view === "landing") {
    return (
      <main className="site-shell landing-page">
        <header className="main-header">
          <Logo />
          <nav><a href="#journey">Cấu trúc bài test</a><a href="./reviewer/">Dành cho người chấm ↗</a></nav>
        </header>

        <section className="landing-hero">
          <div className="hero-copy">
            <p className="eyebrow orange">TALEMY · AI APPLICATION ASSESSMENT</p>
            <h1>Hiểu AI là bước đầu.<br /><span>Làm việc tốt với AI mới là năng lực.</span></h1>
            <p className="hero-lead">Một bài đánh giá hai vòng dành cho người đi làm: đo nền tảng AI literacy trước, sau đó quan sát cách ứng viên thực sự phân việc, brief và kiểm tra đầu ra AI.</p>
            <div className="hero-facts">
              <div><strong>02</strong><span>round liên tiếp</span></div>
              <div><strong>36</strong><span>câu hỏi Round 1</span></div>
              <div><strong>03</strong><span>strengths ở Round 2</span></div>
            </div>
          </div>

          <aside className="candidate-card">
            <div className="card-label"><i /> BẮT ĐẦU BÀI ĐÁNH GIÁ</div>
            <h2>Thông tin ứng viên</h2>
            <p>Thông tin này giúp Talemy gắn kết quả với đúng người làm bài.</p>
            <label>Họ và tên *<input value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })} placeholder="Nguyễn Minh Anh" /></label>
            <div className="two-inputs">
              <label>Email <input type="email" value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })} placeholder="email@company.com" /></label>
              <label>Mã ứng viên <input value={profile.code} onChange={(event) => setProfile({ ...profile, code: event.target.value })} placeholder="TL-2401" /></label>
            </div>
            <label>Nhóm vai trò *
              <select value={profile.role} onChange={(event) => setProfile({ ...profile, role: event.target.value })}>
                <option value="">Chọn nhóm vai trò</option>
                <option>HR / Recruitment</option>
                <option>Sales / Business Development</option>
                <option>Marketing</option>
                <option>Operations / Customer Service</option>
                <option>Finance / Admin</option>
                <option>Other knowledge work</option>
              </select>
            </label>
            {error && <p className="form-error" role="alert">{error}</p>}
            <button type="button" className="primary-button" onClick={startRound1}>Bắt đầu Round 1 <span>→</span></button>
            <p className="privacy-line">Kết quả được dùng cho mục đích đánh giá năng lực và pilot sản phẩm Talemy.</p>
          </aside>
        </section>

        <section className="journey" id="journey">
          <article>
            <div className="round-number">01</div>
            <p className="eyebrow">AI LITERACY</p>
            <h2>Round 1 · Hiểu AI</h2>
            <p>Giữ nguyên 36 câu hỏi trắc nghiệm từ phiên bản MVP hiện tại. Kết quả trả về band và nhận xét theo 4D.</p>
            <span className="time-chip">~20 phút</span>
          </article>
          <div className="journey-arrow">→</div>
          <article className="accent-card">
            <div className="round-number">02</div>
            <p className="eyebrow">AI APPLICATION</p>
            <h2>Round 2 · Làm việc với AI</h2>
            <p>Mở khóa từ Advanced Beginner. Một case ngắn, có Talemy AI chatbox và kết quả thực hành ngay sau khi nộp.</p>
            <span className="time-chip">~15 phút</span>
          </article>
        </section>
      </main>
    );
  }

  if (view === "round1") {
    const unlocked = Boolean(round1Result && round1Result.score >= 12);
    return (
      <main className="assessment-shell">
        <header className="assessment-header"><Logo compact /><div><span>ROUND 1 / 2</span><strong>AI Literacy</strong></div></header>
        <div className="round-progress"><span style={{ width: round1Result ? "50%" : "16%" }} /></div>
        <section className="round-title-block">
          <p className="eyebrow orange">ROUND 1 · GIỮ NGUYÊN NGÂN HÀNG CÂU HỎI MVP</p>
          <h1>Nền tảng hiểu và sử dụng AI</h1>
          <p>Trả lời theo phản xạ đầu tiên. Kết quả, band và nhận xét bên dưới được giữ theo đúng phiên bản bạn đã nhận.</p>
        </section>
        <div className="round1-frame-wrap">
          <iframe key={round1Key} src="./round1.html" title="Talemy AI Skill Test Round 1" style={{ height: `${round1Height}px` }} />
        </div>
        {round1Result && (
          <section className={`unlock-card ${unlocked ? "unlocked" : "locked"}`}>
            <div className="unlock-icon">{unlocked ? "✓" : "↺"}</div>
            <div>
              <p className="eyebrow">{unlocked ? "ROUND 2 ĐÃ MỞ" : "CHƯA MỞ ROUND 2"}</p>
              <h2>{round1Result.band.name} · {round1Result.score}/{round1Result.total} câu đúng</h2>
              <p>{unlocked ? "Bạn đã đạt từ Advanced Beginner trở lên và có thể tiếp tục phần thực hành." : "Round 2 yêu cầu tối thiểu Advanced Beginner. Bạn có thể xem lại nhận xét và làm lại Round 1."}</p>
            </div>
            {unlocked ? (
              <button type="button" className="primary-button" onClick={() => setView("round2Intro")}>Tiếp tục Round 2 <span>→</span></button>
            ) : (
              <button type="button" className="secondary-button" onClick={() => { setRound1Result(null); setRound1Key((value) => value + 1); }}>Làm lại Round 1</button>
            )}
          </section>
        )}
      </main>
    );
  }

  if (view === "round2Intro") {
    return (
      <main className="assessment-shell rubric-page">
        <header className="assessment-header"><Logo compact /><div><span>ROUND 2 / 2</span><strong>AI Application</strong></div></header>
        <section className="rubric-hero">
          <div>
            <p className="eyebrow orange">TRƯỚC KHI BẮT ĐẦU</p>
            <h1>Bạn sẽ được chấm dựa trên điều gì?</h1>
            <p>Giữ ba điều này trong đầu khi làm bài. Talemy AI sẽ chấm lựa chọn, nội dung chat và bản sửa cuối của bạn.</p>
          </div>
          <div className="rubric-note"><strong>15 phút</strong><span>Không cần tài khoản AI khác</span></div>
        </section>
        <section className="rubric-grid">
          {(Object.keys(strengthMeta) as StrengthKey[]).map((key, index) => (
            <article key={key}>
              <span>0{index + 1}</span>
              <h2>{strengthMeta[key].label}</h2>
              <strong>{strengthMeta[key].short}</strong>
              <p>{strengthMeta[key].question}</p>
            </article>
          ))}
        </section>
        <section className="case-preview">
          <div><p className="eyebrow">CASE DUY NHẤT</p><h2>Follow-up ứng viên sau phỏng vấn</h2></div>
          <ul>
            <li>Bạn vừa phỏng vấn một ứng viên cho vị trí Business Development Consultant.</li>
            <li>Hiring Manager chưa đưa ra quyết định cuối cùng.</li>
            <li>Ứng viên cần nhận cập nhật trong vòng 2 ngày làm việc.</li>
          </ul>
        </section>
        <div className="center-action"><button type="button" className="primary-button" onClick={() => { setRound2Step(1); setView("round2"); }}>Tôi đã hiểu · Bắt đầu <span>→</span></button></div>
        <p className="rubric-disclaimer">Round 2 không chấm Diligence. Kết quả chỉ gồm Delegation, Description và Discernment.</p>
      </main>
    );
  }

  if (view === "round2") {
    return (
      <main className="assessment-shell round2-shell">
        <header className="assessment-header"><Logo compact /><div><span>ROUND 2 / 2</span><strong>AI Application</strong></div></header>
        <div className="round2-topline"><StepDots active={round2Step} /><span>BƯỚC {round2Step} / 3</span></div>
        <section className="round2-layout">
          <div className="task-column">
            {round2Step === 1 && (
              <>
                <p className="eyebrow orange">01 · DELEGATION</p>
                <h1>Phần nào giao cho AI?</h1>
                <p className="task-lead">Chọn cách làm phù hợp nhất cho từng đầu việc. “Phối hợp” nghĩa là AI hỗ trợ và con người kiểm tra.</p>
                <div className="delegation-list">
                  {delegationTasks.map((task, index) => (
                    <article key={task.id}>
                      <div><span>0{index + 1}</span><h2>{task.title}</h2><p>{task.note}</p></div>
                      <div className="choice-segment" role="group" aria-label={task.title}>
                        {(["ai", "collaborate", "human"] as DelegationChoice[]).map((choice) => (
                          <button type="button" key={choice} className={delegation[task.id] === choice ? "active" : ""} onClick={() => setDelegation({ ...delegation, [task.id]: choice })}>
                            {choice === "ai" ? "AI tự làm" : choice === "collaborate" ? "Phối hợp" : "Con người"}
                          </button>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}

            {round2Step === 2 && (
              <>
                <p className="eyebrow orange">02 · DESCRIPTION</p>
                <h1>Brief cho Talemy AI</h1>
                <p className="task-lead">Dùng chatbox bên cạnh để yêu cầu AI soạn email follow-up. Viết như khi bạn đang làm việc thật.</p>
                <div className="source-card">
                  <div className="source-title"><span>CASE FACTS</span><strong>Chỉ dùng các thông tin dưới đây</strong></div>
                  <dl>
                    <div><dt>Ứng viên</dt><dd>Trần Ngọc Lan</dd></div>
                    <div><dt>Vị trí</dt><dd>Business Development Consultant</dd></div>
                    <div><dt>Trạng thái</dt><dd>Chưa có quyết định cuối cùng</dd></div>
                    <div><dt>Cam kết</dt><dd>Cập nhật trong 2 ngày làm việc</dd></div>
                  </dl>
                </div>
                <div className="simple-instructions">
                  <strong>Việc của bạn</strong>
                  <ol><li>Gửi một brief cho Talemy AI trong chatbox.</li><li>Đọc bản nháp AI trả về.</li><li>Tiếp tục khi bạn đã có bản nháp để kiểm tra.</li></ol>
                </div>
                {aiDraft && <div className="draft-ready"><span>✓</span><div><strong>Đã có bản nháp</strong><p>Bạn có thể tiếp tục sang bước kiểm tra.</p></div></div>}
              </>
            )}

            {round2Step === 3 && (
              <>
                <p className="eyebrow orange">03 · DISCERNMENT</p>
                <h1>Kiểm tra trước khi gửi</h1>
                <p className="task-lead">Đối chiếu bản nháp với Case Facts. Đánh dấu tất cả vấn đề thực sự cần sửa.</p>
                <div className="draft-card"><span>AI DRAFT</span><pre>{aiDraft}</pre></div>
                <div className="audit-list">
                  {auditOptions.map((option) => (
                    <button type="button" key={option.id} className={audits.includes(option.id) ? "selected" : ""} onClick={() => setAudits((current) => current.includes(option.id) ? current.filter((id) => id !== option.id) : [...current, option.id])}>
                      <i>{audits.includes(option.id) ? "✓" : ""}</i><span>{option.text}</span>
                    </button>
                  ))}
                </div>
                <label className="revision-field">Viết lại email cuối cùng
                  <textarea value={revision} onChange={(event) => setRevision(event.target.value)} rows={9} placeholder="Tiêu đề: ...\n\nChào Ngọc Lan,..." />
                  <span>{revision.length} ký tự · tối thiểu 80</span>
                </label>
              </>
            )}

            {error && <p className="form-error" role="alert">{error}</p>}
            <div className="task-actions">
              <button type="button" className="secondary-button" onClick={() => { setError(""); if (round2Step === 1) setView("round2Intro"); else setRound2Step((round2Step - 1) as Round2Step); }}>← Quay lại</button>
              <button type="button" className="primary-button" onClick={nextRound2}>{round2Step === 3 ? "Nộp bài & xem điểm" : "Tiếp tục"} <span>→</span></button>
            </div>
          </div>
          <AiChat messages={messages} input={chatInput} setInput={setChatInput} onSend={sendChat} />
        </section>
      </main>
    );
  }

  const overallBand = bandForPct(round2Results.overall);
  const sortedStrengths = (Object.keys(round2Results.scores) as StrengthKey[]).sort((a, b) => round2Results.scores[b] - round2Results.scores[a]);
  return (
    <main className="assessment-shell results-page">
      <header className="assessment-header"><Logo compact /><div><span>HOÀN THÀNH</span><strong>Candidate Report</strong></div></header>
      <section className="result-hero">
        <div>
          <p className="eyebrow orange">TALEMY AI SKILL REPORT</p>
          <h1>{profile.name}</h1>
          <p>{profile.role}{profile.code ? ` · ${profile.code}` : ""}</p>
          <div className="result-chips"><span>Round 1 · {round1Result?.band.name}</span><span>Round 2 · {overallBand.name}</span></div>
        </div>
        <div className="overall-score"><ScoreRing score={round2Results.overall} /><div><span>ROUND 2</span><strong>{overallBand.name}</strong><p>{overallBand.note}</p></div></div>
      </section>

      <section className="round-summary-grid">
        <article><p className="eyebrow">ROUND 1 · AI LITERACY</p><h2>{round1Result?.score}/{round1Result?.total}</h2><strong>Band {round1Result?.band.num} · {round1Result?.band.name}</strong><p>{round1Result?.band.desc}</p></article>
        <article className="orange-card"><p className="eyebrow">ROUND 2 · AI APPLICATION</p><h2>{round2Results.overall}/100</h2><strong>Band {overallBand.level} · {overallBand.name}</strong><p>Chấm trên ba năng lực thực hành; không bao gồm Diligence.</p></article>
      </section>

      <section className="result-section-head"><div><p className="eyebrow">3-STRENGTH PROFILE</p><h2>Bạn đã làm tốt và cần cải thiện điều gì?</h2></div><p>Kết quả được tạo ngay từ lựa chọn, nội dung chat, lỗi bạn phát hiện và email bạn sửa.</p></section>
      <section className="strength-results">
        {(Object.keys(strengthMeta) as StrengthKey[]).map((key, index) => {
          const score = round2Results.scores[key];
          const band = bandForPct(score);
          return (
            <article key={key}>
              <div className="strength-head"><span>0{index + 1}</span><div><h3>{strengthMeta[key].label}</h3><p>{strengthMeta[key].short}</p></div><ScoreRing score={score} small /></div>
              <div className="band-row"><span>Band {band.level}/5</span><strong>{band.name}</strong></div>
              <div className="feedback good"><h4>Điểm mạnh đã thể hiện</h4><ul>{round2Results.feedback[key].strengths.map((item) => <li key={item}>{item}</li>)}</ul></div>
              <div className="feedback improve"><h4>Điểm cần cải thiện</h4><ul>{round2Results.feedback[key].gaps.map((item) => <li key={item}>{item}</li>)}</ul></div>
            </article>
          );
        })}
      </section>

      <section className="grader-note">
        <div className="ai-avatar">AI</div>
        <div><p className="eyebrow orange">TALEMY AI GRADER</p><h2>Vì sao bạn nhận mức điểm này?</h2><p>Năng lực nổi bật nhất là <strong>{strengthMeta[sortedStrengths[0]].label}</strong> ({round2Results.scores[sortedStrengths[0]]}/100). Ưu tiên phát triển là <strong>{strengthMeta[sortedStrengths[2]].label}</strong> ({round2Results.scores[sortedStrengths[2]]}/100). Người chấm có thể xem đầy đủ lựa chọn, transcript chat, bản sửa và lý do tính điểm trong Reviewer Center.</p></div>
      </section>

      <footer className="result-footer">
        <div><strong>{saveStatus === "saved" ? "✓ Kết quả đã lưu cho người chấm" : saveStatus === "saving" ? "Đang lưu kết quả..." : saveStatus === "local" ? "Kết quả đang được lưu tạm trên thiết bị này" : "Kết quả đã được tạo"}</strong><span>Không dùng điểm này như căn cứ duy nhất cho quyết định tuyển dụng.</span></div>
        <div><button type="button" className="secondary-button" onClick={() => window.print()}>In / Lưu PDF</button><button type="button" className="primary-button" onClick={resetAll}>Làm bài mới</button></div>
      </footer>
    </main>
  );
}
