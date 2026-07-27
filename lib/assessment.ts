export const ASSESSMENT_DURATION_SECONDS = 60 * 60;
export const DELEGATION_PART1_SECONDS = 7 * 60 + 30;
export const ASSESSMENT_VERSION = "talemy-4d-v3.0";

export type LevelName =
  | "Beginner"
  | "Advanced Beginner"
  | "Competence"
  | "Proficient"
  | "Expert";

export type StrengthKey =
  | "delegation"
  | "description"
  | "discernment"
  | "diligence";

export type Round2StrengthKey = Exclude<StrengthKey, "diligence">;
export type DescriptionTaskKey = "description_a" | "description_b";

export const strengthMeta: Record<
  StrengthKey,
  { label: string; short: string; description: string }
> = {
  delegation: {
    label: "Delegation",
    short: "Phân công đúng việc cho AI",
    description:
      "Biết khi nào nên tự làm, khi nào nên tham khảo AI và không phụ thuộc mù quáng vào gợi ý.",
  },
  description: {
    label: "Description",
    short: "Mô tả yêu cầu rõ ràng",
    description:
      "Đưa đủ mục tiêu, bối cảnh, ràng buộc và định dạng; biết tinh chỉnh prompt sau phản hồi đầu tiên.",
  },
  discernment: {
    label: "Discernment",
    short: "Thẩm định đầu ra AI",
    description:
      "Phát hiện lỗi số liệu, logic, ràng buộc và đề xuất cách sửa trước khi dùng kết quả.",
  },
  diligence: {
    label: "Diligence",
    short: "Sử dụng AI có trách nhiệm",
    description:
      "Quan tâm đến kiểm chứng, quyền riêng tư, fairness, rủi ro và trách nhiệm khi áp dụng AI.",
  },
};

export const delegationQuestions = [
  {
    id: "D01",
    seconds: 30,
    statement:
      "Một cửa hàng có 3 kệ sách, mỗi kệ 15 cuốn. Nhân viên vừa nhập thêm 2 thùng, mỗi thùng 10 cuốn. Kết luận: tổng số sách hiện có là 65 cuốn.",
  },
  {
    id: "D02",
    seconds: 30,
    statement:
      "Công ty họp lúc 14h, kéo dài 45 phút. Kết luận: cuộc họp kết thúc trước 15h.",
  },
  {
    id: "D03",
    seconds: 45,
    statement:
      "Có hai anh em sinh đôi, một người luôn nói thật, một người luôn nói dối. Hôm nay cả hai đang chơi trò đóng kịch nên cả hai đều nói dối. Người thứ nhất nói: “Tôi là người luôn nói thật.” Kết luận: người thứ nhất là người luôn nói thật.",
  },
  {
    id: "D04",
    seconds: 30,
    statement:
      "Bạn đang chạy đua và vừa vượt qua người đang giữ vị trí thứ hai. Kết luận: bây giờ bạn đang giữ vị trí thứ nhất.",
  },
  {
    id: "D05",
    seconds: 30,
    statement:
      "Một thùng hàng hình hộp chữ nhật có chiều dài 5m, chiều rộng 4m, chiều cao 3m. Công thức thể tích là dài × rộng × cao. Kết luận: thể tích thùng hàng là 60m³.",
  },
  {
    id: "D06",
    seconds: 45,
    statement:
      "Đầu tư 200 triệu. Năm đầu lãi 15%. Năm hai lỗ 10% trên số tiền cuối năm đầu. Kết luận: sau 2 năm, số tiền còn lại trên 205 triệu.",
  },
  {
    id: "D07",
    seconds: 45,
    statement:
      "Công ty quy định: làm việc trên 12 tháng liên tục thì được nghỉ phép. Nghỉ phép quá 5 ngày/năm thì bị trừ lương 1 ngày cho mỗi ngày vượt. Nhân viên X đã làm 14 tháng và nghỉ 7 ngày phép năm nay. Kết luận: X bị trừ lương 2 ngày.",
  },
  {
    id: "D08",
    seconds: 30,
    statement:
      "Sông Amazon chảy qua lãnh thổ của nhiều quốc gia Nam Mỹ, bao gồm Brazil và Peru. Kết luận: sông Amazon đổ ra Thái Bình Dương.",
  },
  {
    id: "D09",
    seconds: 30,
    statement:
      "Kim tự tháp Giza ở Ai Cập được xây dựng trước khi người La Mã xây Đấu trường Colosseum. Kết luận: câu này đúng về mặt trình tự thời gian.",
  },
  {
    id: "D10",
    seconds: 45,
    statement:
      "Hai xe xuất phát cùng lúc từ hai điểm cách nhau 300km, chạy ngược chiều nhau. Vận tốc xe 1 là 55km/h, xe 2 là 65km/h. Kết luận: hai xe gặp nhau sau 2,5 giờ.",
  },
  {
    id: "D11",
    seconds: 45,
    statement:
      "Biển báo nhà hàng ghi: “Trẻ em phải có người lớn đi kèm.” Một người 17 tuổi đi một mình đến nhà hàng. Kết luận: theo đúng nghĩa đen biển báo, người này bắt buộc phải có người lớn đi kèm vì chưa đủ 18 tuổi.",
  },
  {
    id: "D12",
    seconds: 45,
    statement:
      "Biển báo công viên ghi: “Không mang theo xe đạp.” Một người dắt bộ xe đạp (không đạp) đi vào bên trong công viên. Kết luận: theo đúng tinh thần biển báo, người này vi phạm quy định.",
  },
] as const;

