import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import { submissions } from "../../../db/schema";
import { getChatGPTUser } from "../../chatgpt-auth";

type SubmissionPayload = {
  candidateName?: string;
  candidateEmail?: string;
  candidateCode?: string;
  role?: string;
  round1Score?: number;
  round1Total?: number;
  round1Band?: string;
  round1Breakdown?: unknown;
  round2Overall?: number | null;
  round2Scores?: unknown;
  round2Feedback?: unknown;
  round2Answers?: unknown;
  chatTranscript?: unknown;
  gradingVersion?: string;
  completedAt?: string;
};

const jsonText = (value: unknown) => value == null ? null : JSON.stringify(value);
const safeText = (value: unknown, max = 240) => typeof value === "string" ? value.trim().slice(0, max) : "";
const parseJson = (value: string | null) => {
  if (!value) return null;
  try { return JSON.parse(value) as unknown; } catch { return null; }
};

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as SubmissionPayload;
    const candidateName = safeText(payload.candidateName, 120);
    const role = safeText(payload.role, 120);
    const round1Score = Number(payload.round1Score);
    const round1Total = Number(payload.round1Total);

    if (!candidateName || !role || !Number.isFinite(round1Score) || !Number.isFinite(round1Total)) {
      return Response.json({ error: "Thông tin kết quả chưa đầy đủ." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const db = getDb();
    const [submission] = await db.insert(submissions).values({
      candidateName,
      candidateEmail: safeText(payload.candidateEmail, 180),
      candidateCode: safeText(payload.candidateCode, 80),
      role,
      round1Score: Math.max(0, Math.round(round1Score)),
      round1Total: Math.max(1, Math.round(round1Total)),
      round1Band: safeText(payload.round1Band, 80) || "Unknown",
      round1Breakdown: jsonText(payload.round1Breakdown) || "{}",
      round2Overall: payload.round2Overall == null ? null : Math.max(0, Math.min(100, Math.round(Number(payload.round2Overall)))),
      round2Scores: jsonText(payload.round2Scores),
      round2Feedback: jsonText(payload.round2Feedback),
      round2Answers: jsonText(payload.round2Answers),
      chatTranscript: jsonText(payload.chatTranscript),
      gradingVersion: safeText(payload.gradingVersion, 80) || "talemy-r2-3d-v1",
      completedAt: safeText(payload.completedAt, 80) || now,
      createdAt: now,
    }).returning({ id: submissions.id });

    return Response.json({ submission }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const user = await getChatGPTUser();
  if (!user) return Response.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const db = getDb();
    const rows = await db.select().from(submissions).orderBy(desc(submissions.createdAt), desc(submissions.id)).limit(100);
    return Response.json({
      reviewer: { name: user.displayName, email: user.email },
      submissions: rows.map((row) => ({
        ...row,
        round1Breakdown: parseJson(row.round1Breakdown),
        round2Scores: parseJson(row.round2Scores),
        round2Feedback: parseJson(row.round2Feedback),
        round2Answers: parseJson(row.round2Answers),
        chatTranscript: parseJson(row.chatTranscript),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unexpected error";
    return Response.json({ error: message }, { status: 500 });
  }
}
