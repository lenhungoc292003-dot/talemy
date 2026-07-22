import { env } from "cloudflare:workers";
import {
  businessBrief,
  datasetMarkdown,
  gradingRubric,
  type AiGrade,
  type CandidateWork,
  type ChatMessage,
} from "./assessment";

type OpenAIResponse = {
  output_text?: string;
  output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  error?: { message?: string };
};

const runtimeEnv = env as unknown as Record<string, string | undefined>;

function extractText(response: OpenAIResponse) {
  if (typeof response.output_text === "string" && response.output_text.trim()) return response.output_text.trim();
  return (response.output ?? [])
    .flatMap((item) => item.content ?? [])
    .map((item) => item.text ?? "")
    .join("\n")
    .trim();
}

async function callOpenAI(body: Record<string, unknown>) {
  const apiKey = runtimeEnv.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY_NOT_CONFIGURED");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json()) as OpenAIResponse;
  if (!response.ok) throw new Error(data.error?.message || `OpenAI request failed (${response.status})`);
  const text = extractText(data);
  if (!text) throw new Error("OpenAI returned an empty response");
  return text;
}

async function safetyIdentifier(attemptId: string) {
  const bytes = new TextEncoder().encode(attemptId);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

export async function askAnalysisCopilot(attemptId: string, messages: ChatMessage[]) {
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

  return callOpenAI({
    model: runtimeEnv.OPENAI_CHAT_MODEL || "gpt-5.6-luna",
    instructions,
    input: messages.slice(-14).map((message) => ({ role: message.role, content: message.content })),
    reasoning: { effort: "low" },
    text: { verbosity: "medium" },
    max_output_tokens: 1200,
    store: false,
    safety_identifier: await safetyIdentifier(attemptId),
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
  attemptId: string;
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
    delegationPlan: input.work.delegationPlan,
    chatTranscript: input.transcript.map((message) => ({ role: message.role, content: message.content })),
    finalReport: {
      keyFindings: input.work.keyFindings,
      recommendation: input.work.recommendation,
      risks: input.work.risks,
      executiveSummary: input.work.executiveSummary,
      verificationNotes: input.work.verificationNotes,
    },
  };

  const text = await callOpenAI({
    model: runtimeEnv.OPENAI_GRADER_MODEL || "gpt-5.6-terra",
    instructions,
    input: `Hãy chấm candidate packet sau:\n${JSON.stringify(candidatePacket)}`,
    reasoning: { effort: "medium" },
    text: {
      verbosity: "medium",
      format: {
        type: "json_schema",
        name: "talemy_ai_assessment_grade",
        strict: true,
        schema: gradeSchema,
      },
    },
    max_output_tokens: 5000,
    store: false,
    safety_identifier: await safetyIdentifier(input.attemptId),
  });

  return JSON.parse(text) as AiGrade;
}
