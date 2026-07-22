const ALLOWED_ORIGINS = new Set([
  "https://lenhungoc292003-dot.github.io",
]);

function allowedOrigin(request: Request) {
  const origin = request.headers.get("origin");
  return origin && ALLOWED_ORIGINS.has(origin) ? origin : null;
}

export function withCors(request: Request, headersInit?: HeadersInit) {
  const headers = new Headers(headersInit);
  const origin = allowedOrigin(request);
  if (origin) {
    headers.set("access-control-allow-origin", origin);
    headers.set("access-control-allow-methods", "GET, POST, PATCH, OPTIONS");
    headers.set("access-control-allow-headers", "content-type");
    headers.set("access-control-max-age", "86400");
    headers.set("vary", "Origin");
  }
  return headers;
}

export function corsJson(request: Request, body: unknown, init: ResponseInit = {}) {
  return Response.json(body, { ...init, headers: withCors(request, init.headers) });
}

export function corsOptions(request: Request) {
  return new Response(null, { status: 204, headers: withCors(request) });
}
