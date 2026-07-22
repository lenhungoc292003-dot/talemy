import { desc } from "drizzle-orm";
import { getDb } from "../../../../db";
import { assessmentAttempts } from "../../../../db/schema";
import { getChatGPTUser, isReviewer } from "../../../chatgpt-auth";

const csvCell = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
const json = (value: string | null) => {
  try { return value ? JSON.parse(value) as Record<string, unknown> : null; } catch { return null; }
};

export async function GET() {
  const user = await getChatGPTUser();
  if (!user || !isReviewer(user)) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await getDb().select().from(assessmentAttempts).orderBy(desc(assessmentAttempts.createdAt), desc(assessmentAttempts.id));
  const headers = [
    "attempt_id", "candidate_name", "candidate_email", "candidate_code", "role", "status",
    "started_at", "completed_at", "time_spent_seconds", "auto_submitted",
    "round1_score", "round1_total", "round1_band", "round2_overall", "round2_band",
    "delegation_score", "description_score", "discernment_score", "band_reason",
    "delegation_plan", "key_findings", "recommendation", "risks", "executive_summary",
    "verification_notes", "chat_transcript", "grader_result",
  ];
  const lines = rows.map((row) => {
    const scores = json(row.round2Scores) as Record<string, number> | null;
    const grade = json(row.graderResult);
    return [
      row.attemptId, row.candidateName, row.candidateEmail, row.candidateCode, row.role, row.status,
      row.startedAt, row.completedAt, row.timeSpentSeconds, row.autoSubmitted,
      row.round1Score, row.round1Total, row.round1Band, row.round2Overall, row.round2Band,
      scores?.delegation, scores?.description, scores?.discernment, grade?.bandReason,
      row.delegationPlan, row.keyFindings, row.recommendation, row.risks, row.executiveSummary,
      row.verificationNotes, row.chatTranscript, row.graderResult,
    ].map(csvCell).join(",");
  });
  const csv = `\uFEFF${headers.map(csvCell).join(",")}\n${lines.join("\n")}`;
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="talemy-ai-assessment-${stamp}.csv"`,
      "cache-control": "no-store",
    },
  });
}
