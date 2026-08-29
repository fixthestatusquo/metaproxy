// Resolves a Proca user's organisation membership via the Proca GraphQL API,
// and enforces per-parameter access control.

export type UserData = { orgIds: number[]; orgNames: string[] };

const USER_ORGS_QUERY = /* GraphQL */ `
  query UserOrgs {
    currentUser {
      roles {
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

// The Authorisation header received on the incoming request (e.g. "Bearer <jwt>")
export const fetchUser = async (auth: string): Promise<UserData> => {
  const apiUrl = process.env["PROCA_URL"] || "https://api.proca.app/api";

  const r: UserData = { orgIds: [], orgNames: [] };

  try {
    const resp = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: auth,
      },
      body: JSON.stringify({
        query: USER_ORGS_QUERY,
        variables: {},
      }),
    });

    if (!resp.ok) {
      console.error("Proca user lookup failed", resp.status, await resp.text());
      return r;
    }

    const body: any = await resp.json();

    if (body.errors) {
      console.error("Proca query errors", JSON.stringify(body.errors));
      return r;
    }

    const roles = body?.data?.currentUser?.roles ?? [];

    for (const role of roles) {
      const org = role?.org;
      if (!org) continue;
      if (org.__typename === "PrivateOrg") {
        r.orgIds.push(org.id);
      }
      if (org.name) {
        r.orgNames.push(org.name);
      }
    }
  } catch (e) {
    console.error("Proca user lookup error", (e as Error).toString());
  }

  return r;
};

export const allowParams = (
  user: UserData | undefined,
  params: Record<string, any>,
): boolean => {
  if ("org_id" in params) {
    if (!user) return false;
    const org_id = parseInt(params["org_id"]);
    if (user.orgIds.indexOf(org_id) < 0) {
      return false;
    }
  }

  if ("org" in params) {
    if (!user) return false;
    if (user.orgNames.indexOf(params["org"]) < 0) {
      return false;
    }
  }

  return true;
};
