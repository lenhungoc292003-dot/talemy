# Talemy Gemini Gateway

Server-side Gemini gateway for the Talemy AI Skill Assessment.

## Runtime secrets

- `GEMINI_API_KEY`
- `TALEMY_GATEWAY_TOKEN`

Never commit either value. The Talemy Cloudflare backend sends the shared
gateway token through the `Authorization` header. Candidate browsers never call
this service directly.

## Routes

- `GET /health`
- `POST /api/generate`

The generate route accepts `{ "model": "...", "payload": { ... } }` and
returns `{ "text": "...", "provider": "gemini", "model": "..." }`.
