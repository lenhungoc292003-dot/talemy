import { desc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import { assessmentAttempts } from "../../../db/schema";
import { ASSESSMENT_DURATION_SECONDS } from "../../../lib/assessment";
import { getChatGPTUser, isReviewer } from "../../chatgpt-auth";

const safeText = (value: unknown, max = 5000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const jsonText = (value: unknown) => JSON.stringify(value ?? null);
const parseJson = (value: string | null) => {
  if (!value) return null;
  try { return JSON.parse(value) as unknown; } catch { return null; }
};

export async function POST(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const candidateName = safeText(payload.candidateName, 120);
    const role = safeText(payload.role, 120);
    if (!candidateName || !role) return Response.json({ error: "Thiếu tên hoặc nhóm vai trò." }, { status: 400 });

    const now = new Date();
    const attemptId = crypto.randomUUID();
    const expiresAt = new Date(now.getTime() + ASSESSMENT_DURATION_SECONDS * 1000);
    const db = getDb();
    await db.insert(assessmentAttempts).values({
      attemptId,
      candidateName,
      candidateEmail: safeText(payload.candidateEmail, 180),
      candidateCode: safeText(payload.candidateCode, 80),
      role,
      startedAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      lastSavedAt: now.toISOString(),
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });

    return Response.json({ attemptId, startedAt: now.toISOString(), expiresAt: expiresAt.toISOString() }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const payload = await request.json() as Record<string, unknown>;
    const attemptId = safeText(payload.attemptId, 80);
    if (!attemptId) return Response.json({ error: "Missing attemptId" }, { status: 400 });

    const now = new Date().toISOString();
    const updates: Partial<typeof assessmentAttempts.$inferInsert> = {
      updatedAt: now,
      lastSavedAt: now,
    };
    if (payload.currentStage != null) updates.currentStage = safeText(payload.currentStage, 40);
    if (payload.status != null) updates.status = safeText(payload.status, 40);
    if (payload.timeSpentSeconds != null) updates.timeSpentSeconds = Math.max(0, Math.round(Number(payload.timeSpentSeconds) || 0));
    if (payload.autoSubmitted != null) updates.autoSubmitted = Boolean(payload.autoSubmitted);
    if (payload.round1Score != null) updates.round1Score = Math.max(0, Math.round(Number(payload.round1Score) || 0));
    if (payload.round1Total != null) updates.round1Total = Math.max(1, Math.round(Number(payload.round1Total) || 36));
    if (payload.round1Band != null) updates.round1Band = safeText(payload.round1Band, 80);
    if (payload.round1Breakdown != null) updates.round1Breakdown = jsonText(payload.round1Breakdown);
    if (payload.delegationPlan != null) updates.delegationPlan = safeText(payload.delegationPlan, 6000);
    if (payload.keyFindings != null) updates.keyFindings = safeText(payload.keyFindings, 10000);
    if (payload.recommendation != null) updates.recommendation = safeText(payload.recommendation, 10000);
    if (payload.risks != null) updates.risks = safeText(payload.risks, 8000);
    if (payload.executiveSummary != null) updates.executiveSummary = safeText(payload.executiveSummary, 10000);
    if (payload.verificationNotes != null) updates.verificationNotes = safeText(payload.verificationNotes, 8000);
    if (payload.chatTranscript != null) updates.chatTranscript = jsonText(payload.chatTranscript);

    const db = getDb();
    const result = await db.update(assessmentAttempts).set(updates).where(eq(assessmentAttempts.attemptId, attemptId)).returning({ id: assessmentAttempts.id });
    if (!result.length) return Response.json({ error: "Không tìm thấy bài làm." }, { status: 404 });
    return Response.json({ saved: true, savedAt: now });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}

const serializeAttempt = (row: typeof assessmentAttempts.$inferSelect) => ({
  ...row,
  round1Breakdown: parseJson(row.round1Breakdown),
  chatTranscript: parseJson(row.chatTranscript),
  graderResult: parseJson(row.graderResult),
  round2Scores: parseJson(row.round2Scores),
});

export async function GET(request: Request) {
  const candidateAttemptId = safeText(new URL(request.url).searchParams.get("attemptId"), 80);
  if (candidateAttemptId) {
    try {
      const [row] = await getDb().select().from(assessmentAttempts).where(eq(assessmentAttempts.attemptId, candidateAttemptId)).limit(1);
      if (!row) return Response.json({ error: "Không tìm thấy bài làm." }, { status: 404 });
      return Response.json({ attempt: serializeAttempt(row) }, { headers: { "cache-control": "no-store" } });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unexpected error";
      return Response.json({ error: message }, { status: 500 });
    }
  }

  const user = await getChatGPTUser();
  if (!user || !isReviewer(user)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDb();
    const rows = await db.select().from(assessmentAttempts).orderBy(desc(assessmentAttempts.createdAt), desc(assessmentAttempts.id)).limit(250);
    return Response.json({
      reviewer: { name: user.displayName, email: user.email },
      attempts: rows.map(serializeAttempt),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
