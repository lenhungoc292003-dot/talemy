"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ASSESSMENT_DURATION_SECONDS,
  ASSESSMENT_VERSION,
  DELEGATION_PART1_SECONDS,
  bandForScore,
  cleanAiText,
  delegationQuestions,
  descriptionTasks,
  discernmentScenario,
  formatTime,
  normalizeLegacyBand,
  round1StrengthScores,
  strengthMeta,
  type ChatMessage,
  type DelegationAnswer,
  type DelegationResult,
  type DescriptionTaskKey,
  type DescriptionWork,
  type DiscernmentFinding,
  type FinalAssessmentResult,
  type Round1Result,
  type StrengthKey,
} from "../lib/assessment";

type View =
  | "landing"
  | "round1"
  | "round2Intro"
  | "delegationPart1"
  | "delegationTransition"
  | "delegationPart2"
  | "delegationResult"
  | "description"
  | "discernment"
  | "results";

type Profile = { name: string; email: string; code: string; role: string };
type SaveState = "idle" | "saving" | "saved" | "error";
type HintMap = Record<string, string>;

const API_ORIGINS = [
  "https://talemy-secure-api-gateway.pages.dev",
  "https://talemy-secure-api-proxy.talemy-ngo-2026.workers.dev",
] as const;

const API_CONNECTION_ERROR =
  "Chưa thể kết nối với hệ thống Talemy. Bài làm trên thiết bị vẫn được giữ; vui lòng thử lại sau vài giây.";

const emptyDescriptionWork: DescriptionWork = {
  description_a: { finalPrompt: "", finalPlan: "", reflection: "", messages: [] },
  description_b: { finalPrompt: "", finalPlan: "", reflection: "", messages: [] },
};

const initialFindings = (): DiscernmentFinding[] => [
  { id: crypto.randomUUID(), problem: "", why: "", improvement: "" },
];

function backendUrls(path: string) {
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  const isLocal =
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "";
  const direct = API_ORIGINS.map((origin) => `${origin}${path}`);
  return isLocal ? [...direct, path] : direct;
}

async function apiRequest<T>(
  path: string,
  init?: RequestInit,
  timeoutMs = path.includes("/api/ai/") ? 55_000 : 18_000,
): Promise<T> {
  let lastError = new Error(API_CONNECTION_ERROR);
  for (const url of backendUrls(path)) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
        });
        window.clearTimeout(timer);
        const data = (await response.json().catch(() => null)) as
          | (T & { error?: string })
          | null;
        if (response.ok && data) return data;
        lastError = new Error(data?.error || API_CONNECTION_ERROR);
        if (response.status < 500 && response.status !== 408) throw lastError;
      } catch (error) {
        window.clearTimeout(timer);
        if (
          error instanceof Error &&
          error.message &&
          error.name !== "AbortError"
        ) {
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

function reviewerUrl() {
  return typeof window !== "undefined" &&
    window.location.hostname.endsWith("github.io")
    ? "./reviewer/"
    : "/reviewer";
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`logo-lockup ${compact ? "compact" : ""}`}>
      <img src="./talemy-logo.png" alt="Talemy" />
      <span>AI Skill Test</span>
    </div>
  );
}

function Timer({ remaining, label = "THỜI GIAN CÒN LẠI" }: { remaining: number; label?: string }) {
  return (
    <div className={`assessment-timer ${remaining <= 600 ? "urgent" : ""}`}>
      <span>{label}</span>
      <strong>{formatTime(remaining)}</strong>
    </div>
  );
}

function Progress({ current }: { current: number }) {
  const stages = ["R1", "Delegation", "Description", "Discernment", "Report"];
  return (
    <div className="flow-progress" aria-label={`Tiến độ ${current}/${stages.length}`}>
      {stages.map((stage, index) => (
        <div key={stage} className={index < current ? "active" : ""}>
          <i>{index + 1}</i>
          <span>{stage}</span>
        </div>
      ))}
    </div>
  );
}

