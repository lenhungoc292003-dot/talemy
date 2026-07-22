import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const submissions = sqliteTable("submissions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  candidateName: text("candidate_name").notNull(),
  candidateEmail: text("candidate_email").notNull().default(""),
  candidateCode: text("candidate_code").notNull().default(""),
  role: text("role").notNull(),
  round1Score: integer("round1_score").notNull(),
  round1Total: integer("round1_total").notNull(),
  round1Band: text("round1_band").notNull(),
  round1Breakdown: text("round1_breakdown").notNull(),
  round2Overall: integer("round2_overall"),
  round2Scores: text("round2_scores"),
  round2Feedback: text("round2_feedback"),
  round2Answers: text("round2_answers"),
  chatTranscript: text("chat_transcript"),
  gradingVersion: text("grading_version").notNull(),
  completedAt: text("completed_at").notNull(),
  createdAt: text("created_at").notNull(),
});
