import http from "http";
import type { ServerResponse, IncomingMessage } from "http";
import { URL } from "url";
import { Cache } from "./cache.ts";
import { getParametersInfo, wrapParam, fetchCard, type TagInfo } from "./metabase.ts";
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

for (const v of [
  "METABASE_URL",
  "METABASE_KEY",
  "METABASE_COLLECTION",
]) {
  if (!process.env[v]) throw new Error(`Set ${v}`);
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

    const declaredTags = Object.keys(cardInfo);

    // Authorize against the tags the card actually declares, so the parameter
    // that is verified is exactly the one that will be sent to Metabase.
    const authz = authorizeParams(user, declaredTags, query);
    if (!authz.ok) {
      console.log(`Authorize failed for card ${cardId}: ${authz.message}`);
      return fail(authz.status, "Error", authz.message);
    }

    const cardParams: any[] = [];
    for (const name of declaredTags) {
      const info: TagInfo = cardInfo[name];
      const raw = query[name];

      if (raw === undefined || raw === "") {
        // A required tag with no value would otherwise be forwarded as an
        // empty parameter list and rejected by Metabase with an opaque
        // "pick a value" error. Report which parameter is missing.
        if (info.required) {
          return fail(
            400,
            "missing_parameter",
            `Missing required parameter "${name}"${info.displayName ? ` (${info.displayName})` : ""}`,
          );
        }
        continue;
      }

      cardParams.push(wrapParam(name, raw, info));
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
        .map((p) => [p.target, p.value])
        .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))),
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

server.listen(appPort, () => {
  console.log(`Started server at port ${appPort}`);
});
