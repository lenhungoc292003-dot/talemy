export const ASSESSMENT_DURATION_SECONDS = 60 * 60;

export const recruitmentDataset = [
  { channel: "LinkedIn", applicants: 240, qualified: 72, interviews: 40, offers: 18, hires: 12, costM: 96, timeToHire: 34, retention90: 83 },
  { channel: "Referral", applicants: 80, qualified: 40, interviews: 28, offers: 17, hires: 15, costM: 30, timeToHire: 24, retention90: 93 },
  { channel: "Job boards", applicants: 420, qualified: 63, interviews: 35, offers: 12, hires: 8, costM: 56, timeToHire: 41, retention90: 75 },
  { channel: "Agency", applicants: 70, qualified: 35, interviews: 25, offers: 15, hires: 12, costM: 144, timeToHire: 29, retention90: 79 },
  { channel: "Community", applicants: 110, qualified: 38, interviews: 24, offers: 13, hires: 10, costM: 25, timeToHire: 31, retention90: 90 },
  { channel: "Re-engagement", applicants: 60, qualified: 28, interviews: 18, offers: 11, hires: 9, costM: 12, timeToHire: 21, retention90: 89 },
  { channel: "University", applicants: 180, qualified: 54, interviews: 32, offers: 14, hires: 8, costM: 18, timeToHire: 48, retention90: 88 },
  { channel: "Organic", applicants: 130, qualified: 33, interviews: 19, offers: 8, hires: 6, costM: 9, timeToHire: 37, retention90: 82 },
] as const;

export const businessBrief = {
  title: "Quyết định phân bổ ngân sách sourcing cho quý tới",
  budget: "Tối đa 120 triệu VNĐ",
  hiringGoal: "Tạo ít nhất 20 hires",
  qualityGoal: "Ưu tiên retention 90 ngày từ 85% trở lên",
  speedGoal: "Ưu tiên time-to-hire không quá 35 ngày",
  decision: "Chọn tối đa 3 kênh để ưu tiên và giải thích trade-off",
};

export const datasetMarkdown = `
| Kênh | Applicants | Qualified | Interviews | Offers | Hires | Cost (triệu VNĐ) | Time-to-hire (ngày) | Retention 90 ngày |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${recruitmentDataset.map((row) => `| ${row.channel} | ${row.applicants} | ${row.qualified} | ${row.interviews} | ${row.offers} | ${row.hires} | ${row.costM} | ${row.timeToHire} | ${row.retention90}% |`).join("\n")}
`.trim();

export const gradingRubric = {
  delegation: [
    { criterion: "Phân vai AI–con người", max: 30 },
    { criterion: "Dùng AI cho tính toán/tổng hợp phù hợp", max: 25 },
    { criterion: "Giữ quyết định và trách nhiệm ở con người", max: 25 },
    { criterion: "Nêu cách kiểm tra hoặc sửa đầu ra AI", max: 20 },
  ],
  description: [
    { criterion: "Brief có mục tiêu và bối cảnh", max: 25 },
    { criterion: "Nêu metric/ràng buộc cần phân tích", max: 25 },
    { criterion: "Yêu cầu đầu ra có cấu trúc", max: 20 },
    { criterion: "Có tương tác tiếp nối để đào sâu", max: 20 },
    { criterion: "Câu hỏi cụ thể, không giao toàn bộ quyết định", max: 10 },
  ],
  discernment: [
    { criterion: "Số liệu và phép tính chính xác", max: 30 },
    { criterion: "Chọn đúng vấn đề có ý nghĩa", max: 20 },
    { criterion: "Khuyến nghị bám dữ liệu và ràng buộc", max: 25 },
    { criterion: "Nêu trade-off, rủi ro hoặc giới hạn dữ liệu", max: 15 },
    { criterion: "Có bước kiểm chứng tiếp theo", max: 10 },
  ],
} as const;

export type StrengthKey = keyof typeof gradingRubric;

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  createdAt?: string;
};

export type CandidateWork = {
  delegationPlan: string;
  keyFindings: string;
  recommendation: string;
  risks: string;
  executiveSummary: string;
  verificationNotes: string;
};

export type ScoringBreakdownItem = {
  criterion: string;
  max: number;
  awarded: number;
  reason: string;
};

export type StrengthGrade = {
  score: number;
  band: string;
  summary: string;
  evidence: Array<{ source: string; quote: string; why: string }>;
  strengths: string[];
  gaps: string[];
  scoringBreakdown: ScoringBreakdownItem[];
};

export type AiGrade = {
  overall: number;
  band: string;
  bandReason: string;
  confidence: "low" | "medium" | "high";
  strengths: Record<StrengthKey, StrengthGrade>;
  overallSynthesis: string;
  decisionQuality: string;
  redFlags: string[];
  reviewerNotes: string[];
};

export function bandForScore(score: number) {
  if (score >= 85) return { level: 5, name: "Expert" };
  if (score >= 70) return { level: 4, name: "Proficient" };
  if (score >= 55) return { level: 3, name: "Competent" };
  if (score >= 40) return { level: 2, name: "Advanced Beginner" };
  return { level: 1, name: "Novice" };
}

export function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}
