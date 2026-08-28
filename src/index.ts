import http from "http";
import type { ServerResponse, IncomingMessage } from "http";
import { URL } from "url";
import { Cache } from "./cache.ts";
import { api, updateSession, getParametersInfo, wrapParam, fetchCard } from "./metabase.ts";
import { fetchUser, allowParams, type UserData } from "./user.ts";

interface Context {
  user: UserData | null;
}

const cache = new Cache();
const cacheTimeout = parseInt(process.env["CACHE_TIMEOUT"] || "15");

for (const v of [
  "METABASE_URL",
  "METABASE_USERNAME",
  "METABASE_PASSWORD",
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
    // Authenticate (optional): reads the Authorization header, if present.
    let user: UserData | null = null;
    const auth = req.headers.authorization;
    if (auth) {
      console.log("fetching user");
      user = await fetchUser(auth);
    }

    const query = Object.fromEntries(url.searchParams.entries());
    if (!allowParams(user, query)) {
      console.log(user, query);
      return fail(400, "Error", "User not authorized to use this parameter");
    }

    const cardId = parseInt(url.pathname.split("/")[2]);
    const cardParams: any[] = [];

    const key4info = `info-${cardId}`;
    let cardInfo = cache.get(key4info);
    if (cardInfo === undefined) {
      cardInfo = await getParametersInfo(cardId);
      cache.set(key4info, cardInfo, cacheTimeout);
    }

    const names = Object.keys(cardInfo);
    for (let i = 0; i < names.length; i++) {
      const name = names[i];
      const value = query[name] as string;
      if (value) cardParams.push(wrapParam(name, value, cardInfo[name]));
    }

    console.log(
      `Question ${cardId} parameters`,
      JSON.stringify(cardParams, null, 2)
    );

    // get data with caching
    const key = JSON.stringify([cardId, Object.entries(cardParams).sort()]);
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
    return fail(400, err?.name || "error", err?.message || "generic error");
  }
}

const appPort = process.env["PORT"] || 4040;

updateSession().catch((e) => console.error(e));
const cron = setInterval(() => {
  updateSession();
}, 1000 * 60 * 15);

server.listen(appPort, () => {
  console.log(`Started server at port ${appPort}`);
});