function ScoreRing({ score, small = false }: { score: number; small?: boolean }) {
  return (
    <div
      className={`score-ring ${small ? "small" : ""}`}
      style={{ "--score": `${score * 3.6}deg` } as React.CSSProperties}
    >
      <strong>{score}</strong>
      <span>/100</span>
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  return (
    <span className={`save-indicator ${state}`}>
      {state === "saving"
        ? "Đang lưu…"
        : state === "saved"
          ? "✓ Đã lưu"
          : "Đang giữ bản sao trên thiết bị"}
    </span>
  );
}

function QuestionNavigator({
  current,
  answered,
  onSelect,
}: {
  current: number;
  answered: boolean[];
  onSelect: (index: number) => void;
}) {
  return (
    <div className="question-navigator">
      {delegationQuestions.map((question, index) => (
        <button
          key={question.id}
          type="button"
          className={`${index === current ? "current" : ""} ${answered[index] ? "answered" : ""}`}
          onClick={() => onSelect(index)}
          aria-label={`Câu ${index + 1}`}
        >
          {index + 1}
        </button>
      ))}
    </div>
  );
}

function BooleanChoice({
  value,
  disabled = false,
  onChange,
}: {
  value: DelegationAnswer;
  disabled?: boolean;
  onChange: (value: Exclude<DelegationAnswer, null>) => void;
}) {
  return (
    <div className="boolean-choice">
      <button
        type="button"
        disabled={disabled}
        className={value === "true" ? "selected" : ""}
        onClick={() => onChange("true")}
      >
        Đúng
      </button>
      <button
        type="button"
        disabled={disabled}
        className={value === "false" ? "selected" : ""}
        onClick={() => onChange("false")}
      >
        Sai
      </button>
    </div>
  );
}

function ChatPanel({
  taskKey,
  messages,
  remainingCalls,
  busy,
  error,
  onSend,
}: {
  taskKey: DescriptionTaskKey;
  messages: ChatMessage[];
  remainingCalls: number;
  busy: boolean;
  error: string;
  onSend: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);
  const submit = () => {
    const next = value.trim();
    if (next.length < 4 || busy || remainingCalls <= 0) return;
    setValue("");
    onSend(next);
  };
  return (
    <aside className="ai-chat real-ai" aria-label="Talemy AI">
      <div className="chat-head">
        <div className="ai-avatar">AI</div>
        <div>
          <strong>Talemy AI</strong>
          <span>
            <i /> Live AI · {descriptionTasks[taskKey].label}
          </span>
        </div>
        <b>{remainingCalls}/20 lượt</b>
      </div>
      <div className="chat-boundary">
        <strong>AI có đầy đủ brief của task hiện tại</strong>
        <span>
          Hãy mô tả mục tiêu, ràng buộc và cách bạn muốn nhận kết quả. Talemy AI
          không biết rubric chấm ẩn.
        </span>
      </div>
      <div className="chat-messages">
        {messages.length === 0 && (
          <div className="chat-message assistant">
            <span>Talemy AI</span>
            <p>
              Mình là Talemy AI. Mình đã nhận brief của {descriptionTasks[taskKey].label}.
              Bạn muốn bắt đầu từ mục tiêu, thông tin còn thiếu hay cấu trúc đầu ra?
            </p>
          </div>
        )}
        {messages.map((message) => (
          <div key={message.id} className={`chat-message ${message.role}`}>
            <span>{message.role === "user" ? "Bạn" : "Talemy AI"}</span>
            <p>{cleanAiText(message.content)}</p>
          </div>
        ))}
        {busy && (
          <div className="chat-message assistant">
            <span>Talemy AI</span>
            <p className="typing">Đang xử lý yêu cầu…</p>
          </div>
        )}
        <div ref={endRef} />
      </div>
      {error && <p className="chat-error">{error}</p>}
      <div className="chat-compose">
        <textarea
          value={value}
          onChange={(event) => setValue(event.target.value)}
          rows={4}
          maxLength={3500}
          placeholder="Viết prompt của bạn cho Talemy AI…"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <div>
          <span>{value.length}/3500</span>
          <button
            type="button"
            onClick={submit}
            disabled={busy || value.trim().length < 4 || remainingCalls <= 0}
          >
            Gửi ↗
          </button>
        </div>
      </div>
    </aside>
  );
}

function AssessmentHeader({
  section,
  remaining,
  progress,
}: {
  section: string;
  remaining: number;
  progress: number;
}) {
  return (
    <>
      <header className="assessment-header">
        <Logo compact />
        <div>
          <span>TALEMY 4D ASSESSMENT</span>
          <strong>{section}</strong>
        </div>
        <Timer remaining={remaining} />
      </header>
      <Progress current={progress} />
    </>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("landing");
  const [profile, setProfile] = useState<Profile>({
    name: "",
    email: "",
    code: "",
    role: "",
  });
  const [attemptId, setAttemptId] = useState("");
  const [startedAt, setStartedAt] = useState("");
  const [deadline, setDeadline] = useState(0);
  const [remaining, setRemaining] = useState(ASSESSMENT_DURATION_SECONDS);
  const [round1Result, setRound1Result] = useState<Round1Result | null>(null);
  const [skippedRound1, setSkippedRound1] = useState(false);
  const [reviewerMode, setReviewerMode] = useState(false);
  const [reviewerKey, setReviewerKey] = useState("");
  const [round1Height, setRound1Height] = useState(780);
  const [round1Key, setRound1Key] = useState(0);

  const [part1Answers, setPart1Answers] = useState<DelegationAnswer[]>(
    delegationQuestions.map(() => null),
  );
  const [finalAnswers, setFinalAnswers] = useState<DelegationAnswer[]>(
    delegationQuestions.map(() => null),
  );
  const [delegationIndex, setDelegationIndex] = useState(0);
  const [part1Deadline, setPart1Deadline] = useState(0);
  const [part1Remaining, setPart1Remaining] = useState(DELEGATION_PART1_SECONDS);
  const [humanScore, setHumanScore] = useState<number | null>(null);
  const [hints, setHints] = useState<HintMap>({});
  const [delegationResult, setDelegationResult] =
    useState<DelegationResult | null>(null);

  const [descriptionTask, setDescriptionTask] =
    useState<DescriptionTaskKey>("description_a");
  const [descriptionWork, setDescriptionWork] =
    useState<DescriptionWork>(emptyDescriptionWork);
  const [remainingCalls, setRemainingCalls] = useState(20);
  const [chatBusy, setChatBusy] = useState(false);
  const [chatError, setChatError] = useState("");

  const [discernmentFindings, setDiscernmentFindings] =
    useState<DiscernmentFinding[]>(initialFindings);
  const [finalResult, setFinalResult] =
    useState<FinalAssessmentResult | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const restoredRef = useRef(false);
  const autoSubmittedRef = useRef(false);

  const unlocked = Boolean(
    skippedRound1 || (round1Result && round1Result.score >= 12),
  );
  const timeSpentSeconds = useMemo(
    () =>
      startedAt
        ? Math.min(
            ASSESSMENT_DURATION_SECONDS,
            Math.max(
              0,
              Math.round((Date.now() - new Date(startedAt).getTime()) / 1000),
            ),
          )
        : 0,
    [remaining, startedAt],
  );

  const round2State = useMemo(
    () => ({
      view,
      part1Answers,
      finalAnswers,
      delegationIndex,
      part1Deadline,
      humanScore,
      hints,
      delegationResult,
      descriptionTask,
      descriptionWork,
      discernmentFindings,
    }),
    [
      delegationIndex,
      delegationResult,
      descriptionTask,
      descriptionWork,
      discernmentFindings,
      finalAnswers,
      hints,
      humanScore,
      part1Answers,
      part1Deadline,
      view,
    ],
  );

  const saveProgress = useCallback(
    async (extra: Record<string, unknown> = {}) => {
      if (!attemptId) return;
      setSaveState("saving");
      try {
        await apiRequest("/api/attempts", {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            attemptId,
            currentStage: view,
            timeSpentSeconds,
            round2State,
            assessmentVersion: ASSESSMENT_VERSION,
            ...extra,
          }),
          keepalive: true,
        });
        setSaveState("saved");
      } catch {
        setSaveState("error");
      }
    },
    [attemptId, round2State, timeSpentSeconds, view],
  );

  const restoreFromAttempt = useCallback(
    (attempt: Record<string, unknown>) => {
      setSkippedRound1(Boolean(attempt.skippedRound1));
      setRemainingCalls(Math.max(0, 20 - Number(attempt.aiCallCount ?? 0)));
      if (attempt.round1Score != null) {
        const tally = (attempt.round1Breakdown ?? {}) as Round1Result["tally"];
        const score = Number(attempt.round1Score);
        const total = Number(attempt.round1Total ?? 36);
        const bandName = normalizeLegacyBand(String(attempt.round1Band ?? ""));
        setRound1Result({
          score,
          total,
          overallPct: Math.round((score / total) * 100),
          band: {
            num: String(bandForScore(Math.round((score / total) * 100)).level),
            name: bandName,
            desc: "Kết quả Round 1 đã được khôi phục từ database.",
          },
          tally,
          completedAt: String(attempt.lastSavedAt ?? new Date().toISOString()),
        });
      }
      const stored = attempt.round2State as Partial<typeof round2State> | null;
      if (stored) {
        if (Array.isArray(stored.part1Answers)) {
          setPart1Answers(stored.part1Answers as DelegationAnswer[]);
        }
        if (Array.isArray(stored.finalAnswers)) {
          setFinalAnswers(stored.finalAnswers as DelegationAnswer[]);
        }
        if (Number.isFinite(stored.delegationIndex)) {
          setDelegationIndex(Number(stored.delegationIndex));
        }
        if (Number.isFinite(stored.part1Deadline)) {
          setPart1Deadline(Number(stored.part1Deadline));
        }
        if (Number.isFinite(stored.humanScore)) {
          setHumanScore(Number(stored.humanScore));
        }
        if (stored.hints) setHints(stored.hints as HintMap);
        if (stored.delegationResult) {
          setDelegationResult(stored.delegationResult as DelegationResult);
        }
        if (
          stored.descriptionTask === "description_a" ||
          stored.descriptionTask === "description_b"
        ) {
          setDescriptionTask(stored.descriptionTask);
        }
        if (stored.descriptionWork) {
          setDescriptionWork(stored.descriptionWork as DescriptionWork);
        }
        if (Array.isArray(stored.discernmentFindings)) {
          setDiscernmentFindings(
            stored.discernmentFindings as DiscernmentFinding[],
          );
        }
      }
      const delegationState = attempt.delegationState as
        | {
            part1Answers?: DelegationAnswer[];
            part1Deadline?: string;
            humanCorrect?: number;
            consulted?: string[];
            hints?: HintMap;
            result?: DelegationResult;
          }
        | null;
      if (delegationState) {
        if (Array.isArray(delegationState.part1Answers)) {
          setPart1Answers(delegationState.part1Answers);
          setFinalAnswers((current) =>
            current.some(Boolean)
              ? current
              : [...(delegationState.part1Answers ?? current)],
          );
        }
        if (delegationState.part1Deadline) {
          setPart1Deadline(new Date(delegationState.part1Deadline).getTime());
        }
        if (Number.isFinite(delegationState.humanCorrect)) {
          setHumanScore(Number(delegationState.humanCorrect));
        }
        if (delegationState.hints) setHints(delegationState.hints);
        if (delegationState.result) {
          setDelegationResult(delegationState.result);
        }
      }
      if (attempt.finalResult) {
        setFinalResult(attempt.finalResult as FinalAssessmentResult);
        setView("results");
        return;
      }
      const stage = String(attempt.currentStage ?? "round1") as View;
      const validStages: View[] = [
        "round1",
        "round2Intro",
        "delegationPart1",
        "delegationTransition",
        "delegationPart2",
        "delegationResult",
        "description",
        "discernment",
      ];
      setView(validStages.includes(stage) ? stage : "round1");
    },
    [],
  );

  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    const raw = sessionStorage.getItem("talemy-active-attempt-v3");
    if (!raw) return;
    try {
      const stored = JSON.parse(raw) as {
        attemptId: string;
        startedAt: string;
        expiresAt: string;
        profile: Profile;
      };
      if (!stored.attemptId || !stored.profile) return;
      setAttemptId(stored.attemptId);
      setStartedAt(stored.startedAt);
      setDeadline(new Date(stored.expiresAt).getTime());
      setProfile(stored.profile);
      void apiRequest<{ attempt: Record<string, unknown> }>(
        `/api/attempts?attemptId=${encodeURIComponent(stored.attemptId)}`,
        { cache: "no-store" },
      )
        .then(({ attempt }) => restoreFromAttempt(attempt))
        .catch(() => {
          setError(
            "Chưa đồng bộ được database. Hệ thống sẽ tiếp tục thử khi kết nối phục hồi.",
          );
          setSaveState("error");
        });
    } catch {
      sessionStorage.removeItem("talemy-active-attempt-v3");
    }
  }, [restoreFromAttempt]);

  useEffect(() => {
    if (!deadline || view === "landing" || view === "results") return;
    const tick = () =>
      setRemaining(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)));
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [deadline, view]);

  useEffect(() => {
    if (view !== "delegationPart1" || !part1Deadline) return;
    const tick = () =>
      setPart1Remaining(
        Math.max(0, Math.ceil((part1Deadline - Date.now()) / 1000)),
      );
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [part1Deadline, view]);

  useEffect(() => {
    if (!attemptId || view === "landing" || view === "results") return;
    sessionStorage.setItem(
      "talemy-active-attempt-v3",
      JSON.stringify({
        attemptId,
        startedAt,
        expiresAt: new Date(deadline).toISOString(),
        profile,
      }),
    );
    const timer = window.setInterval(() => void saveProgress(), 20_000);
    return () => window.clearInterval(timer);
  }, [attemptId, deadline, profile, saveProgress, startedAt, view]);

  const startAssessment = async (skip = false) => {
    if (!profile.name.trim() || !profile.role) {
      setError("Vui lòng nhập họ tên và chọn nhóm vai trò.");
      return;
    }
    if (skip && !reviewerKey.trim()) {
      setError("Nhập mã Reviewer để dùng chế độ bỏ qua Round 1.");
      return;
    }
    setError("");
    setSaveState("saving");
    try {
      const requestAttemptId = crypto.randomUUID();
      const data = await apiRequest<{
        attemptId: string;
        startedAt: string;
        expiresAt: string;
        skippedRound1: boolean;
      }>("/api/attempts", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(skip
            ? { authorization: `Bearer ${reviewerKey.trim()}` }
            : {}),
        },
        body: JSON.stringify({
          attemptId: requestAttemptId,
          candidateName: profile.name,
          candidateEmail: profile.email,
          candidateCode: profile.code,
          role: profile.role,
          skipRound1: skip,
          assessmentVersion: ASSESSMENT_VERSION,
        }),
      });
      setAttemptId(data.attemptId);
      setStartedAt(data.startedAt);
      setDeadline(new Date(data.expiresAt).getTime());
      setRemaining(ASSESSMENT_DURATION_SECONDS);
      setSkippedRound1(data.skippedRound1);
      setReviewerKey("");
      sessionStorage.setItem(
        "talemy-active-attempt-v3",
        JSON.stringify({
          attemptId: data.attemptId,
          startedAt: data.startedAt,
          expiresAt: data.expiresAt,
          profile,
        }),
      );
      setView(skip ? "round2Intro" : "round1");
      setSaveState("saved");
    } catch (startError) {
      setSaveState("error");
      setError(
        startError instanceof Error
          ? startError.message
          : "Không thể bắt đầu bài test.",
      );
    }
  };

  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (
        event.data?.type === "talemy-round1-height" &&
        Number.isFinite(event.data.height)
      ) {
        setRound1Height(Math.max(720, Number(event.data.height) + 12));
      }
      if (event.data?.type !== "talemy-round1-result") return;
      const incoming = event.data.result as Round1Result;
      const normalized: Round1Result = {
        ...incoming,
        band: {
          ...incoming.band,
          name: normalizeLegacyBand(incoming.band.name),
        },
      };
      setRound1Result(normalized);
      void saveProgress({
        currentStage: normalized.score >= 12 ? "round2Intro" : "round1",
        status: normalized.score >= 12 ? "in_progress" : "screened_out",
        round1Score: normalized.score,
        round1Total: normalized.total,
        round1Band: normalized.band.name,
        round1Breakdown: normalized.tally,
      });
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [saveProgress]);

  const startDelegation = async () => {
    setError("");
    try {
      const data = await apiRequest<{
        part1StartedAt: string;
        part1ExpiresAt: string;
        part1Answers?: DelegationAnswer[];
      }>("/api/delegation/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attemptId }),
      });
      setPart1Deadline(new Date(data.part1ExpiresAt).getTime());
      if (Array.isArray(data.part1Answers)) {
        setPart1Answers(data.part1Answers);
      }
      setView("delegationPart1");
      await saveProgress({ currentStage: "delegationPart1" });
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Chưa thể bắt đầu Delegation.",
      );
    }
  };

  const submitDelegationPart1 = useCallback(
    async (auto = false) => {
      if (!auto && part1Answers.some((answer) => answer == null)) {
        setError("Hãy trả lời đủ 12 câu trước khi nộp Phần 1.");
        return;
      }
      setError("");
      try {
        const data = await apiRequest<{
          humanCorrect: number;
          total: number;
          part1Answers: Exclude<DelegationAnswer, null>[];
        }>("/api/delegation/part1", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            attemptId,
            answers: part1Answers,
            autoSubmitted: auto,
          }),
        });
        setHumanScore(data.humanCorrect);
        setPart1Answers(data.part1Answers);
        setFinalAnswers([...data.part1Answers]);
        setDelegationIndex(0);
        setView("delegationTransition");
        await saveProgress({ currentStage: "delegationTransition" });
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Chưa thể nộp Phần 1.",
        );
      }
    },
    [attemptId, part1Answers, saveProgress],
  );

  useEffect(() => {
    if (
      view === "delegationPart1" &&
      part1Deadline &&
      part1Remaining === 0 &&
      humanScore == null
    ) {
      void submitDelegationPart1(true);
    }
  }, [
    humanScore,
    part1Deadline,
    part1Remaining,
    submitDelegationPart1,
    view,
  ]);

  const consultAi = async (itemId: string) => {
    if (hints[itemId]) return;
    setError("");
    try {
      const data = await apiRequest<{
        itemId: string;
        hint: string;
        consultedCount: number;
      }>("/api/delegation/hint", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ attemptId, itemId }),
      });
      setHints((current) => ({ ...current, [data.itemId]: data.hint }));
    } catch (hintError) {
      setError(
        hintError instanceof Error
          ? hintError.message
          : "Chưa thể mở gợi ý AI.",
      );
    }
  };

  const finalizeDelegation = async () => {
    setError("");
    try {
      const data = await apiRequest<{ result: DelegationResult }>(
        "/api/delegation/finalize",
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ attemptId, finalAnswers }),
        },
      );
      setDelegationResult(data.result);
      setView("delegationResult");
      await saveProgress({
        currentStage: "delegationResult",
        delegationResult: data.result,
      });
    } catch (finalizeError) {
      setError(
        finalizeError instanceof Error
          ? finalizeError.message
          : "Chưa thể chốt phần Delegation.",
      );
    }
  };

  const updateDescription = (
    key: DescriptionTaskKey,
    field: "finalPrompt" | "finalPlan" | "reflection",
    value: string,
  ) => {
    setDescriptionWork((current) => ({
      ...current,
      [key]: { ...current[key], [field]: value },
    }));
  };

  const sendChat = async (value: string) => {
    if (!attemptId || chatBusy || remainingCalls <= 0) return;
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: value,
      taskKey: descriptionTask,
      createdAt: new Date().toISOString(),
    };
    const nextMessages = [
      ...descriptionWork[descriptionTask].messages,
      userMessage,
    ];
    setDescriptionWork((current) => ({
      ...current,
      [descriptionTask]: {
        ...current[descriptionTask],
        messages: nextMessages,
      },
    }));
    setChatBusy(true);
    setChatError("");
    try {
      const data = await apiRequest<{
        message: ChatMessage;
        remainingCalls: number;
      }>("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          attemptId,
          taskKey: descriptionTask,
          messages: nextMessages,
        }),
      });
      setDescriptionWork((current) => ({
        ...current,
        [descriptionTask]: {
          ...current[descriptionTask],
          messages: [...current[descriptionTask].messages, data.message],
        },
      }));
      setRemainingCalls(data.remainingCalls);
    } catch (chatFailure) {
      setChatError(
        chatFailure instanceof Error
          ? chatFailure.message
          : "Talemy AI chưa thể phản hồi.",
      );
    } finally {
      setChatBusy(false);
    }
  };

  const nextDescriptionTask = async () => {
    const current = descriptionWork[descriptionTask];
    if (
      current.messages.filter((message) => message.role === "user").length < 1 ||
      current.finalPrompt.trim().length < 40 ||
      current.finalPlan.trim().length < 80 ||
      current.reflection.trim().length < 50
    ) {
      setError(
        "Mỗi task cần ít nhất 1 lượt chat, final prompt, kết quả đã chốt và reflection.",
      );
      return;
    }
    setError("");
    if (descriptionTask === "description_a") {
      setDescriptionTask("description_b");
      await saveProgress({
        currentStage: "description",
        round2State: {
          ...round2State,
          descriptionTask: "description_b",
          descriptionWork,
        },
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      setView("discernment");
      await saveProgress({ currentStage: "discernment" });
    }
  };

  const updateFinding = (
    id: string,
    field: "problem" | "why" | "improvement",
    value: string,
  ) => {
    setDiscernmentFindings((current) =>
      current.map((finding) =>
        finding.id === id ? { ...finding, [field]: value } : finding,
      ),
    );
  };

  const submitFinal = useCallback(
    async (autoSubmitted = false) => {
      if (submitting) return;
      const completeFindings = discernmentFindings.filter(
        (finding) =>
          finding.problem.trim() &&
          finding.why.trim() &&
          finding.improvement.trim(),
      );
      if (!autoSubmitted && completeFindings.length < 1) {
        setError(
          "Hãy ghi ít nhất một phát hiện đầy đủ: vấn đề, lý do và cách cải thiện.",
        );
        return;
      }
      setSubmitting(true);
      setError("");
      try {
        const data = await apiRequest<{ result: FinalAssessmentResult }>(
          "/api/ai/grade",
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              attemptId,
              skippedRound1,
              round1Result,
              descriptionWork,
              discernmentFindings,
              timeSpentSeconds,
              autoSubmitted,
              assessmentVersion: ASSESSMENT_VERSION,
            }),
          },
          70_000,
        );
        setFinalResult(data.result);
        setView("results");
        sessionStorage.removeItem("talemy-active-attempt-v3");
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Chưa thể chấm bài. Bài làm vẫn đã được lưu.",
        );
      } finally {
        setSubmitting(false);
      }
    },
    [
      attemptId,
      descriptionWork,
      discernmentFindings,
      round1Result,
      skippedRound1,
      submitting,
      timeSpentSeconds,
    ],
  );

  useEffect(() => {
    if (
      remaining !== 0 ||
      !attemptId ||
      autoSubmittedRef.current ||
      view === "results"
    ) {
      return;
    }
    autoSubmittedRef.current = true;
    if (view === "round1") {
      const frame = document.querySelector<HTMLIFrameElement>(
        'iframe[title="Talemy AI Skill Test Round 1"]',
      );
      frame?.contentWindow?.postMessage({ type: "talemy-force-submit" }, "*");
      return;
    }
    void submitFinal(true);
  }, [attemptId, remaining, submitFinal, view]);

  const resetAll = () => {
    sessionStorage.removeItem("talemy-active-attempt-v3");
    setView("landing");
    setProfile({ name: "", email: "", code: "", role: "" });
    setAttemptId("");
    setStartedAt("");
    setDeadline(0);
    setRemaining(ASSESSMENT_DURATION_SECONDS);
    setRound1Result(null);
    setSkippedRound1(false);
    setRound1Key((value) => value + 1);
    setPart1Answers(delegationQuestions.map(() => null));
    setFinalAnswers(delegationQuestions.map(() => null));
    setDelegationIndex(0);
    setPart1Deadline(0);
    setHumanScore(null);
    setHints({});
    setDelegationResult(null);
    setDescriptionTask("description_a");
    setDescriptionWork(emptyDescriptionWork);
    setDiscernmentFindings(initialFindings());
    setRemainingCalls(20);
    setFinalResult(null);
    setError("");
    setSaveState("idle");
    autoSubmittedRef.current = false;
  };

  if (view === "landing") {
    return (
      <main className="site-shell landing-page">
        <header className="main-header">
          <Logo />
          <nav>
            <a href="#journey">Cấu trúc bài test</a>
            <a href={reviewerUrl()}>Reviewer Center ↗</a>
          </nav>
        </header>
        <section className="landing-hero">
          <div className="hero-copy">
            <p className="eyebrow orange">TALEMY · 4D AI APPLICATION ASSESSMENT</p>
            <h1>
              Hiểu AI là bước đầu.
              <br />
              <span>Biết hợp tác và kiểm chứng mới tạo ra giá trị.</span>
            </h1>
            <p className="hero-lead">
              Bài đánh giá đo AI literacy và hành vi ứng dụng AI thực tế qua
              Delegation, Description, Discernment và Diligence.
            </p>
            <div className="hero-facts">
              <div>
                <strong>60</strong>
                <span>phút cho toàn bài</span>
              </div>
              <div>
                <strong>36</strong>
                <span>câu Round 1</span>
              </div>
              <div>
                <strong>03</strong>
                <span>bài thực hành Round 2</span>
              </div>
            </div>
          </div>
          <aside className="candidate-card">
            <div className="card-label">
              <i /> BẮT ĐẦU BÀI ĐÁNH GIÁ
            </div>
            <h2>Thông tin ứng viên</h2>
            <p>Đồng hồ 60 phút bắt đầu khi bạn nhấn nút bên dưới.</p>
            <label>
              Họ và tên *
              <input
                value={profile.name}
                onChange={(event) =>
                  setProfile({ ...profile, name: event.target.value })
                }
                placeholder="Nguyễn Minh Anh"
              />
            </label>
            <div className="two-inputs">
              <label>
                Email
                <input
                  type="email"
                  value={profile.email}
                  onChange={(event) =>
                    setProfile({ ...profile, email: event.target.value })
                  }
                  placeholder="email@company.com"
                />
              </label>
              <label>
                Mã ứng viên
                <input
                  value={profile.code}
                  onChange={(event) =>
                    setProfile({ ...profile, code: event.target.value })
                  }
                  placeholder="TL-2401"
                />
              </label>
            </div>
            <label>
              Nhóm vai trò *
              <select
                value={profile.role}
                onChange={(event) =>
                  setProfile({ ...profile, role: event.target.value })
                }
              >
                <option value="">Chọn nhóm vai trò</option>
                <option>HR / Recruitment</option>
                <option>Sales / Business Development</option>
                <option>Marketing</option>
                <option>Operations / Customer Service</option>
                <option>Finance / Admin</option>
                <option>Other knowledge work</option>
              </select>
            </label>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              className="primary-button"
              onClick={() => void startAssessment(false)}
              disabled={saveState === "saving"}
            >
              {saveState === "saving" ? "Đang tạo bài làm…" : "Bắt đầu Round 1 · 60:00"}{" "}
              <span>→</span>
            </button>
            <button
              type="button"
              className="reviewer-mode-toggle"
              onClick={() => setReviewerMode((current) => !current)}
            >
              {reviewerMode ? "Ẩn chế độ kiểm thử" : "Reviewer: kiểm thử từ Round 2"}
            </button>
            {reviewerMode && (
              <div className="reviewer-skip-box">
                <label>
                  Mã Reviewer
                  <input
                    type="password"
                    value={reviewerKey}
                    onChange={(event) => setReviewerKey(event.target.value)}
                    autoComplete="off"
                    placeholder="Nhập mã truy cập"
                  />
                </label>
                <button
                  type="button"
                  className="secondary-button"
                  onClick={() => void startAssessment(true)}
                >
                  Bỏ qua Round 1 để QC →
                </button>
                <small>
                  Kết quả sẽ chỉ có Round 2; không tính Overall và Diligence.
                </small>
              </div>
            )}
            <p className="privacy-line">
              Bài làm, transcript và reasoning chấm được lưu vào database bảo mật.
            </p>
          </aside>
        </section>
        <section className="journey" id="journey">
          <article>
            <div className="round-number">01</div>
            <p className="eyebrow">AI LITERACY</p>
            <h2>Round 1 · Kiến thức nền</h2>
            <p>36 câu trắc nghiệm, trả kết quả theo bốn năng lực 4D.</p>
          </article>
          <div className="journey-arrow">→</div>
          <article className="accent-card">
            <div className="round-number">02</div>
            <p className="eyebrow">WORK SAMPLE</p>
            <h2>Round 2 · Ứng dụng thực tế</h2>
            <p>
              Human–AI Delegation, hai task Description và một bài Discernment
              có ground truth.
            </p>
          </article>
        </section>
      </main>
    );
  }

  if (view === "round1") {
    return (
      <main className="assessment-shell">
        <AssessmentHeader section="Round 1 · AI Literacy" remaining={remaining} progress={1} />
        <section className="round-title-block">
          <p className="eyebrow orange">ROUND 1 · 36 CÂU HỎI</p>
          <h1>Nền tảng hiểu và sử dụng AI</h1>
          <p>
            Giữ nguyên bộ câu hỏi hiện tại. Từ Advanced Beginner sẽ mở Round 2.
          </p>
        </section>
        <div className="round1-frame-wrap">
          <iframe
            key={round1Key}
            src="./round1.html"
            title="Talemy AI Skill Test Round 1"
            style={{ height: `${round1Height}px` }}
          />
        </div>
        {round1Result && (
          <section className={`unlock-card ${unlocked ? "unlocked" : "locked"}`}>
            <div className="unlock-icon">{unlocked ? "✓" : "↺"}</div>
            <div>
              <p className="eyebrow">
                {unlocked ? "ROUND 2 ĐÃ MỞ" : "CHƯA MỞ ROUND 2"}
              </p>
              <h2>
                {round1Result.band.name} · {round1Result.score}/
                {round1Result.total} câu đúng
              </h2>
              <p>
                {unlocked
                  ? "Bạn có thể tiếp tục các bài thực hành ứng dụng AI."
                  : "Round 2 yêu cầu tối thiểu Advanced Beginner. Kết quả đã được lưu."}
              </p>
            </div>
            {unlocked && (
              <button
                type="button"
                className="primary-button"
                onClick={() => {
                  setView("round2Intro");
                  void saveProgress({ currentStage: "round2Intro" });
                }}
              >
                Tiếp tục Round 2 <span>→</span>
              </button>
            )}
          </section>
        )}
      </main>
    );
  }

  if (view === "round2Intro") {
    return (
      <main className="assessment-shell rubric-page">
        <AssessmentHeader section="Round 2 · Work Sample" remaining={remaining} progress={2} />
        <section className="rubric-hero">
          <div>
            <p className="eyebrow orange">TRƯỚC KHI BẮT ĐẦU</p>
            <h1>Round 2 đo hành vi làm việc thật cùng AI.</h1>
            <p>
              Bạn sẽ làm Delegation, hai task Description và Discernment. Round 2
              không kiểm tra Diligence; điểm đó lấy từ Round 1.
            </p>
          </div>
          <div className="rubric-note">
            <strong>{formatTime(remaining)}</strong>
            <span>thời gian còn lại</span>
          </div>
        </section>
        <section className="rubric-grid">
          {(["delegation", "description", "discernment"] as const).map(
            (key, index) => (
              <article key={key}>
                <span>0{index + 1}</span>
                <h2>{strengthMeta[key].label}</h2>
                <strong>{strengthMeta[key].short}</strong>
                <p>{strengthMeta[key].description}</p>
              </article>
            ),
          )}
        </section>
        <section className="simple-instructions public-rubric">
          <strong>Rubric cần keep in mind</strong>
          <ul>
            <li>
              Delegation: độ chính xác sau phối hợp 50%, quyết định dùng/không
              dùng AI 30%, xử lý gợi ý 20%. Không cần dùng hết lượt AI.
            </li>
            <li>Description: prompt rõ, có ràng buộc, cấu trúc và biết tinh chỉnh.</li>
            <li>Discernment: phát hiện đúng lỗi, giải thích tác động và đề xuất sửa.</li>
          </ul>
        </section>
        {skippedRound1 && (
          <div className="result-alert">
            Chế độ QC đã bỏ qua Round 1: báo cáo cuối chỉ hiển thị Round 2, không
            tính Overall và Diligence.
          </div>
        )}
        {error && <p className="form-error">{error}</p>}
        <div className="center-action">
          <button
            type="button"
            className="primary-button"
            onClick={() => void startDelegation()}
          >
            Bắt đầu Delegation <span>→</span>
          </button>
        </div>
      </main>
    );
  }

  if (view === "delegationPart1") {
    const question = delegationQuestions[delegationIndex];
    return (
      <main className="assessment-shell delegation-page">
        <AssessmentHeader section="Delegation · Phần 1" remaining={remaining} progress={2} />
        <div className="phase-timer-row">
          <Timer remaining={part1Remaining} label="THỜI GIAN PHẦN 1" />
          <SaveIndicator state={saveState} />
        </div>
        <section className="delegation-intro-strip">
          <strong>Phần 1 — Tự làm</strong>
          <span>
            Trả lời 12 câu trong tổng thời gian 7:30. Bạn có thể quay lại hoặc tiến
            tới trước khi nộp.
          </span>
        </section>
        <QuestionNavigator
          current={delegationIndex}
          answered={part1Answers.map(Boolean)}
          onSelect={setDelegationIndex}
        />
        <section className="delegation-question-card">
          <div className="question-meta">
            <span>CÂU {delegationIndex + 1}/12</span>
            <em>Mức thời gian tham chiếu: {question.seconds} giây</em>
          </div>
          <h1>{question.statement}</h1>
          <p>Phát biểu kết luận trong tình huống trên là Đúng hay Sai?</p>
          <BooleanChoice
            value={part1Answers[delegationIndex]}
            onChange={(answer) =>
              setPart1Answers((current) =>
                current.map((value, index) =>
                  index === delegationIndex ? answer : value,
                ),
              )
            }
          />
        </section>
        {error && <p className="form-error">{error}</p>}
        <div className="task-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={delegationIndex === 0}
            onClick={() => setDelegationIndex((current) => current - 1)}
          >
            ← Câu trước
          </button>
          {delegationIndex < 11 ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => setDelegationIndex((current) => current + 1)}
            >
              Câu tiếp theo →
            </button>
          ) : (
            <button
              type="button"
              className="primary-button"
              onClick={() => void submitDelegationPart1(false)}
            >
              Nộp Phần 1 →
            </button>
          )}
        </div>
      </main>
    );
  }

  if (view === "delegationTransition") {
    return (
      <main className="assessment-shell delegation-transition">
        <AssessmentHeader section="Delegation · Chuyển tiếp" remaining={remaining} progress={2} />
        <section className="transition-card">
          <p className="eyebrow orange">KẾT QUẢ PHẦN 1</p>
          <strong className="human-score">{humanScore ?? 0}/12</strong>
          <h1>Bây giờ hãy xem lại 12 câu cùng đáp án bạn đã chọn.</h1>
          <p>
            Tận dụng tối đa 4 lượt tham khảo Talemy AI để nâng điểm số cuối cùng
            của bạn.
          </p>
          <ul>
            <li>Câu không tham khảo AI sẽ giữ nguyên đáp án Phần 1.</li>
            <li>Chỉ câu đã tham khảo AI mới được phép đổi đáp án.</li>
            <li>Talemy AI hỗ trợ bạn nhưng có thể không phải lúc nào cũng chính xác.</li>
          </ul>
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setDelegationIndex(0);
              setView("delegationPart2");
              void saveProgress({ currentStage: "delegationPart2" });
            }}
          >
            Bắt đầu Phần 2 →
          </button>
        </section>
      </main>
    );
  }

  if (view === "delegationPart2") {
    const question = delegationQuestions[delegationIndex];
    const consulted = Boolean(hints[question.id]);
    const consultedCount = Object.keys(hints).length;
    return (
      <main className="assessment-shell delegation-page">
        <AssessmentHeader section="Delegation · Phần 2" remaining={remaining} progress={2} />
        <div className="phase-timer-row">
          <div className="consult-counter">
            <span>LƯỢT THAM KHẢO AI</span>
            <strong>{consultedCount}/4</strong>
          </div>
          <SaveIndicator state={saveState} />
        </div>
        <section className="delegation-intro-strip">
          <strong>Phần 2 — Xem lại và tham khảo AI</strong>
          <span>
            Bạn được quay lại/tiến tới giữa các câu. Chỉ câu đã mở gợi ý mới có
            thể đổi đáp án.
          </span>
        </section>
        <QuestionNavigator
          current={delegationIndex}
          answered={finalAnswers.map(Boolean)}
          onSelect={setDelegationIndex}
        />
        <section className="delegation-question-card review">
          <div className="question-meta">
            <span>CÂU {delegationIndex + 1}/12</span>
            <em>
              Đáp án Phần 1:{" "}
              <b>
                {part1Answers[delegationIndex] === "true"
                  ? "Đúng"
                  : part1Answers[delegationIndex] === "false"
                    ? "Sai"
                    : "Chưa trả lời"}
              </b>
            </em>
          </div>
          <h1>{question.statement}</h1>
          {!consulted ? (
            <div className="consult-box">
              <p>
                Đáp án đang bị khóa. Bạn có thể giữ nguyên hoặc dùng một lượt để
                xem gợi ý của Talemy AI.
              </p>
              <button
                type="button"
                className="ai-consult-button"
                disabled={consultedCount >= 4}
                onClick={() => void consultAi(question.id)}
              >
                Tham khảo Talemy AI · còn {Math.max(0, 4 - consultedCount)} lượt
              </button>
            </div>
          ) : (
            <div className="ai-hint">
              <div>
                <span className="ai-avatar">AI</span>
                <strong>Gợi ý từ Talemy AI</strong>
              </div>
              <p>{cleanAiText(hints[question.id])}</p>
              <small>
                Hãy tự đánh giá lập luận trước khi giữ hoặc đổi đáp án.
              </small>
            </div>
          )}
          <BooleanChoice
            value={finalAnswers[delegationIndex]}
            disabled={!consulted}
            onChange={(answer) =>
              setFinalAnswers((current) =>
                current.map((value, index) =>
                  index === delegationIndex ? answer : value,
                ),
              )
            }
          />
        </section>
        {error && <p className="form-error">{error}</p>}
        <div className="task-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={delegationIndex === 0}
            onClick={() => setDelegationIndex((current) => current - 1)}
          >
            ← Câu trước
          </button>
          {delegationIndex < 11 ? (
            <button
              type="button"
              className="primary-button"
              onClick={() => setDelegationIndex((current) => current + 1)}
            >
              Câu tiếp theo →
            </button>
          ) : (
            <button
              type="button"
              className="primary-button"
              onClick={() => void finalizeDelegation()}
            >
              Chốt Delegation →
            </button>
          )}
        </div>
      </main>
    );
  }

  if (view === "delegationResult" && delegationResult) {
    return (
      <main className="assessment-shell delegation-results">
        <AssessmentHeader section="Delegation · Kết quả" remaining={remaining} progress={2} />
        <section className="metric-card-grid">
          <article>
            <span>HUMAN ALONE</span>
            <strong>{delegationResult.humanAlone}%</strong>
          </article>
          <article>
            <span>AI ALONE</span>
            <strong>{delegationResult.aiAlone}%</strong>
          </article>
          <article className="accent">
            <span>TEAM PERFORMANCE</span>
            <strong>{delegationResult.teamPerformance}%</strong>
          </article>
          <article>
            <span>QUYẾT ĐỊNH DÙNG AI</span>
            <strong>
              {delegationResult.selectivity.matched}/
              {delegationResult.selectivity.total}
            </strong>
          </article>
        </section>
        <section className="delegation-interpretation">
          <ScoreRing score={delegationResult.score} />
          <div>
            <p className="eyebrow orange">DELEGATION SCORE</p>
            <h1>{delegationResult.band}</h1>
            <p>{delegationResult.interpretation}</p>
            <small>
              Công thức: độ chính xác sau phối hợp 50% + quyết định dùng/không
              dùng AI 30% + xử lý gợi ý AI 20%. Không hỏi AI khi tự làm đúng
              vẫn được ghi nhận là quyết định tốt.
            </small>
          </div>
        </section>
        <details className="delegation-breakdown">
          <summary>Xem phân tích từng câu</summary>
          <div>
            {delegationResult.breakdown.map((item, index) => (
              <article key={item.id} className={item.tone}>
                <b>{index + 1}</b>
                <div>
                  <strong>{item.statement}</strong>
                  <span>
                    Phần 1: {item.part1Correct ? "Đúng" : "Sai"} ·{" "}
                    {item.consulted ? "Có hỏi AI" : "Không hỏi AI"} · Phần 2:{" "}
                    {item.finalCorrect ? "Đúng" : "Sai"}
                  </span>
                  <p>{item.feedback}</p>
                </div>
              </article>
            ))}
          </div>
        </details>
        <div className="center-action">
          <button
            type="button"
            className="primary-button"
            onClick={() => {
              setDescriptionTask("description_a");
              setView("description");
              void saveProgress({ currentStage: "description" });
            }}
          >
            Tiếp tục Description →
          </button>
        </div>
      </main>
    );
  }

  if (view === "description") {
    const task = descriptionTasks[descriptionTask];
    const work = descriptionWork[descriptionTask];
    return (
      <main className="assessment-shell description-page">
        <AssessmentHeader section="Description · Prompt Work Sample" remaining={remaining} progress={3} />
        <div className="description-task-tabs">
          <button
            type="button"
            className={descriptionTask === "description_a" ? "active" : ""}
            onClick={() => setDescriptionTask("description_a")}
          >
            Task A · Travel
          </button>
          <button
            type="button"
            className={descriptionTask === "description_b" ? "active" : ""}
            disabled={
              descriptionWork.description_a.finalPrompt.trim().length < 40
            }
            onClick={() => setDescriptionTask("description_b")}
          >
            Task B · Academic
          </button>
          <SaveIndicator state={saveState} />
        </div>
        <section className="description-brief">
          <p className="eyebrow orange">{task.label}</p>
          <h1>{task.title}</h1>
          <p>{task.brief}</p>
          <ul>
            {task.requirements.map((requirement) => (
              <li key={requirement}>{requirement}</li>
            ))}
          </ul>
        </section>
        <section className="description-layout">
          <div className="description-work">
            <div className="starter-prompts">
              <span>Gợi ý cách bắt đầu, không phải đáp án:</span>
              {task.starterPrompts.map((prompt) => (
                <button
                  type="button"
                  key={prompt}
                  onClick={() => void sendChat(prompt)}
                  disabled={chatBusy}
                >
                  {prompt}
                </button>
              ))}
            </div>
            <label className="analysis-field">
              <span>
                <strong>Final prompt tốt nhất của bạn</strong>
                <small>
                  Viết prompt bạn cho là đủ rõ sau các lượt tương tác.
                </small>
              </span>
              <textarea
                rows={7}
                value={work.finalPrompt}
                onChange={(event) =>
                  updateDescription(
                    descriptionTask,
                    "finalPrompt",
                    event.target.value,
                  )
                }
              />
            </label>
            <label className="analysis-field">
              <span>
                <strong>Kết quả/kế hoạch bạn chốt</strong>
                <small>
                  Tóm tắt output bạn sẽ sử dụng sau khi tự kiểm tra.
                </small>
              </span>
              <textarea
                rows={9}
                value={work.finalPlan}
                onChange={(event) =>
                  updateDescription(
                    descriptionTask,
                    "finalPlan",
                    event.target.value,
                  )
                }
              />
            </label>
            <label className="analysis-field">
              <span>
                <strong>Bạn đã tinh chỉnh hoặc kiểm tra gì?</strong>
                <small>
                  Nêu một điểm AI làm chưa tốt và cách bạn sửa prompt/kết quả.
                </small>
              </span>
              <textarea
                rows={5}
                value={work.reflection}
                onChange={(event) =>
                  updateDescription(
                    descriptionTask,
                    "reflection",
                    event.target.value,
                  )
                }
              />
            </label>
          </div>
          <ChatPanel
            taskKey={descriptionTask}
            messages={work.messages}
            remainingCalls={remainingCalls}
            busy={chatBusy}
            error={chatError}
            onSend={(value) => void sendChat(value)}
          />
        </section>
        {error && <p className="form-error">{error}</p>}
        <div className="task-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              if (descriptionTask === "description_b") {
                setDescriptionTask("description_a");
              } else {
                setView("delegationResult");
              }
            }}
          >
            ← Quay lại
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => void nextDescriptionTask()}
          >
            {descriptionTask === "description_a"
              ? "Lưu Task A & sang Task B"
              : "Hoàn tất Description"}{" "}
            →
          </button>
        </div>
      </main>
    );
  }

  if (view === "discernment") {
    return (
      <main className="assessment-shell discernment-page">
        <AssessmentHeader section="Discernment · AI Output Review" remaining={remaining} progress={4} />
        <section className="discernment-instructions">
          <p className="eyebrow orange">FINAL WORK SAMPLE</p>
          <h1>{discernmentScenario.title}</h1>
          <p>{discernmentScenario.context}</p>
          <div>
            <strong>Hãy xác định từng vấn đề, giải thích tác động và đề xuất sửa.</strong>
            <span>
              Chỉ chấm phát hiện có thể đối chiếu với dữ liệu; không chấm văn phong,
              độ dài hoặc cách dùng thuật ngữ.
            </span>
          </div>
        </section>
        <section className="case-requirements">
          <h2>Business requirements</h2>
          <ul>
            {discernmentScenario.requirements.map((requirement) => (
              <li key={requirement}>{requirement}</li>
            ))}
          </ul>
        </section>
        <section className="dataset-card">
          <div className="dataset-head">
            <div>
              <p className="eyebrow orange">SUPPORTING DATASET</p>
              <h2>Hiệu quả các kênh sourcing</h2>
            </div>
            <span>Cost: triệu VNĐ</span>
          </div>
          <div className="dataset-scroll">
            <table>
              <thead>
                <tr>
                  <th>Kênh</th>
                  <th>Applicants</th>
                  <th>Qualified</th>
                  <th>Interviews</th>
                  <th>Offers</th>
                  <th>Hires</th>
                  <th>Cost</th>
                  <th>TTH</th>
                  <th>Retention</th>
                </tr>
              </thead>
              <tbody>
                {discernmentScenario.dataset.map((row) => (
                  <tr key={row.channel}>
                    <th>{row.channel}</th>
                    <td>{row.applicants}</td>
                    <td>{row.qualified}</td>
                    <td>{row.interviews}</td>
                    <td>{row.offers}</td>
                    <td>{row.hires}</td>
                    <td>{row.costM}</td>
                    <td>{row.tth} ngày</td>
                    <td>{row.retention}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        <section className="ai-output-review">
          <div className="ai-output-head">
            <span className="ai-avatar">AI</span>
            <div>
              <strong>Báo cáo do AI tạo ra</strong>
              <small>Cần được thẩm định trước khi sử dụng</small>
            </div>
          </div>
          {discernmentScenario.aiOutput.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </section>
        <section className="finding-list">
          <div className="finding-list-head">
            <div>
              <p className="eyebrow orange">ĐÁNH GIÁ CỦA BẠN</p>
              <h2>Các phát hiện</h2>
            </div>
            <button
              type="button"
              className="secondary-button"
              disabled={discernmentFindings.length >= 7}
              onClick={() =>
                setDiscernmentFindings((current) => [
                  ...current,
                  {
                    id: crypto.randomUUID(),
                    problem: "",
                    why: "",
                    improvement: "",
                  },
                ])
              }
            >
              + Thêm phát hiện
            </button>
          </div>
          {discernmentFindings.map((finding, index) => (
            <article key={finding.id} className="finding-card">
              <div className="finding-number">{index + 1}</div>
              <label>
                <span>Vấn đề bạn phát hiện</span>
                <textarea
                  rows={3}
                  value={finding.problem}
                  onChange={(event) =>
                    updateFinding(finding.id, "problem", event.target.value)
                  }
                />
              </label>
              <label>
                <span>Vì sao vấn đề này ảnh hưởng quyết định?</span>
                <textarea
                  rows={3}
                  value={finding.why}
                  onChange={(event) =>
                    updateFinding(finding.id, "why", event.target.value)
                  }
                />
              </label>
              <label>
                <span>Nên sửa hoặc kiểm tra lại thế nào?</span>
                <textarea
                  rows={3}
                  value={finding.improvement}
                  onChange={(event) =>
                    updateFinding(
                      finding.id,
                      "improvement",
                      event.target.value,
                    )
                  }
                />
              </label>
              {discernmentFindings.length > 1 && (
                <button
                  type="button"
                  className="remove-finding"
                  onClick={() =>
                    setDiscernmentFindings((current) =>
                      current.filter((item) => item.id !== finding.id),
                    )
                  }
                >
                  Xoá phát hiện này
                </button>
              )}
            </article>
          ))}
        </section>
        {error && <p className="form-error">{error}</p>}
        <div className="task-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={() => {
              setDescriptionTask("description_b");
              setView("description");
            }}
          >
            ← Quay lại Description
          </button>
          <button
            type="button"
            className="primary-button"
            onClick={() => void submitFinal(false)}
            disabled={submitting}
          >
            {submitting ? "Talemy AI đang chấm…" : "Nộp bài & xem report"} →
          </button>
        </div>
      </main>
    );
  }

  const result = finalResult;
  const r1Strengths = round1StrengthScores(round1Result);
  const rankedStrengths = result
    ? (Object.keys(strengthMeta) as StrengthKey[])
        .map((key) => ({
          key,
          score: result.final.strengths[key].score,
        }))
        .filter((item) => item.score != null)
        .sort((a, b) => Number(b.score) - Number(a.score))
    : [];
  const strongestResult = rankedStrengths[0];
  const priorityResult = rankedStrengths.at(-1);
  return (
    <main className="assessment-shell results-page">
      <header className="assessment-header">
        <Logo compact />
        <div>
          <span>HOÀN THÀNH</span>
          <strong>Talemy 4D Candidate Report</strong>
        </div>
      </header>
      <Progress current={5} />
      <section className="result-hero">
        <div>
          <p className="eyebrow orange">TALEMY AI SKILL REPORT</p>
          <h1>{profile.name}</h1>
          <p>
            {profile.role}
            {profile.code ? ` · ${profile.code}` : ""}
          </p>
          <div className="result-chips">
            <span>
              Round 1 ·{" "}
              {skippedRound1
                ? "Skipped for QC"
                : round1Result?.band.name ?? "Chưa hoàn tất"}
            </span>
            <span>
              Round 2 · {result?.round2.band ?? "Đang chờ chấm"}
            </span>
            <span>{formatTime(timeSpentSeconds)} đã sử dụng</span>
          </div>
        </div>
        {result ? (
          <div className="overall-score">
            <ScoreRing
              score={result.final.overall ?? result.round2.score}
            />
            <div>
              <span>{result.final.overall == null ? "ROUND 2" : "OVERALL"}</span>
              <strong>{result.final.band ?? result.round2.band}</strong>
              <p>{result.overallReasoning}</p>
            </div>
          </div>
        ) : (
          <div className="pending-grade">
            <div className="ai-avatar">AI</div>
            <strong>Chưa có kết quả cuối</strong>
            <p>{error || "Bài làm đang được lưu."}</p>
          </div>
        )}
      </section>
      {skippedRound1 && (
        <div className="result-alert">
          Đây là lượt QC bỏ qua Round 1. Theo rule đã chốt, báo cáo không tính
          Overall và không suy ra Diligence.
        </div>
      )}
      <section className="round-summary-grid">
        <article>
          <p className="eyebrow">ROUND 1 · AI LITERACY</p>
          <h2>
            {skippedRound1
              ? "Skipped"
              : round1Result
                ? `${round1Result.overallPct}/100`
                : "—"}
          </h2>
          <strong>
            {skippedRound1
              ? "Không tính vào báo cáo QC"
              : round1Result?.band.name ?? "Chưa hoàn tất"}
          </strong>
          {!skippedRound1 && round1Result && (
            <div className="mini-strength-list">
              {(Object.keys(r1Strengths) as StrengthKey[]).map((key) => (
                <span key={key}>
                  {strengthMeta[key].label}: {r1Strengths[key] ?? "—"}
                </span>
              ))}
            </div>
          )}
        </article>
        <article className="orange-card">
          <p className="eyebrow">ROUND 2 · WORK SAMPLE</p>
          <h2>{result ? `${result.round2.score}/100` : "Pending"}</h2>
          <strong>{result?.round2.band ?? "Đang chờ chấm"}</strong>
          {result ? (
            <div className="mini-strength-list">
              {(Object.keys(result.round2.strengths) as Array<
                keyof typeof result.round2.strengths
              >).map((key) => (
                <span key={key}>
                  {strengthMeta[key].label}:{" "}
                  {result.round2.strengths[key].score}
                </span>
              ))}
            </div>
          ) : (
            <p>Trung bình Delegation, Description và Discernment.</p>
          )}
        </article>
        <article className="overall-summary-card">
          <p className="eyebrow">OVERALL · 4 CORE STRENGTHS</p>
          <h2>
            {result?.final.overall == null
              ? "N/A"
              : `${result.final.overall}/100`}
          </h2>
          <strong>{result?.final.band ?? "Không tính khi skip R1"}</strong>
          <p>{result?.final.formula}</p>
        </article>
      </section>
      {result && (
        <>
          <section className="score-architecture">
            <div className="score-architecture-head">
              <div>
                <p className="eyebrow orange">SCORE ARCHITECTURE</p>
                <h2>Round 1, Round 2 và điểm cuối liên kết thế nào?</h2>
              </div>
              <p>
                Ba năng lực thực hành dùng 30% Round 1 + 70% Round 2.
                Diligence lấy hoàn toàn từ Round 1.
              </p>
            </div>
            <div className="score-matrix-wrap">
              <table className="score-matrix">
                <thead>
                  <tr>
                    <th>Core strength</th>
                    <th>Round 1</th>
                    <th>Round 2</th>
                    <th>Final strength</th>
                  </tr>
                </thead>
                <tbody>
                  {(Object.keys(strengthMeta) as StrengthKey[]).map((key) => (
                    <tr key={key}>
                      <th>{strengthMeta[key].label}</th>
                      <td>{result.round1.strengthScores[key] ?? "N/A"}</td>
                      <td>
                        {key === "diligence"
                          ? "Không đo"
                          : result.round2.strengths[key].score}
                      </td>
                      <td>
                        <strong>
                          {result.final.strengths[key].score ?? "N/A"}
                        </strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="band-scale" aria-label="Thang năng lực">
              <span>Beginner · 0–39</span>
              <span>Advanced Beginner · 40–54</span>
              <span>Competence · 55–69</span>
              <span>Proficient · 70–84</span>
              <span>Expert · 85–100</span>
            </div>
          </section>
          <section className="result-section-head">
            <div>
              <p className="eyebrow">WHY THIS BAND</p>
              <h2>
                Vì sao kết quả là {result.final.band ?? result.round2.band}?
              </h2>
            </div>
            <p>{result.overallReasoning}</p>
          </section>
          <section className="executive-insights">
            <article className="positive">
              <span>NĂNG LỰC NỔI BẬT</span>
              <strong>
                {strongestResult
                  ? `${strengthMeta[strongestResult.key].label} · ${strongestResult.score}/100`
                  : "Chưa đủ dữ liệu"}
              </strong>
              <p>
                {strongestResult
                  ? result.final.strengths[strongestResult.key].strengths[0] ||
                    result.final.strengths[strongestResult.key].summary
                  : "Hoàn thành đầy đủ bài test để xác định."}
              </p>
            </article>
            <article className="priority">
              <span>ƯU TIÊN PHÁT TRIỂN</span>
              <strong>
                {priorityResult
                  ? `${strengthMeta[priorityResult.key].label} · ${priorityResult.score}/100`
                  : "Chưa đủ dữ liệu"}
              </strong>
              <p>
                {priorityResult
                  ? result.final.strengths[priorityResult.key].gaps[0] ||
                    result.final.strengths[priorityResult.key].summary
                  : "Hoàn thành đầy đủ bài test để xác định."}
              </p>
            </article>
          </section>
          <section className="strength-results four-strengths">
            {(Object.keys(strengthMeta) as StrengthKey[]).map((key, index) => {
              const strength = result.final.strengths[key];
              return (
                <article key={key}>
                  <div className="strength-head">
                    <span>0{index + 1}</span>
                    <div>
                      <h3>{strengthMeta[key].label}</h3>
                      <p>{strength.summary}</p>
                    </div>
                    {strength.score == null ? (
                      <div className="na-score">N/A</div>
                    ) : (
                      <ScoreRing score={strength.score} small />
                    )}
                  </div>
                  <div className="band-row">
                    <span>
                      {strength.score == null
                        ? "Không có dữ liệu"
                        : `Band ${bandForScore(strength.score).level}/5`}
                    </span>
                    <strong>{strength.band ?? "N/A"}</strong>
                  </div>
                  <div className="feedback good">
                    <h4>Điểm mạnh</h4>
                    <ul>
                      {strength.strengths.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="feedback improve">
                    <h4>Cần cải thiện</h4>
                    <ul>
                      {strength.gaps.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>
                  <details className="score-logic">
                    <summary>
                      Cách tính điểm tổng hợp{" "}
                      {strength.score == null ? "N/A" : `${strength.score}/100`}
                    </summary>
                    {strength.breakdown.map((item) => (
                      <div key={item.criterion}>
                        <span>{item.criterion}</span>
                        <strong>
                          {item.awarded}/{item.max}
                        </strong>
                        <p>{item.reason}</p>
                        {item.evidence && <em>Evidence: {item.evidence}</em>}
                      </div>
                    ))}
                  </details>
                  {key !== "diligence" && (
                    <details className="score-logic round2-rubric">
                      <summary>
                        Rubric Round 2 ·{" "}
                        {result.round2.strengths[key].score}/100
                      </summary>
                      {result.round2.strengths[key].breakdown.map((item) => (
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
                    </details>
                  )}
                </article>
              );
            })}
          </section>
          <section className="grader-note">
            <div className="ai-avatar">AI</div>
            <div>
              <p className="eyebrow orange">
                TALEMY AI GRADER · {result.graderMode.replaceAll("_", " ")} ·
                CONFIDENCE {result.confidence.toUpperCase()}
              </p>
              <h2>Reasoning cho người chấm đã được lưu</h2>
              <p>{result.reviewerReasoning.join(" ")}</p>
              <strong>
                Không dùng điểm này làm căn cứ duy nhất cho quyết định tuyển dụng.
              </strong>
            </div>
          </section>
        </>
      )}
      {!result && error && (
        <div className="center-action">
          <button
            type="button"
            className="primary-button"
            onClick={() => void submitFinal(false)}
            disabled={submitting}
          >
            Thử chấm lại
          </button>
        </div>
      )}
      <footer className="result-footer">
        <div>
          <strong>
            {result
              ? "✓ Bài làm, transcript, điểm và reasoning đã lưu vào database"
              : "Bài làm đang được lưu"}
          </strong>
          <span>Assessment version: {ASSESSMENT_VERSION}</span>
        </div>
        <div>
          <button
            type="button"
            className="secondary-button"
            onClick={() => window.print()}
          >
            In / Lưu PDF
          </button>
          <button type="button" className="primary-button" onClick={resetAll}>
            Làm bài mới
          </button>
        </div>
      </footer>
    </main>
  );
}
