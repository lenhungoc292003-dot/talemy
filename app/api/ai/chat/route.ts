import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { assessmentAttempts } from "../../../../db/schema";
import { type ChatMessage } from "../../../../lib/assessment";
import { askAnalysisCopilot } from "../../../../lib/gemini";
import { corsJson, corsOptions } from "../../../../lib/cors";

export const OPTIONS = corsOptions;

const safeMessages = (value: unknown): ChatMessage[] => {
  if (!Array.isArray(value)) return [];
  return value.slice(-14).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const candidate = item as Record<string, unknown>;
    if (candidate.role !== "user" && candidate.role !== "assistant") return [];
    const content = typeof candidate.content === "string" ? candidate.content.trim().slice(0, 3000) : "";
    if (!content) return [];
    return [{
      id: typeof candidate.id === "string" ? candidate.id.slice(0, 100) : crypto.randomUUID(),
      role: candidate.role,
      content,
      createdAt: typeof candidate.createdAt === "string" ? candidate.createdAt.slice(0, 80) : undefined,
    } satisfies ChatMessage];
  });
};

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const attemptId = typeof payload.attemptId === "string" ? payload.attemptId.trim().slice(0, 80) : "";
    const messages = safeMessages(payload.messages);
    if (!attemptId || !messages.length || messages.at(-1)?.role !== "user") {
      return corsJson(request, { error: "Yêu cầu chat chưa hợp lệ." }, { status: 400 });
    }

    const db = getDb();
    const [attempt] = await db.select().from(assessmentAttempts).where(eq(assessmentAttempts.attemptId, attemptId)).limit(1);
    if (!attempt) return corsJson(request, { error: "Không tìm thấy bài làm." }, { status: 404 });
    if (attempt.status !== "in_progress") return corsJson(request, { error: "Bài làm đã kết thúc." }, { status: 409 });
    if (new Date(attempt.expiresAt).getTime() < Date.now()) return corsJson(request, { error: "Đã hết thời gian làm bài." }, { status: 410 });
    if (attempt.aiCallCount >= 20) return corsJson(request, { error: "Bạn đã dùng hết 20 lượt trao đổi với Talemy AI." }, { status: 429 });

    const reply = await askAnalysisCopilot(messages);
    const assistantMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: reply,
      createdAt: new Date().toISOString(),
    };
    const transcript = [...messages, assistantMessage];
    const now = new Date().toISOString();
    await db.update(assessmentAttempts).set({
      chatTranscript: JSON.stringify(transcript),
      aiCallCount: attempt.aiCallCount + 1,
      lastSavedAt: now,
      updatedAt: now,
    }).where(eq(assessmentAttempts.attemptId, attemptId));

    return corsJson(request, { message: assistantMessage, remainingCalls: 19 - attempt.aiCallCount });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    console.error("Talemy Gemini chat failed", { message: message.slice(0, 500) });
    const publicMessage = message === "GEMINI_API_KEY_NOT_CONFIGURED"
      ? "Talemy AI chưa được cấu hình API key trên môi trường production."
      : "Talemy AI đang tạm thời không phản hồi. Bài làm của bạn vẫn được lưu.";
    return corsJson(request, { error: publicMessage }, { status: 503 });
  }
}
