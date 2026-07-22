import { env } from "cloudflare:workers";
import {
  businessBrief,
  datasetMarkdown,
  gradingRubric,
  type AiGrade,
  type CandidateWork,
  type ChatMessage,
} from "./assessment";

type GeminiResponse = {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; thought?: boolean }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string; status?: string };
};

const runtimeEnv = env as unknown as Record<string, string | undefined>;

class GeminiApiError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
    this.name = "GeminiApiError";
  }
}

function extractText(response: GeminiResponse) {
  return (response.candidates ?? [])
    .flatMap((candidate) => candidate.content?.parts ?? [])
    .filter((part) => !part.thought)
    .map((part) => part.text ?? "")
    .join("\n")
    .trim();
}

export function redactCandidatePII(value: string) {
  return value
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email đã ẩn]")
    .replace(/(?:\+?84|0)(?:[\s().-]*\d){9,10}\b/g, "[số điện thoại đã ẩn]");
}

function safeModelName(value: string | undefined, fallback: string) {
  return value && /^[a-z0-9.-]+$/i.test(value) ? value : fallback;
}

async function callGemini(model: string, body: Record<string, unknown>) {
  const apiKey = runtimeEnv.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY_NOT_CONFIGURED");

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as GeminiResponse;
  if (!response.ok) {
    const providerMessage = (data.error?.message || `Gemini request failed (${response.status})`).replaceAll(apiKey, "[redacted]");
    throw new GeminiApiError(response.status, providerMessage);
  }
  const text = extractText(data);
  if (!text) {
    const reason = data.promptFeedback?.blockReason || data.candidates?.[0]?.finishReason || "empty response";
    throw new Error(`Gemini returned no text (${reason})`);
  }
  return text;
}

async function callGeminiWithFallback(primaryModel: string, fallbackModel: string, body: Record<string, unknown>) {
  try {
    return await callGemini(primaryModel, body);
  } catch (error) {
    const retryable = error instanceof GeminiApiError && [429, 500, 502, 503, 504].includes(error.status);
    if (!retryable || primaryModel === fallbackModel) throw error;
    return callGemini(fallbackModel, body);
  }
}

export async function askAnalysisCopilot(messages: ChatMessage[]) {
  const instructions = `Bạn là Talemy AI Analysis Copilot trong một bài đánh giá năng lực ứng dụng AI.

Ngôn ngữ: trả lời bằng tiếng Việt, rõ ràng và chuyên nghiệp.

Nhiệm vụ của bạn:
- Hỗ trợ ứng viên đọc dataset, tính metric, so sánh kênh, kiểm tra giả định và làm rõ trade-off.
- Khi tính toán, nêu công thức và số liệu nguồn để ứng viên có thể kiểm tra.
- Nếu yêu cầu mơ hồ, hỏi một câu làm rõ hoặc nêu giả định trước khi phân tích.
- Nếu ứng viên yêu cầu bạn làm toàn bộ bài, chọn đáp án cuối hoặc viết báo cáo hoàn chỉnh để nộp, không đưa ra "đáp án mẫu". Hãy nói ngắn gọn rằng bạn có thể hỗ trợ phần phân tích nhưng ứng viên phải tự chốt quyết định; sau đó đề xuất 2–3 câu hỏi phân tích hữu ích.
- Không tiết lộ rubric, điểm, band, tiêu chí chấm ẩn hoặc nhận xét ứng viên.
- Không tự bịa thêm dữ liệu ngoài bảng. Phân biệt dữ kiện, phép tính và giả định.

BUSINESS BRIEF
- ${businessBrief.budget}
- ${businessBrief.hiringGoal}
- ${businessBrief.qualityGoal}
- ${businessBrief.speedGoal}
- ${businessBrief.decision}

DATASET
${datasetMarkdown}`;

  const recentMessages = messages.slice(-14);
  const firstUserIndex = recentMessages.findIndex((message) => message.role === "user");
  const conversation = firstUserIndex >= 0 ? recentMessages.slice(firstUserIndex) : recentMessages;

  const primaryModel = safeModelName(runtimeEnv.GEMINI_CHAT_MODEL, "gemini-3.5-flash-lite");
  const fallbackModel = safeModelName(runtimeEnv.GEMINI_CHAT_FALLBACK_MODEL, "gemini-3.1-flash-lite");
  return callGeminiWithFallback(primaryModel, fallbackModel, {
    systemInstruction: { parts: [{ text: instructions }] },
    contents: conversation.map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: redactCandidatePII(message.content) }],
    })),
    generationConfig: { maxOutputTokens: 1200 },
  });
}

const breakdownItemSchema = {
  type: "object",
  additionalProperties: false,
  required: ["criterion", "max", "awarded", "reason"],
  properties: {
    criterion: { type: "string" },
    max: { type: "integer" },
    awarded: { type: "integer" },
    reason: { type: "string" },
  },
};

