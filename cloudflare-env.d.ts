declare module "cloudflare:workers" {
  export const env: Record<string, unknown> & {
    DB?: D1Database;
    GEMINI_API_KEY?: string;
    REVIEWER_ACCESS_KEY?: string;
  };
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = unknown>(): Promise<T | null>;
  all<T = unknown>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
}

interface D1Database {
  prepare(query: string): D1PreparedStatement;
}
