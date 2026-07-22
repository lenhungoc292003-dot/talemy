import { env } from "cloudflare:workers";

const runtimeEnv = env as unknown as Record<string, string | undefined>;

function constantTimeEqual(left: string, right: string): boolean {
  const leftBytes = new TextEncoder().encode(left);
  const rightBytes = new TextEncoder().encode(right);
  const length = Math.max(leftBytes.length, rightBytes.length);
  let mismatch = leftBytes.length ^ rightBytes.length;

  for (let index = 0; index < length; index += 1) {
    mismatch |= (leftBytes[index] ?? 0) ^ (rightBytes[index] ?? 0);
  }

  return mismatch === 0;
}

export function isReviewerRequest(request: Request): boolean {
  const expectedKey = runtimeEnv.REVIEWER_ACCESS_KEY?.trim() ?? "";
  const authorization = request.headers.get("authorization") ?? "";
  const suppliedKey = authorization.replace(/^Bearer\s+/i, "").trim();

  return expectedKey.length >= 16 && constantTimeEqual(suppliedKey, expectedKey);
}