export const descriptionTasks: Record<
  DescriptionTaskKey,
  {
    label: string;
    title: string;
    brief: string;
    requirements: string[];
    starterPrompts: string[];
  }
> = {
  description_a: {
    label: "Task A · Travel Planning",
    title: "Lập kế hoạch chuyến đi Đà Nẵng 3 ngày 2 đêm",
    brief:
      "Bạn cần dùng Talemy AI để xây dựng một kế hoạch khả thi cho nhóm 4 đồng nghiệp khởi hành từ TP.HCM. Đây là bài đo cách bạn mô tả yêu cầu và tinh chỉnh prompt, không có một lịch trình duy nhất.",
    requirements: [
      "Tổng ngân sách tối đa 20 triệu VNĐ cho cả nhóm.",
      "Ưu tiên biển, văn hoá địa phương và ẩm thực; có 1 người ăn chay.",
      "Không xếp hoạt động trước 08:00; cần thời gian nghỉ hợp lý.",
      "Đầu ra cần có lịch trình, dự toán, giả định và phương án dự phòng.",
    ],
    starterPrompts: [
      "Hãy giúp tôi liệt kê những thông tin còn thiếu trước khi lập lịch trình.",
      "Tạo bảng lịch trình theo ngày, kèm chi phí ước tính và giả định.",
      "Kiểm tra kế hoạch vừa tạo có vượt ngân sách hoặc xung đột thời gian không.",
    ],
  },
  description_b: {
    label: "Task B · Academic Planning",
    title: "Lập kế hoạch hoàn thành bài academic report trong 7 ngày",
    brief:
      "Bạn cần dùng Talemy AI để lập kế hoạch cho một báo cáo 2.000 từ về ảnh hưởng của AI-generated content đến quyết định tuyển dụng. AI hỗ trợ lập kế hoạch; người học phải tự đọc nguồn và viết bài.",
    requirements: [
      "Sử dụng tối thiểu 5 nguồn academic có thể kiểm chứng.",
      "Trích dẫn theo APA 7; không được bịa nguồn hoặc DOI.",
      "Có mốc research, outline, draft, fact-check và revision trong 7 ngày.",
      "Đầu ra cần nêu tiêu chí kiểm tra độ tin cậy và ranh giới dùng AI.",
    ],
    starterPrompts: [
      "Chia bài 2.000 từ thành các phần và đề xuất số từ cho từng phần.",
      "Lập kế hoạch 7 ngày có milestone và deliverable rõ ràng.",
      "Tạo checklist kiểm chứng nguồn academic và tránh citation giả.",
    ],
  },
};

