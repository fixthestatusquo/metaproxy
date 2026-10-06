import type { IncomingMessage, ServerResponse } from "http";
import {
  authorizeParams,
  resolveUser,
  UserAuthError,
  type UserData,
} from "./user.ts";
import { corsHeaders } from "./cors.ts";

import { fetchCampaign } from "snowflake/fetch.js";
import { upload } from "snowflake/upload.js";

const METHODS: Record<string, string> = { check: "GET", upload: "POST" };

export async function handleSnowflake(
  req: IncomingMessage,
  res: ServerResponse,
  url: URL,
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
    const { action, campaign } = parseCampaign(url.pathname);

    // upload publishes, so a plain GET (link preview, crawler, prefetch,
    // <img src>) must never trigger it
    const method = action ? METHODS[action] : undefined;
    if (!method) {
      return fail(404, "unknown_action", `Unknown snowflake action: ${action}`);
    }
    if (req.method !== method) {
      res.writeHead(405, {
        ...corsHeaders(origin),
        Allow: method,
        "Content-Type": "application/json",
      });
      res.end(
        JSON.stringify({
          error: "method_not_allowed",
          message: `Use ${method} for /snowflake/${action}`,
        }),
      );
      return;
    }

    // Resolve the user when an Authorization header is present. A Proca
    // failure is NOT treated as "anonymous": it is reported as an auth error
    // so an expired token is distinguishable from a permission denial.
    let user: UserData | null = null;
    const auth = req.headers.authorization;
    if (auth) {
      user = await resolveUser(auth);
    }

    const data = await fetchCampaign(campaign, { local: false, save: false });
    console.log(data);
    if (action === "check") {
      res.writeHead(200, {
        ...corsHeaders(origin),
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify(data));
      return;
    }
    if (action === "upload") {
      const keys = await upload(campaign, data.content);
      res.writeHead(200, {
        ...corsHeaders(origin),
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify({ ...data, keys }));
      return;
    }
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
const parseCampaign = (
  pathname: string,
): { action?: string; campaign?: string } => {
  const parts = pathname.split("/").filter((p) => p !== "");
  return { action: parts[1] || undefined, campaign: parts[2] || undefined };
};
