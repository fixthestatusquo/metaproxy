import http from "http";
import type { ServerResponse, IncomingMessage } from "http";
import { URL } from "url";
import { Cache } from "./cache.ts";
import {
  getParametersInfo,
  buildCardParams,
  fetchCard,
  initAuth,
  updateSession,
} from "./metabase.ts";
import {
  authorizeParams,
  resolveUser,
  UserAuthError,
  type UserData,
} from "./user.ts";

interface Context {
  user: UserData | null;
}

const cache = new Cache();
const cacheTimeout = parseInt(process.env["CACHE_TIMEOUT"] || "15");

for (const v of ["METABASE_URL", "METABASE_COLLECTION"]) {
  if (!process.env[v]) throw new Error(`Set ${v}`);
}

// Auth: this Metabase (v0.46) predates API keys, so username/password is the
// default. METABASE_KEY is only used when explicitly set (Metabase >= v0.49).
const usingApiKey = Boolean(process.env["METABASE_KEY"]);
if (!usingApiKey) {
  for (const v of ["METABASE_USERNAME", "METABASE_PASSWORD"]) {
    if (!process.env[v]) {
      throw new Error(
        `Set ${v} (or METABASE_KEY on Metabase >= v0.49). ` +
          `Metabase v0.46 has no API-key support.`,
      );
    }
  }
}

const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((d: string) => d.trim())
  : ["http://localhost:3000", "http://localhost:3001"];

// Replaces the `cors` middleware for this proxy: reflect the origin if it is
// allowed, and answer preflight OPTIONS requests.
const corsHeaders = (
  origin: string | undefined
): Record<string, string> => {
  if (origin && allowedOrigins.indexOf(origin) >= 0) {
    return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
  }
  return { Vary: "Origin" };
};

const server = http.createServer(async (req: IncomingMessage, res: ServerResponse) => {
  const origin = req.headers.origin;
  const url = new URL(req.url || "/", `http://${req.headers.host}`);

  if (req.method === "OPTIONS") {
    // CORS preflight
    res.writeHead(204, {
      ...corsHeaders(origin),
      "Access-Control-Allow-Methods": "GET,HEAD,PUT,PATCH,POST,DELETE",
      "Access-Control-Allow-Headers": req.headers["access-control-request-headers"] || "",
      "Access-Control-Max-Age": "86400",
    });
    res.end();
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/card/")) {
    handleCard(req, res, url);
    return;
  }

  res.writeHead(404, { ...corsHeaders(origin), "Content-Type": "application/json" });
  res.end(JSON.stringify({ error: "not_found", message: "Not found" }));
});

async function handleCard(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL
): Promise<void> {
  const origin = req.headers.origin;

  const fail = (code: number, name: string, message: string) => {
    res.writeHead(code, {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify({ error: name, message }));
  };

  try {
    // Resolve the user when an Authorization header is present. A Proca
    // failure is NOT treated as "anonymous": it is reported as an auth error
    // so an expired token is distinguishable from a permission denial.
    let user: UserData | null = null;
    const auth = req.headers.authorization;
    if (auth) {
      user = await resolveUser(auth);
    }

    const query = Object.fromEntries(url.searchParams.entries());
    const cardId = parseCardId(url.pathname);
    if (cardId === null) {
      return fail(400, "invalid_card_id", `Not a valid card id in ${url.pathname}`);
    }

    const key4info = `info-${cardId}`;
    let cardInfo = cache.get(key4info);
    if (cardInfo === undefined) {
      cardInfo = await getParametersInfo(cardId);
      cache.set(key4info, cardInfo, cacheTimeout);
    }

    // cardInfo is null when the card definition could not be read; in that case
    // every query-string parameter is encoded optimistically.
    const declaredTags = cardInfo === null ? [] : Object.keys(cardInfo);

    // Authorize against the tags the card actually declares, so the parameter
    // that is verified is exactly the one that will be sent to Metabase.
    const authz = authorizeParams(user, declaredTags, query);
    if (!authz.ok) {
      console.log(`Authorize failed for card ${cardId}: ${authz.message}`);
      return fail(authz.status, "Error", authz.message);
    }

    const built = buildCardParams(query, cardInfo);
    if ("missing" in built) {
      return fail(
        400,
        "missing_parameter",
        `Missing required parameter "${built.missing.name}"` +
          (built.missing.displayName ? ` (${built.missing.displayName})` : ""),
      );
    }
    const cardParams = built.params;

    if (built.assumed) {
      console.warn(
        `Card ${cardId}: card definition unreadable, sending ${cardParams.length} ` +
          `parameter(s) optimistically as template-tag variables: ` +
          `${cardParams.map((p: any) => p.target?.[1]?.[1]).join(", ") || "(none)"}`,
      );
    }

    console.log(
      `Question ${cardId} parameters`,
      JSON.stringify(cardParams, null, 2)
    );

    // get data with caching.
    // The key covers the card AND every resolved parameter value, so an
    // org-scoped result can never be served for a different org.
    const key = JSON.stringify([
      cardId,
      cardParams
        .map((p: any) => [p.target, p.value])
        .sort((a: any, b: any) =>
          JSON.stringify(a).localeCompare(JSON.stringify(b)),
        ),
    ]);
    let data: any = cache.get(key);
    if (data === undefined) {
      data = await fetchCard(cardId, cardParams);
      cache.set(key, data, cacheTimeout);
    }

    res.writeHead(200, {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
    });
    res.end(JSON.stringify(data));
  } catch (e) {
    const err = e as Error;
    if (err instanceof UserAuthError) {
      return fail(401, "unauthorized", err.message);
    }
    return fail(400, err?.name || "error", err?.message || "generic error");
  }
}

// The card id is the path segment immediately after /card/. Strictly validated
// so a malformed path yields a clear 400 instead of parseInt("card") -> NaN.
const parseCardId = (pathname: string): number | null => {
  const parts = pathname.split("/").filter((p) => p !== "");
  const idx = parts.indexOf("card");
  const seg = idx >= 0 ? parts[idx + 1] : undefined;
  if (seg === undefined || !/^\d+$/.test(seg)) return null;
  const n = Number(seg);
  return Number.isSafeInteger(n) ? n : null;
};

const appPort = process.env["PORT"] || 4040;

// Verify Metabase auth before accepting requests, so a bad credential is a
// startup failure rather than a per-request "card has no dataset_query".
try {
  const mode = await initAuth();
  console.log(`Metabase auth OK (${mode})`);
} catch (e) {
  console.error(
    `Metabase authentication FAILED: ${(e as Error).message}\n` +
      `The proxy will start but every card request will fail until this is fixed.`,
  );
}

if (!usingApiKey) {
  // Metabase sessions expire; refresh well within the default lifetime.
  setInterval(() => {
    updateSession().catch((e: unknown) =>
      console.error("Metabase session refresh failed", (e as Error).message),
    );
  }, 1000 * 60 * 15);
}

server.listen(appPort, () => {
  console.log(`Started server at port ${appPort}`);
});
