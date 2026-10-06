// Resolves a Proca user's organisation membership via the Proca GraphQL API,
// and enforces per-parameter access control.

// roles maps org name -> the user's role in it (owner, campaigner, ...)
export type UserData = {
  orgIds: number[];
  orgNames: string[];
  roles: Record<string, string>;
};

const USER_ORGS_QUERY = /* GraphQL */ `
  query UserOrgs {
    currentUser {
      roles {
        role
        org {
          __typename
          name
          ... on PrivateOrg {
            id
          }
        }
      }
    }
  }
`;

// Thrown when a Proca lookup fails (expired/invalid token, network error,
// GraphQL error). Distinct from "valid user with no orgs" so the two cases can
// be told apart at the HTTP layer.
export class UserAuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserAuthError";
  }
}

// A failed Proca API call, with Proca's own message and the status to answer
// our caller with: Proca's 4xx as is, 5xx (or no answer at all) as 502 Bad
// Gateway. Extends UserAuthError so /card keeps answering 401 for any failure.
export class ProcaError extends UserAuthError {
  status: number;
  constructor(message: string, status: number) {
    // say where it comes from, like "Cloudflare KV upload failed:"
    super(`Proca API: ${message}`);
    this.name = "ProcaError";
    this.status = status;
  }
}

// POSTs a GraphQL query to Proca and returns the parsed body, GraphQL `errors`
// included (callers decide what those mean). Throws ProcaError when Proca
// can't be reached or answers with an HTTP error.
const procaQuery = async (
  query: string,
  variables: Record<string, unknown>,
  auth: string,
): Promise<any> => {
  const apiUrl = process.env["PROCA_URL"] || "https://api.proca.app/api";
  let resp: Response;
  try {
    resp = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth },
      body: JSON.stringify({ query, variables }),
    });
  } catch (e) {
    throw new ProcaError(`unreachable (${(e as Error).message})`, 502);
  }
  const text = await resp.text();
  let body: any = null;
  try {
    body = JSON.parse(text);
  } catch {}
  if (!resp.ok) {
    throw new ProcaError(
      graphqlMessage(body) || text.trim() || `HTTP ${resp.status}`,
      resp.status >= 500 ? 502 : resp.status,
    );
  }
  return body;
};

// first GraphQL error message, if any
const graphqlMessage = (body: any): string | undefined =>
  body?.errors?.[0]?.message;

// Resolves the user from the incoming Authorization header (e.g. "Bearer <jwt>").
// Returns null when no header was supplied at all. Throws UserAuthError when a
// header was supplied but the lookup failed, so an expired/invalid token is
// distinguishable from a valid user who simply has no orgs.
export const resolveUser = async (auth?: string): Promise<UserData | null> => {
  if (!auth) return null;
  const body = await procaQuery(USER_ORGS_QUERY, {}, auth);

  // currentUser fails with a GraphQL error when the token isn't accepted
  if (body?.errors) {
    throw new ProcaError(graphqlMessage(body) || "user lookup failed", 401);
  }

  const r: UserData = { orgIds: [], orgNames: [], roles: {} };
  const roles = body?.data?.currentUser?.roles ?? [];

  for (const role of roles) {
    const org = role?.org;
    if (!org) continue;
    if (org.__typename === "PrivateOrg" && org.id !== undefined) {
      r.orgIds.push(org.id);
    }
    if (org.name) {
      r.orgNames.push(org.name);
      if (role.role) r.roles[org.name] = role.role;
    }
  }

  return r;
};

const CAMPAIGN_ORG_QUERY = /* GraphQL */ `
  query CampaignOrg($name: String!) {
    campaign(name: $name) {
      org {
        name
      }
    }
  }
`;

// Name of the org leading (coordinating) the campaign. Throws ProcaError 404,
// with Proca's message, when there is no such campaign.
export const leadOrg = async (campaign: string, auth: string): Promise<string> => {
  const body = await procaQuery(CAMPAIGN_ORG_QUERY, { name: campaign }, auth);
  const org = body?.data?.campaign?.org?.name;
  if (!org) {
    throw new ProcaError(graphqlMessage(body) || `Campaign ${campaign} not found`, 404);
  }
  return org;
};

// Parameter names that are org-scoped and therefore require an authenticated
// user whose orgs include the requested value. These are checked only when the
// card actually declares the corresponding tag (see authorizeParams).
const ORG_ID_PARAM = "org_id";
const ORG_NAME_PARAM = "org";

export type AuthResult =
  | { ok: true }
  | { ok: false; status: number; message: string };

// Parses an org id strictly: "19" -> 19, but "19abc" / "" / "19.5" -> null.
// This guarantees the value that is *verified* is the value that is *executed*.
export const parseOrgId = (value: unknown): number | null => {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const s = String(value);
  if (!/^-?\d+$/.test(s)) return null;
  const n = Number(s);
  return Number.isSafeInteger(n) ? n : null;
};

// Authorizes a request against the tags the *card* actually declares, so the
// parameter that is checked is exactly the one that will be sent to Metabase.
// A tag named something other than org_id/org cannot bypass the check, because
// we resolve each declared tag down to its semantic role here.
//
// `declaredTags` is empty when the card definition could not be read (the proxy
// then encodes every query-string parameter optimistically). In that case the
// checks fall back to the raw query string, so an org-scoped parameter is still
// verified rather than silently passed through unchecked.
export const authorizeParams = (
  user: UserData | undefined | null,
  declaredTags: readonly string[],
  params: Record<string, any>,
): AuthResult => {
  const names: readonly string[] =
    declaredTags.length > 0
      ? declaredTags
      : [ORG_ID_PARAM, ORG_NAME_PARAM];

  for (const name of names) {
    const isOrgId = name === ORG_ID_PARAM;
    const isOrgName = name === ORG_NAME_PARAM;
    if (!isOrgId && !isOrgName) continue;

    const value = params[name];
    if (value === undefined || value === "") continue;

    if (!user) {
      return {
        ok: false,
        status: 401,
        message: `Authentication required for parameter "${name}"`,
      };
    }

    if (isOrgId) {
      const orgId = parseOrgId(value);
      if (orgId === null) {
        return {
          ok: false,
          status: 400,
          message: `Invalid value for parameter "${name}": expected an integer`,
        };
      }
      if (user.orgIds.indexOf(orgId) < 0) {
        return {
          ok: false,
          status: 403,
          message: `User not authorized for ${name}=${orgId}`,
        };
      }
    } else {
      if (user.orgNames.indexOf(String(value)) < 0) {
        return {
          ok: false,
          status: 403,
          message: `User not authorized for ${name}=${value}`,
        };
      }
    }
  }

  return { ok: true };
};


