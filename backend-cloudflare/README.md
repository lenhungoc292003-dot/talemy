# Talemy production backend

Cloudflare Pages/Worker gateway for the Talemy 4D assessment.

## Runtime resources

- D1 binding: `DB` → `talemy-assessments`
- Workers AI binding: `AI`
- Secrets configured in Cloudflare, never committed:
  - `GEMINI_API_KEY`
  - `REVIEWER_ACCESS_KEY`

## Deployment

From the repository root:

```bash
cp backend-cloudflare/src/worker.js backend-cloudflare/dist/_worker.js
pnpm exec wrangler pages deploy backend-cloudflare/dist \
  --project-name talemy-secure-api-gateway \
  --branch main \
  --config backend-cloudflare/wrangler.jsonc
pnpm exec wrangler deploy \
  --config backend-cloudflare/wrangler.worker.jsonc
```

The Pages endpoint is primary. The Worker endpoint is the frontend fallback.
Both use the same D1 database and the same versioned assessment schema.

## AI reliability order

1. Gemini API
2. Cloudflare Workers AI
3. Deterministic task-aware fallback

The deterministic layer prevents blank candidate screens; the stored
`graderMode` and message `provider` make every fallback visible to reviewers.