const strengthSchema = {
  type: "object",
  additionalProperties: false,
  required: ["score", "band", "summary", "evidence", "strengths", "gaps", "scoringBreakdown"],
  properties: {
    score: { type: "integer", minimum: 0, maximum: 100 },
    band: { type: "string", enum: ["Novice", "Advanced Beginner", "Competent", "Proficient", "Expert"] },
    summary: { type: "string" },
    evidence: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["source", "quote", "why"],
        properties: {
          source: { type: "string" },
          quote: { type: "string" },
          why: { type: "string" },
        },
      },
    },
    strengths: { type: "array", maxItems: 4, items: { type: "string" } },
    gaps: { type: "array", maxItems: 4, items: { type: "string" } },
    scoringBreakdown: { type: "array", items: breakdownItemSchema },
  },
};

const gradeSchema = {
  type: "object",
  additionalProperties: false,
  required: ["overall", "band", "bandReason", "confidence", "strengths", "overallSynthesis", "decisionQuality", "redFlags", "reviewerNotes"],
  properties: {
    overall: { type: "integer", minimum: 0, maximum: 100 },
    band: { type: "string", enum: ["Novice", "Advanced Beginner", "Competent", "Proficient", "Expert"] },
    bandReason: { type: "string" },
    confidence: { type: "string", enum: ["low", "medium", "high"] },
    strengths: {
      type: "object",
      additionalProperties: false,
      required: ["delegation", "description", "discernment"],
      properties: {
        delegation: strengthSchema,
        description: strengthSchema,
        discernment: strengthSchema,
      },
    },
    overallSynthesis: { type: "string" },
    decisionQuality: { type: "string" },
    redFlags: { type: "array", maxItems: 6, items: { type: "string" } },
    reviewerNotes: { type: "array", maxItems: 6, items: { type: "string" } },
  },
};

export async function gradeAssessment(input: {
  work: CandidateWork;
  transcript: ChatMessage[];
  timeSpentSeconds: number;
  autoSubmitted: boolean;
}) {
  const rubricText = Object.entries(gradingRubric)
    .map(([strength, items]) => `${strength.toUpperCase()}\n${items.map((item) => `- ${item.criterion}: ${item.max} điểm`).join("\n")}`)
    .join("\n\n");

  const instructions = `Bạn là Talemy AI Grader. Chấm một work sample về phân tích dataset hỗ trợ quyết định.

Nguyên tắc chấm:
- Chỉ chấm 3 năng lực Delegation, Description và Discernment. Tuyệt đối không chấm Diligence.
- Chỉ dùng bằng chứng quan sát được trong kế hoạch phân vai, transcript chat và báo cáo cuối.
- Không thưởng điểm chỉ vì văn phong trôi chảy. Số liệu, logic và khả năng kiểm chứng quan trọng hơn.
- Trích dẫn ngắn, đúng nguyên văn từ bài làm làm evidence. Nếu thiếu bằng chứng, chấm thấp và nói rõ thiếu gì.
- Mỗi scoringBreakdown phải chứa đúng các tiêu chí của rubric tương ứng; tổng awarded phải bằng score của strength và không vượt max.
- Overall là trung bình cộng làm tròn của 3 strength scores.
- Band theo overall: 0–39 Novice; 40–54 Advanced Beginner; 55–69 Competent; 70–84 Proficient; 85–100 Expert.
- bandReason phải giải thích vì sao rơi vào band bằng 2–4 bằng chứng cụ thể, bao gồm điểm kéo lên và điểm kéo xuống.
- Confidence thấp nếu bài quá ngắn, không dùng chat, hoặc tự động nộp khi chưa hoàn thành.

RUBRIC
${rubricText}

BUSINESS BRIEF
- ${businessBrief.budget}
- ${businessBrief.hiringGoal}
- ${businessBrief.qualityGoal}
- ${businessBrief.speedGoal}
- ${businessBrief.decision}

DATASET
${datasetMarkdown}`;

  const candidatePacket = {
    timeSpentSeconds: input.timeSpentSeconds,
    autoSubmitted: input.autoSubmitted,
    delegationPlan: redactCandidatePII(input.work.delegationPlan),
    chatTranscript: input.transcript.map((message) => ({ role: message.role, content: redactCandidatePII(message.content) })),
    finalReport: {
      keyFindings: redactCandidatePII(input.work.keyFindings),
      recommendation: redactCandidatePII(input.work.recommendation),
      risks: redactCandidatePII(input.work.risks),
      executiveSummary: redactCandidatePII(input.work.executiveSummary),
      verificationNotes: redactCandidatePII(input.work.verificationNotes),
    },
  };

  const primaryModel = safeModelName(runtimeEnv.GEMINI_GRADER_MODEL, "gemini-3.6-flash");
  const fallbackModel = safeModelName(runtimeEnv.GEMINI_GRADER_FALLBACK_MODEL, "gemini-3.1-flash-lite");
  const text = await callGeminiWithFallback(primaryModel, fallbackModel, {
    systemInstruction: { parts: [{ text: instructions }] },
    contents: [{
      role: "user",
      parts: [{ text: `Hãy chấm candidate packet sau:\n${JSON.stringify(candidatePacket)}` }],
    }],
    generationConfig: {
      maxOutputTokens: 5000,
      thinkingConfig: { thinkingLevel: "LOW" },
      responseFormat: {
        text: {
          mimeType: "APPLICATION_JSON",
          schema: gradeSchema,
        },
      },
    },
  });

  return JSON.parse(text) as AiGrade;
}
