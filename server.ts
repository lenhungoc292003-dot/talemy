import crypto from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";

const app = express();
const port = Number.parseInt(process.env.PORT || "8080", 10);
const maxBodyBytes = 256 * 1024;
const allowedModels = new Set([
  "gemini-3.5-flash-lite",
  "gemini-3.6-flash",
  "gemini-3.5-flash",
]);

app.disable("x-powered-by");
app.use((_, response, next) => {
  response.set({
    "Cache-Control": "no-store",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    "Referrer-Policy": "no-referrer",
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
  });
  next();
});
app.use(express.json({ limit: maxBodyBytes }));

function safeEqual(candidate: string, expected: string) {
  const left = Buffer.from(candidate);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function authorize(request: Request, response: Response, next: NextFunction) {
  const expected = process.env.TALEMY_GATEWAY_TOKEN || "";
  const header = request.header("authorization") || "";
  const candidate = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!expected) {
    response.status(503).json({
      error: "Gateway authentication is not configured.",
      provider: "gemini",
      status: 503,
    });
    return;
  }
  if (!candidate || !safeEqual(candidate, expected)) {
    response.status(401).json({
      error: "Unauthorized.",
      provider: "gemini",
      status: 401,
    });
    return;
  }
  next();
}

function readGeminiText(data: unknown) {
  if (!data || typeof data !== "object") return "";
  const candidates = (data as { candidates?: unknown }).candidates;
  if (!Array.isArray(candidates)) return "";
  return candidates
    .flatMap((candidate) => {
      if (!candidate || typeof candidate !== "object") return [];
      const content = (candidate as { content?: unknown }).content;
      if (!content || typeof content !== "object") return [];
      const parts = (content as { parts?: unknown }).parts;
      return Array.isArray(parts) ? parts : [];
    })
    .map((part) =>
      part && typeof part === "object" && typeof (part as { text?: unknown }).text === "string"
        ? (part as { text: string }).text
        : "",
    )
    .filter(Boolean)
    .join("\n")
    .trim();
}

app.get("/health", (_, response) => {
  response.json({
    ok: true,
    service: "talemy-gemini-gateway",
    provider: "gemini",
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    gatewayAuthConfigured: Boolean(process.env.TALEMY_GATEWAY_TOKEN),
  });
});

app.post("/api/generate", authorize, async (request, response) => {
  const geminiApiKey = process.env.GEMINI_API_KEY || "";
  if (!geminiApiKey) {
    response.status(503).json({
      error: "Gemini is not configured.",
      provider: "gemini",
      status: 503,
    });
    return;
  }

  const model =
    typeof request.body?.model === "string" && allowedModels.has(request.body.model)
      ? request.body.model
      : "gemini-3.5-flash-lite";
  const payload = request.body?.payload;
  if (
    !payload ||
    typeof payload !== "object" ||
    !Array.isArray(payload.contents) ||
    payload.contents.length === 0
  ) {
    response.status(400).json({
      error: "Invalid Gemini payload.",
      provider: "gemini",
      status: 400,
    });
    return;
  }

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": geminiApiKey,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(25_000),
      },
    );
    const data = await upstream.json().catch(() => ({}));
    if (!upstream.ok) {
      const detail =
        typeof data?.error?.message === "string"
          ? data.error.message.slice(0, 500)
          : "Gemini request failed.";
      response.status(upstream.status).json({
        error: detail,
        provider: "gemini",
        status: upstream.status,
      });
      return;
    }
    const text = readGeminiText(data);
    if (!text) {
      response.status(502).json({
        error: "Gemini returned no text.",
        provider: "gemini",
        status: 502,
      });
      return;
    }
    response.json({ text, provider: "gemini", model });
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "TimeoutError" || error.name === "AbortError");
    const status = isTimeout ? 504 : 502;
    response.status(status).json({
      error: isTimeout ? "Gemini request timed out." : "Gemini gateway request failed.",
      provider: "gemini",
      status,
    });
  }
});

app.use(
  (
    error: Error & { type?: string },
    _request: Request,
    response: Response,
    _next: NextFunction,
  ) => {
    const tooLarge = error.type === "entity.too.large";
    response.status(tooLarge ? 413 : 400).json({
      error: tooLarge ? "Request body is too large." : "Invalid request body.",
      provider: "gemini",
      status: tooLarge ? 413 : 400,
    });
  },
);

app.get("/", (_, response) => {
  response
    .type("html")
    .send(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Talemy Gemini Gateway</title>
  </head>
  <body style="font-family:system-ui;max-width:680px;margin:64px auto;padding:0 24px">
    <h1>Talemy Gemini Gateway</h1>
    <p>Gemini requests are processed server-side. No API keys are exposed here.</p>
    <p>Operator health endpoint: <code>/health</code></p>
  </body>
</html>`);
});

app.listen(port, "0.0.0.0", () => {
  console.log(`Talemy Gemini Gateway listening on ${port}`);
});
