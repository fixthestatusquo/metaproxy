import type { IncomingMessage, ServerResponse } from "http";
import {
  leadOrg,
  resolveUser,
  ProcaError,
  type AuthResult,
  type UserData,
} from "./user.ts";
import { corsHeaders } from "./cors.ts";

import { fetchCampaign } from "snowflake/fetch.js";
import { upload } from "snowflake/upload.js";
import { analyse, type Analysis, type Variants } from "snowflake/fetch.js";
import { deployed, forgetDeployed, inSync } from "./deployed.ts";

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

    // check only reads texts that are public anyway: any logged-in user.
    // upload publishes: owners and campaigners of the lead org only.
    const authz: AuthResult =
      action === "upload"
        ? await authorizeCampaign(user, auth, campaign)
        : user
          ? { ok: true }
          : { ok: false, status: 401, message: "Authentication required" };
    if (!authz.ok) {
      console.warn(
        `snowflake ${action} ${campaign}: denied (${authz.message})`,
      );
      return fail(authz.status, "Error", authz.message);
    }

    // ?lang=xx restricts upload to one language; check always covers all
    const lang =
      action === "upload"
        ? (url.searchParams.get("lang")?.trim().toLowerCase() ?? null)
        : null;
    if (lang === "") {
      return fail(400, "invalid_lang", "Empty lang parameter");
    }

    const data = await fetchCampaign(campaign, { local: false, save: false });
    if (action === "check") {
      const live = await withDeployed(campaign!, data);
      res.writeHead(200, {
        ...corsHeaders(origin),
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify({ config: data, ...live }));
      return;
    }
    if (action === "upload") {
      let content = data.content;
      if (lang !== null) {
        if (!Object.hasOwn(content, lang)) {
          const known = Object.keys(content).join(", ") || "none";
          return fail(
            400,
            "invalid_lang",
            `Unknown language "${lang}" for ${campaign} (available: ${known})`,
          );
        }
        content = { [lang]: content[lang] };
      }
      let keys: string[];
      try {
        keys = await upload(campaign, content);
      } catch (e) {
        // a failure halfway may still have written some languages
        forgetDeployed(campaign!);
        const msg = (e as Error).message;
        return fail(
          /^missing CLOUDFLARE_/.test(msg) ? 500 : 502,
          "cloudflare_error",
          `Cloudflare KV upload failed: ${msg}`,
        );
      }
      // same shape as check, so the dashboard can refresh from it directly
      forgetDeployed(campaign!);
      const live = await withDeployed(campaign!, data, content);
      res.writeHead(200, {
        ...corsHeaders(origin),
        "Content-Type": "application/json",
      });
      res.end(JSON.stringify({ config: data, ...live, keys }));
      return;
    }
  } catch (e) {
    const err = e as Error;
    if (err instanceof ProcaError) {
      return fail(err.status, "proca_error", err.message);
    }
    const engine = engineProcaStatus(err?.message);
    if (engine) {
      return fail(engine, "proca_error", `Proca API: ${err.message}`);
    }
    return fail(400, err?.name || "error", err?.message || "generic error");
  }
}

// What the worker serves, next to the config. KV trouble must not hide the
// config analysis (or a successful upload): report it in deployedError instead
const withDeployed = async (
  campaign: string,
  data: { analysis: Analysis; content: Variants },
  written?: Variants,
): Promise<{ deployed: object | null; deployedError?: string }> => {
  try {
    const kv = await deployed(campaign, Object.keys(data.content), written);
    return {
      deployed: {
        // config parts, so a part absent from KV is reported as missing
        analysis: analyse(kv.content, Object.keys(data.analysis.max)),
        content: kv.content,
        inSync: inSync(data.content, kv.content),
        errors: kv.errors,
      },
    };
  } catch (e) {
    const deployedError = `Cloudflare KV read failed: ${(e as Error).message}`;
    console.warn(`snowflake ${campaign}: ${deployedError}`);
    return { deployed: null, deployedError };
  }
};

const engineProcaStatus = (message?: string): number | undefined => {
  const http = message?.match(/^api\.proca\.app (\d{3})$/);
  if (http) return +http[1] >= 500 ? 502 : +http[1];
  if (message && /^campaign .* not found$/.test(message)) return 404;
  return undefined;
};

// roles in the lead org allowed to upload the snowflake
const ALLOWED_ROLES = ["owner", "campaigner"];

const authorizeCampaign = async (
  user: UserData | null,
  auth: string | undefined,
  campaign: string | undefined,
): Promise<AuthResult> => {
  if (!user || !auth) {
    return { ok: false, status: 401, message: "Authentication required" };
  }
  if (!campaign) {
    return { ok: false, status: 404, message: "Missing campaign name" };
  }
  const org = await leadOrg(campaign, auth);
  const role = user.roles[org];
  if (!role || ALLOWED_ROLES.indexOf(role) < 0) {
    return {
      ok: false,
      status: 403,
      message: `Only owners and campaigners of ${org} can publish the snowflake of ${campaign}`,
    };
  }
  return { ok: true };
};

// The campaign name is the path segment immediately after /snowflake/. Strictly validated
// so a malformed path yields a clear 400
const parseCampaign = (
  pathname: string,
): { action?: string; campaign?: string } => {
  const parts = pathname.split("/").filter((p) => p !== "");
  return { action: parts[1] || undefined, campaign: parts[2] || undefined };
};
