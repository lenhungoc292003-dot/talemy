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
  assert.match(page, /Dành cho người chấm/);
});

test("keeps the original 36-question Round 1 bank and result bridge", async () => {
  const round1 = await readFile(new URL("../public/round1.html", import.meta.url), "utf8");
  assert.equal((round1.match(/\{band:\d/g) ?? []).length, 36);
  assert.match(round1, /const TOTAL_EXPECTED = 36/);
  assert.match(round1, /talemy-round1-result/);
  assert.match(round1, /Advanced Beginner/);
  await access(new URL("../public/talemy-logo.png", import.meta.url));
});

test("Round 2 scores only Delegation, Description, and Discernment", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  assert.match(page, /type StrengthKey = "delegation" \| "description" \| "discernment"/);
  assert.match(page, /Round 2 không chấm Diligence/);
  assert.match(page, /TALEMY AI GRADER/i);
  assert.match(page, /\/reviewer/);
});
