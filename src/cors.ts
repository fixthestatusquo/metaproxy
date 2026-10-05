// Shared by every route, so a handler in another module can't reference an
// origin list it doesn't have.

// Read on first use, not at import: index.ts may only load .env after its
// imports have run.
let origins: string[] | undefined;
const allowedOrigins = (): string[] =>
  (origins ??= process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((d: string) => d.trim())
    : ["http://localhost:3000", "http://localhost:3001"]);

// Replaces the `cors` middleware for this proxy: reflect the origin if it is
// allowed, and answer preflight OPTIONS requests.
export const corsHeaders = (
  origin: string | undefined
): Record<string, string> => {
  if (origin && allowedOrigins().indexOf(origin) >= 0) {
    return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
  }
  return { Vary: "Origin" };
};
