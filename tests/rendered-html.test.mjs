import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const projectFile = (path) => new URL(`../${path}`, import.meta.url);
const backendFile = (path) =>
  new URL(`../../talemy-api-pages/${path}`, import.meta.url);

test("renders the complete five-stage Talemy assessment flow", async () => {
  const [page, layout, assessment] = await Promise.all([
    readFile(projectFile("app/page.tsx"), "utf8"),
    readFile(projectFile("app/layout.tsx"), "utf8"),
    readFile(projectFile("lib/assessment.ts"), "utf8"),
  ]);

  assert.match(layout, /Talemy · AI Skill Assessment/);
  assert.match(page, /Bắt đầu Round 1/);
  assert.match(page, /Bỏ qua Round 1 để QC/);
  assert.match(page, /const stages = \["R1", "Delegation", "Description", "Discernment", "Report"\]/);
  assert.match(page, /Reviewer Center/);
  assert.match(page, /Talemy AI/);
  assert.doesNotMatch(page, /Copilot/i);
  assert.match(assessment, /ASSESSMENT_DURATION_SECONDS = 60 \* 60/);
  assert.match(assessment, /talemy-4d-v3\.0/);
});

test("keeps the original 36-question Round 1 bank and five requested bands", async () => {
  const round1 = await readFile(projectFile("public/round1.html"), "utf8");

  assert.equal((round1.match(/\{band:\d/g) ?? []).length, 36);
  assert.match(round1, /const TOTAL_EXPECTED = 36/);
  assert.match(round1, /talemy-round1-result/);
  assert.match(round1, /talemy-force-submit/);
  for (const band of [
    "Beginner",
    "Advanced Beginner",
    "Competence",
    "Proficient",
    "Expert",
  ]) {
    assert.match(round1, new RegExp(`name:"${band}"`));
  }
  assert.doesNotMatch(round1, /name:"Novice"/);
  assert.doesNotMatch(round1, /name:"Competent"/);
  await access(projectFile("public/talemy-logo.png"));
});

test("implements the 12-item two-part Delegation assessment without client-side answers", async () => {
  const [page, assessment, worker] = await Promise.all([
    readFile(projectFile("app/page.tsx"), "utf8"),
    readFile(projectFile("lib/assessment.ts"), "utf8"),
    readFile(backendFile("src/worker.js"), "utf8"),
  ]);

  const candidateDelegationBank = assessment.slice(
    assessment.indexOf("export const delegationQuestions"),
    assessment.indexOf("export const descriptionTasks"),
  );
  assert.equal((candidateDelegationBank.match(/id: "D\d{2}"/g) ?? []).length, 12);
  assert.doesNotMatch(candidateDelegationBank, /\bcorrect\s*:/);
  assert.doesNotMatch(candidateDelegationBank, /\bhint\s*:/);
  assert.match(page, /Quay lại/);
  assert.match(page, /QuestionNavigator/);
  assert.match(page, /tối đa 4 lượt tham khảo Talemy AI/i);
  assert.match(worker, /\/api\/delegation\/start/);
  assert.match(worker, /\/api\/delegation\/part1/);
  assert.match(worker, /\/api\/delegation\/hint/);
  assert.match(worker, /\/api\/delegation\/finalize/);
  assert.match(worker, /teamPerformance \* 0\.5/);
  assert.match(worker, /selectivityScore \* 0\.3/);
  assert.match(worker, /calibrationScore \* 0\.2/);
  assert.match(worker, /Không hỏi AI khi tự làm đúng/);
});

test("implements both Description work samples with a task-aware Talemy AI", async () => {
  const [page, assessment, worker] = await Promise.all([
    readFile(projectFile("app/page.tsx"), "utf8"),
    readFile(projectFile("lib/assessment.ts"), "utf8"),
    readFile(backendFile("src/worker.js"), "utf8"),
  ]);

  assert.match(assessment, /Đà Nẵng 3 ngày 2 đêm/);
  assert.match(assessment, /academic report trong 7 ngày/);
  assert.match(assessment, /Tổng ngân sách tối đa 20 triệu VNĐ/);
  assert.match(assessment, /tối thiểu 5 nguồn academic/);
  assert.match(page, /aria-label="Talemy AI"/);
  assert.match(worker, /description_a/);
  assert.match(worker, /description_b/);
  assert.match(worker, /localChatFallback/);
  assert.match(worker, /@cf\/meta\/llama-3\.1-8b-instruct-fast/);
  assert.match(worker, /provider: "workers_ai"/);
  assert.match(worker, /"gemini-3\.5-flash-lite"/);
  assert.doesNotMatch(worker, /"gemini-2\.5-flash-lite"/);
  assert.match(worker, /stripMarkdown/);
  assert.doesNotMatch(page, /\*\*\*/);
});

test("implements the specified Discernment scenario and eight-point rubric", async () => {
  const [assessment, worker] = await Promise.all([
    readFile(projectFile("lib/assessment.ts"), "utf8"),
    readFile(backendFile("src/worker.js"), "utf8"),
  ]);

  assert.match(assessment, /LinkedIn, Referral và University/);
  assert.match(assessment, /Tổng chi phí là 68 triệu VNĐ/);
  assert.match(worker, /F1/);
  assert.match(worker, /C1/);
  assert.match(worker, /F2/);
  assert.match(worker, /R1/);
  assert.match(worker, /O1/);
  assert.match(worker, /R2/);
  assert.match(worker, /explanationScore/);
  assert.match(worker, /improvementScore/);
  assert.match(worker, /responseMimeType: "application\/json"/);
  assert.match(worker, /responseJsonSchema: discernmentGradeSchema/);
  assert.match(worker, /gradeDiscernmentWithWorkersAi/);
});

test("uses the finalized 4D formulas and does not fabricate an overall after skipping Round 1", async () => {
  const [assessment, worker] = await Promise.all([
    readFile(projectFile("lib/assessment.ts"), "utf8"),
    readFile(backendFile("src/worker.js"), "utf8"),
  ]);

  assert.match(assessment, /if \(score >= 85\).*Expert/);
  assert.match(assessment, /if \(score >= 70\).*Proficient/);
  assert.match(assessment, /if \(score >= 55\).*Competence/);
  assert.match(assessment, /if \(score >= 40\).*Advanced Beginner/);
  assert.match(worker, /r1 \* 0\.3 \+ r2 \* 0\.7/);
  assert.match(worker, /Diligence được lấy 100% từ các câu Round 1/);
  assert.match(worker, /overall = skippedRound1/);
  assert.match(worker, /Round 1 skipped: không tính Overall\/Diligence/);
});

test("stores versioned attempts and exposes protected reviewer delete and Excel export", async () => {
  const [worker, schema, reviewer, reviewerPage, builder] = await Promise.all([
    readFile(backendFile("src/worker.js"), "utf8"),
    readFile(backendFile("schema.sql"), "utf8"),
    readFile(projectFile("app/reviewer/reviewer-client.tsx"), "utf8"),
    readFile(projectFile("app/reviewer/page.tsx"), "utf8"),
    readFile(projectFile("standalone/build.mjs"), "utf8"),
  ]);

  assert.match(schema, /assessment_version/);
  assert.match(schema, /delegation_state/);
  assert.match(schema, /final_result/);
  assert.match(worker, /DELETE FROM assessment_attempts/);
  assert.match(worker, /application\/vnd\.ms-excel/);
  assert.match(worker, /excelSheet\("Reasoning"/);
  assert.match(worker, /isReviewerRequest/);
  assert.match(worker, /rubric: reviewerRubric/);
  assert.match(reviewer, /Xuất Excel \(\.xls\)/);
  assert.match(reviewer, /Xoá lượt đang chọn/);
  assert.match(reviewer, /AUDITABLE SCORE MAP/);
  assert.match(reviewer, /Ground truth key/);
  assert.match(reviewer, /authorization: `Bearer/);
  assert.doesNotMatch(reviewerPage, /requireReviewer/);
  assert.match(builder, /docs\/reviewer\/index\.html/);
});