export const discernmentScenario = {
  title: "Kiểm tra báo cáo AI trước khi trình Head of Talent Acquisition",
  context:
    "Bạn là Talent Acquisition Analyst. Head of Talent Acquisition muốn chọn tối đa ba kênh sourcing cho quý tới. Trước khi trình khuyến nghị, bạn phải thẩm định phân tích do AI tạo ra.",
  requirements: [
    "Tổng chi phí sourcing không vượt 70 triệu VNĐ.",
    "Các kênh được chọn phải tạo ít nhất 25 hires.",
    "Weighted 90-day retention đạt ít nhất 88%.",
    "Average time-to-hire không vượt 32 ngày.",
    "Chọn không quá 3 kênh.",
  ],
  dataset: [
    {
      channel: "Referral",
      applicants: 80,
      qualified: 40,
      interviews: 28,
      offers: 17,
      hires: 15,
      costM: 30,
      tth: 24,
      retention: 93,
    },
    {
      channel: "LinkedIn",
      applicants: 240,
      qualified: 72,
      interviews: 40,
      offers: 18,
      hires: 12,
      costM: 96,
      tth: 34,
      retention: 83,
    },
    {
      channel: "Community",
      applicants: 110,
      qualified: 38,
      interviews: 24,
      offers: 13,
      hires: 10,
      costM: 25,
      tth: 31,
      retention: 90,
    },
    {
      channel: "Re-engagement",
      applicants: 60,
      qualified: 28,
      interviews: 18,
      offers: 11,
      hires: 9,
      costM: 12,
      tth: 21,
      retention: 89,
    },
    {
      channel: "University",
      applicants: 180,
      qualified: 54,
      interviews: 32,
      offers: 14,
      hires: 8,
      costM: 18,
      tth: 48,
      retention: 88,
    },
  ],
  aiOutput: [
    "Khuyến nghị chọn LinkedIn, Referral và University.",
    "Danh mục này là lựa chọn mạnh nhất vì tạo 35 hires trong khi vẫn nằm trong ngân sách 70 triệu VNĐ. Tổng chi phí là 68 triệu VNĐ. Ba kênh cũng đạt retention 90 ngày trung bình 88%, đáp ứng yêu cầu chất lượng.",
    "LinkedIn nên nhận tỷ trọng đầu tư lớn nhất vì tạo lượng applicants cao nhất và do đó có cost efficiency tốt nhất. Referral nên được duy trì vì chất lượng, còn University là cách chi phí thấp để bổ sung số lượng tuyển.",
    "Average time-to-hire của danh mục xấp xỉ 31 ngày nên kế hoạch đáp ứng yêu cầu tốc độ. Công ty nên phân bổ 50% ngân sách cho LinkedIn, 30% cho Referral và 20% cho University.",
  ],
};

export type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  taskKey?: DescriptionTaskKey;
  provider?: "gemini" | "workers_ai" | "deterministic_fallback";
  createdAt?: string;
};

export type Round1Tally = Record<
  "D" | "Desc" | "Disc" | "Dil",
  { correct: number; total: number; strengths: string[]; gaps: string[] }
>;

export type Round1Result = {
  score: number;
  total: number;
  overallPct: number;
  band: { num: string; name: string; desc: string };
  tally: Round1Tally;
  completedAt: string;
};

export type DelegationAnswer = "true" | "false" | null;

export type DelegationBreakdownItem = {
  id: string;
  statement: string;
  part1Answer: Exclude<DelegationAnswer, null>;
  finalAnswer: Exclude<DelegationAnswer, null>;
  consulted: boolean;
  part1Correct: boolean;
  finalCorrect: boolean;
  feedback: string;
  tone: "good" | "warning" | "bad";
};

export type DelegationResult = {
  score: number;
  band: LevelName;
  humanAlone: number;
  aiAlone: number;
  teamPerformance: number;
  selectivity: { matched: number; total: number; score: number };
  calibrationScore: number;
  interpretation: string;
  breakdown: DelegationBreakdownItem[];
};

export type DescriptionWork = Record<
  DescriptionTaskKey,
  {
    finalPrompt: string;
    finalPlan: string;
    reflection: string;
    messages: ChatMessage[];
  }
>;

export type DiscernmentFinding = {
  id: string;
  problem: string;
  why: string;
  improvement: string;
};

export type ScoreBreakdownItem = {
  criterion: string;
  max: number;
  awarded: number;
  reason: string;
  evidence?: string;
};

export type StrengthResult = {
  score: number | null;
  band: LevelName | null;
  summary: string;
  strengths: string[];
  gaps: string[];
  breakdown: ScoreBreakdownItem[];
  evidence: string[];
};

export type DiscernmentErrorResult = {
  code: string;
  type: string;
  detected: boolean;
  pointsAwarded: number;
  maxPoints: number;
  candidateEvidence: string;
  feedback: string;
};

export type FinalAssessmentResult = {
  assessmentVersion: string;
  gradingVersion: string;
  graderMode: "gemini" | "workers_ai" | "deterministic_fallback";
  confidence: "low" | "medium" | "high";
  skippedRound1: boolean;
  round1: {
    score: number | null;
    total: number | null;
    percent: number | null;
    band: LevelName | null;
    strengthScores: Record<StrengthKey, number | null>;
  };
  round2: {
    score: number;
    band: LevelName;
    strengths: Record<Round2StrengthKey, StrengthResult>;
    delegation: DelegationResult;
    discernmentErrors: DiscernmentErrorResult[];
  };
  final: {
    overall: number | null;
    band: LevelName | null;
    strengths: Record<StrengthKey, StrengthResult>;
    formula: string;
    note: string;
  };
  overallReasoning: string;
  reviewerReasoning: string[];
  completedAt: string;
};

