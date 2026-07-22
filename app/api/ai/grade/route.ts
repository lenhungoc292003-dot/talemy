import { eq } from "drizzle-orm";
import { getDb } from "../../../../db";
import { assessmentAttempts } from "../../../../db/schema";
import { type CandidateWork, type ChatMessage } from "../../../../lib/assessment";
import { gradeAssessment } from "../../../../lib/openai";

const safeText = (value: unknown, max = 10000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const safeTranscript = (value: unknown): ChatMessage[] => Array.isArray(value)
  ? value.slice(-30).flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const message = item as Record<string, unknown>;
      if (message.role !== "user" && message.role !== "assistant") return [];
      const content = safeText(message.content, 4000);
      if (!content) return [];
      return [{ id: safeText(message.id, 100) || crypto.randomUUID(), role: message.role, content, createdAt: safeText(message.createdAt, 80) || undefined } satisfies ChatMessage];
    })
  : [];

export async function POST(request: Request) {
  let activeAttemptId = "";
  try {
    const payload = await request.json() as Record<string, unknown>;
    activeAttemptId = safeText(payload.attemptId, 80);
    const source = payload.work && typeof payload.work === "object" ? payload.work as Record<string, unknown> : {};
    const work: CandidateWork = {
      delegationPlan: safeText(source.delegationPlan, 6000),
      keyFindings: safeText(source.keyFindings, 10000),
      recommendation: safeText(source.recommendation, 10000),
      risks: safeText(source.risks, 8000),
      executiveSummary: safeText(source.executiveSummary, 10000),
      verificationNotes: safeText(source.verificationNotes, 8000),
    };
    const transcript = safeTranscript(payload.transcript);
    const autoSubmitted = Boolean(payload.autoSubmitted);
    const timeSpentSeconds = Math.max(0, Math.min(3600, Math.round(Number(payload.timeSpentSeconds) || 0)));
    if (!activeAttemptId) return Response.json({ error: "Missing attemptId" }, { status: 400 });
    if (!autoSubmitted && Object.values(work).some((value) => value.length < 40)) {
      return Response.json({ error: "Hãy hoàn thành đầy đủ các phần của báo cáo trước khi nộp." }, { status: 400 });
    }

    const db = getDb();
    const [attempt] = await db.select().from(assessmentAttempts).where(eq(assessmentAttempts.attemptId, activeAttemptId)).limit(1);
    if (!attempt) return Response.json({ error: "Không tìm thấy bài làm." }, { status: 404 });
    if (attempt.gradingStatus === "completed" && attempt.graderResult) {
      return Response.json({ grade: JSON.parse(attempt.graderResult), restored: true });
    }

    const now = new Date().toISOString();
    await db.update(assessmentAttempts).set({
      ...work,
      chatTranscript: JSON.stringify(transcript),
      timeSpentSeconds,
      autoSubmitted,
      currentStage: "grading",
      gradingStatus: "in_progress",
      lastSavedAt: now,
      updatedAt: now,
    }).where(eq(assessmentAttempts.attemptId, activeAttemptId));

    const grade = await gradeAssessment({ attemptId: activeAttemptId, work, transcript, timeSpentSeconds, autoSubmitted });
    const completedAt = new Date().toISOString();
    const scores = Object.fromEntries(Object.entries(grade.strengths).map(([key, value]) => [key, value.score]));
    await db.update(assessmentAttempts).set({
      status: autoSubmitted ? "timed_out" : "completed",
      currentStage: "results",
      completedAt,
      gradingStatus: "completed",
      graderResult: JSON.stringify(grade),
      round2Overall: grade.overall,
      round2Band: grade.band,
      round2Scores: JSON.stringify(scores),
      gradingVersion: "talemy-dataset-3d-gpt56-v2",
      lastSavedAt: completedAt,
      updatedAt: completedAt,
    }).where(eq(assessmentAttempts.attemptId, activeAttemptId));

    return Response.json({ grade });
  } catch (error) {
    if (activeAttemptId) {
      try {
        const now = new Date().toISOString();
        await getDb().update(assessmentAttempts).set({ gradingStatus: "error", updatedAt: now, lastSavedAt: now }).where(eq(assessmentAttempts.attemptId, activeAttemptId));
      } catch { /* Preserve the original error response. */ }
    }
    const message = error instanceof Error ? error.message : "Unexpected error";
    const publicMessage = message === "OPENAI_API_KEY_NOT_CONFIGURED"
      ? "Chưa thể chấm vì OpenAI API key chưa được cấu hình. Bài làm đã được lưu cho người chấm."
      : "AI Grader đang tạm thời gián đoạn. Bài làm đã được lưu và có thể chấm lại.";
    return Response.json({ error: publicMessage }, { status: 503 });
  }
}
