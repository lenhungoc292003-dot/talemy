import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

test("renders the combined Talemy assessment landing page", async () => {
  const [page, layout] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(layout, /Talemy · AI Skill Assessment/);
  assert.match(page, /Hiểu AI là bước đầu/);
  assert.match(page, /Bắt đầu Round 1/);
  assert.match(page, /60:00/);
  assert.match(page, /Dành cho người chấm/);
  assert.match(page, /talemy-secure-api-proxy\.talemy-ngo-2026\.workers\.dev/);
  assert.match(page, /function reviewerUrl/);
});

test("keeps the original 36-question Round 1 bank and result bridge", async () => {
  const round1 = await readFile(new URL("../public/round1.html", import.meta.url), "utf8");
  assert.equal((round1.match(/\{band:\d/g) ?? []).length, 36);
  assert.match(round1, /const TOTAL_EXPECTED = 36/);
  assert.match(round1, /talemy-round1-result/);
  assert.match(round1, /talemy-force-submit/);
  assert.match(round1, /Advanced Beginner/);
  await access(new URL("../public/talemy-logo.png", import.meta.url));
});

test("Round 2 is a dataset analysis task scored on only three strengths", async () => {
  const [page, assessment, ai] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../lib/assessment.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/openai.ts", import.meta.url), "utf8"),
  ]);
  assert.match(assessment, /type StrengthKey = keyof typeof gradingRubric/);
  assert.match(assessment, /recruitmentDataset/);
  assert.match(page, /Round 2 không chấm Diligence/);
  assert.match(page, /Data-to-Decision/i);
  assert.match(ai, /api\.openai\.com\/v1\/responses/);
  assert.match(ai, /không đưa ra "đáp án mẫu"/);
  assert.match(page, /\/reviewer/);
});

test("stores attempts centrally and exposes a protected reviewer CSV export", async () => {
  const [schema, attemptsRoute, exportRoute, reviewerAuth, cors, reviewer, reviewerPage] = await Promise.all([
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/attempts/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/api/attempts/export/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/reviewer-auth.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/cors.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/reviewer/reviewer-client.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/reviewer/page.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(schema, /assessmentAttempts/);
  assert.match(attemptsRoute, /crypto\.randomUUID/);
  assert.match(exportRoute, /text\/csv/);
  assert.match(reviewerAuth, /REVIEWER_ACCESS_KEY/);
  assert.match(reviewerAuth, /constantTimeEqual/);
  assert.match(attemptsRoute, /isReviewerRequest/);
  assert.match(exportRoute, /isReviewerRequest/);
  assert.match(cors, /lenhungoc292003-dot\.github\.io/);
  assert.match(cors, /content-type, authorization/);
  assert.match(attemptsRoute, /corsOptions/);
  assert.match(exportRoute, /corsOptions/);
  assert.match(reviewer, /Logic tính điểm/);
  assert.match(reviewer, /Xuất CSV \/ Excel/);
  assert.match(reviewer, /type="password"/);
  assert.match(reviewer, /authorization: `Bearer/);
  assert.doesNotMatch(reviewerPage, /requireReviewer/);
});
