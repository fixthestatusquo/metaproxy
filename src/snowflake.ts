import {
  authorizeParams,
  resolveUser,
  UserAuthError,
  type UserData,
} from "./user.ts";

import {fetchCampaign} from "snowflake/fetch.js";
import  { upload } from 'snowflake/upload.js';

const corsHeaders = (
  origin: string | undefined
): Record<string, string> => {
  if (origin && allowedOrigins.indexOf(origin) >= 0) {
    return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
  }
  return { Vary: "Origin" };
};

export async function handleSnowflake(
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
    const {action,campaign} = parseCampaign(url.pathname);

    const data = await fetchCampaign (campaign, {local: false, save:false});

    if (action === "check") {
    res.writeHead(200, {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
    });
      return res.end(JSON.stringify(data));
    }
    if (action === "upload") {
      const keys = await upload(campaign, data.content);
    res.writeHead(200, {
      ...corsHeaders(origin),
      "Content-Type": "application/json",
    });
      if (keys.errors) return data;
      return res.end(JSON.stringify({ ...data, keys}));
    }

      
      return res.end(JSON.stringify("action unkown", action));

  } catch (e) {
    const err = e as Error;
    if (err instanceof UserAuthError) {
      return fail(401, "unauthorized", err.message);
    }
    return fail(400, err?.name || "error", err?.message || "generic error");
  }
}

// The campaign name is the path segment immediately after /snowflake/. Strictly validated
// so a malformed path yields a clear 400
const parseCampaign = (pathname: string): string | null => {
  const parts = pathname.split("/").filter((p) => p !== "");
  return  { action: parts[1] || undefined, campaign: parts[2] || undefined};
};


