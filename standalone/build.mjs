import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { build } from "esbuild";

const root = resolve(import.meta.dirname, "..");
const outputPath = resolve(root, "docs/index.html");
const reviewerOutputPath = resolve(root, "docs/reviewer/index.html");

async function bundleEntry(entry) {
  const bundle = await build({
    entryPoints: [resolve(root, entry)],
    bundle: true,
    write: false,
    format: "iife",
    platform: "browser",
    minify: true,
    loader: { ".tsx": "tsx" },
  });
  return bundle.outputFiles[0].text;
}

const [javascript, reviewerJavascript] = await Promise.all([
  bundleEntry("standalone/entry.tsx"),
  bundleEntry("standalone/reviewer-entry.tsx"),
]);
const logoDataUrl = `data:image/png;base64,${(await readFile(resolve(root, "public/talemy-logo.png"))).toString("base64")}`;

const css = (await readFile(resolve(root, "app/globals.css"), "utf8"))
  .replace('@import "tailwindcss";', "")
  .replaceAll("</style", "<\\/style");

const html = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Bài đánh giá hai vòng đo AI literacy và năng lực ứng dụng AI trong công việc.">
  <meta name="theme-color" content="#050505">
  <title>Talemy · AI Skill Assessment</title>
  <style>${css}</style>
</head>
<body>
  <div id="root"></div>
  <script>${javascript.replaceAll("</script", "<\\/script")}</script>
</body>
</html>`.replaceAll("./talemy-logo.png", logoDataUrl);

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, html, "utf8");
const reviewerHtml = `<!doctype html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Talemy Reviewer Center cho kết quả, transcript và reasoning chấm điểm.">
  <meta name="theme-color" content="#050505">
  <title>Talemy · Reviewer Center</title>
  <style>${css}</style>
</head>
<body>
  <div id="root"></div>
  <script>${reviewerJavascript.replaceAll("</script", "<\\/script")}</script>
</body>
</html>`
  .replaceAll("../talemy-logo.png", logoDataUrl)
  .replaceAll("./talemy-logo.png", logoDataUrl);

await mkdir(dirname(reviewerOutputPath), { recursive: true });
await writeFile(reviewerOutputPath, reviewerHtml, "utf8");
const round1 = (await readFile(resolve(root, "public/round1.html"), "utf8")).replaceAll("./talemy-logo.png", logoDataUrl);
await writeFile(resolve(root, "docs/round1.html"), round1, "utf8");
console.log(outputPath);
console.log(reviewerOutputPath);