export function bandForScore(score: number): { level: number; name: LevelName } {
  if (score >= 85) return { level: 5, name: "Expert" };
  if (score >= 70) return { level: 4, name: "Proficient" };
  if (score >= 55) return { level: 3, name: "Competence" };
  if (score >= 40) return { level: 2, name: "Advanced Beginner" };
  return { level: 1, name: "Beginner" };
}

export function normalizeLegacyBand(value: string): LevelName {
  if (value === "Novice") return "Beginner";
  if (value === "Competent") return "Competence";
  if (
    value === "Beginner" ||
    value === "Advanced Beginner" ||
    value === "Competence" ||
    value === "Proficient" ||
    value === "Expert"
  ) {
    return value;
  }
  return "Beginner";
}

export function round1StrengthScores(
  result: Round1Result | null,
): Record<StrengthKey, number | null> {
  const pct = (key: keyof Round1Tally) => {
    const row = result?.tally?.[key];
    return row?.total ? Math.round((row.correct / row.total) * 100) : null;
  };
  return {
    delegation: pct("D"),
    description: pct("Desc"),
    discernment: pct("Disc"),
    diligence: pct("Dil"),
  };
}

export function formatTime(seconds: number) {
  const safe = Math.max(0, seconds);
  const minutes = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

export function cleanAiText(value: string) {
  return value
    .replace(/\*{3,}/g, "")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^\s*\*\s+/gm, "- ")
    .replace(/^#{1,6}\s+/gm, "")
    .trim();
}

/*
 * Compatibility exports for the local vinext API routes. Production candidate
 * and reviewer traffic uses the versioned D1 gateway, but keeping these shapes
 * lets the bundled Sites project build while the legacy local routes are phased
 * out.
 */
export const businessBrief = {
  budget: "Tối đa 70 triệu VNĐ",
  hiringGoal: "Ít nhất 25 hires",
  qualityGoal: "Weighted retention ít nhất 88%",
  speedGoal: "Average time-to-hire không quá 32 ngày",
  decision: "Chọn tối đa 3 kênh",
};

export const datasetMarkdown = discernmentScenario.dataset
  .map(
    (row) =>
      `${row.channel}: hires ${row.hires}, cost ${row.costM}M, TTH ${row.tth}, retention ${row.retention}%`,
  )
  .join("\n");

export const gradingRubric = {
  delegation: [
    { criterion: "Team performance", max: 60 },
    { criterion: "Độ chọn lọc", max: 20 },
    { criterion: "Xử lý gợi ý AI", max: 20 },
  ],
  description: [
    { criterion: "Mục tiêu, bối cảnh và ràng buộc", max: 20 },
    { criterion: "Yêu cầu cụ thể và cấu trúc đầu ra", max: 20 },
    { criterion: "Thông tin, giả định và câu hỏi làm rõ", max: 15 },
    { criterion: "Tinh chỉnh qua nhiều lượt tương tác", max: 20 },
    { criterion: "Kiểm chứng và human control", max: 15 },
    { criterion: "Thích ứng giữa hai task", max: 10 },
  ],
  discernment: [
    { criterion: "Ground-truth detection", max: 75 },
    { criterion: "Explanation", max: 12 },
    { criterion: "Improvement", max: 13 },
  ],
} as const;

export type CandidateWork = {
  delegationPlan: string;
  keyFindings: string;
  recommendation: string;
  risks: string;
  executiveSummary: string;
  verificationNotes: string;
};

export type LegacyStrengthGrade = {
  score: number;
  band: string;
  summary: string;
  evidence: Array<{ source: string; quote: string; why: string }>;
  strengths: string[];
  gaps: string[];
  scoringBreakdown: Array<{
    criterion: string;
    max: number;
    awarded: number;
    reason: string;
  }>;
};

export type AiGrade = {
  overall: number;
  band: string;
  bandReason: string;
  confidence: "low" | "medium" | "high";
  strengths: Record<Round2StrengthKey, LegacyStrengthGrade>;
  overallSynthesis: string;
  decisionQuality: string;
  redFlags: string[];
  reviewerNotes: string[];
};
