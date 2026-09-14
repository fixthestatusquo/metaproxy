const COLLECTION = (process.env["METABASE_COLLECTION"] || "").split(",");

export const apiUrl = (path: string) => {
  return process.env["METABASE_URL"] + "/api" + path;
};

// Metabase auth.
//
// Two supported modes, chosen by configuration:
//   * METABASE_KEY set     -> `X-API-Key` header (Metabase >= v0.49)
//   * otherwise            -> username/password session (POST /api/session)
//
// Production (metabase.proca.app) runs v0.63 and uses an API key. Some
// development instances still run pre-v0.49 builds, which do not recognise the
// `X-API-Key` header at all, so the session path is retained as a fallback.
//
// A rejected credential used to surface as a confusing "card has no
// dataset_query"; API errors are now reported explicitly instead.
type Session = {
  id: string | undefined;
};
const session: Session = { id: undefined };

const useApiKey = () => Boolean(process.env["METABASE_KEY"]);

const withAuth = (headers: Record<string, string>) => {
  if (useApiKey()) {
    return Object.assign(headers, { "X-API-Key": process.env["METABASE_KEY"] });
  }
  if (session.id) {
    return Object.assign(headers, { "X-Metabase-Session": session.id });
  }
  return headers;
};

export const api = async (
  method: "GET" | "POST",
  path: string,
  params?: Record<string, number | string>,
): Promise<any> => {
  const url = apiUrl(path);

  const resp = await fetch(url, {
    method,
    headers: withAuth({ "Content-Type": "application/json" }),
    body: JSON.stringify(params),
  });

  const body = await resp.text();

  if (body[0] !== "{") {
    // Metabase replies with a bare string (e.g. "Unauthenticated") when the
    // credential is rejected. Surface that instead of an opaque parse error.
    if (/unauthenticated/i.test(body)) {
      throw new Error(
        `Metabase rejected the configured credential (${useApiKey() ? "METABASE_KEY" : "session"}) ` +
          `for ${method} ${path}: ${body.trim()}. ` +
          `Check that METABASE_KEY is valid and not expired, or unset it to ` +
          `fall back to METABASE_USERNAME/METABASE_PASSWORD.`,
      );
    }
    throw new Error(`Error reply: ${body}`);
  }

  return JSON.parse(body);
};

// Logs in via POST /api/session and stores the session id for subsequent calls.
export const fetchSession = async () => {
  const username = process.env["METABASE_USERNAME"];
  const password = process.env["METABASE_PASSWORD"];
  if (!username || !password) {
    throw new Error(
      "METABASE_USERNAME and METABASE_PASSWORD are required for session auth",
    );
  }
  return api("POST", "/session", { username, password });
};

export const updateSession = async () => {
  const { id } = await fetchSession();
  if (id === undefined || id === null) {
    throw new Error("Metabase login returned no session id");
  }
  session.id = `${id}`;
  return session.id;
};

// Establishes and verifies auth before the server starts serving, so a bad
// credential is a startup failure rather than a per-request mystery.
export const initAuth = async (): Promise<"api-key" | "session"> => {
  if (useApiKey()) {
    // Prove the key works rather than assuming it. /api/user/current is
    // cheap and returns 401 "Unauthenticated" for an invalid key.
    await api("GET", "/user/current");
    return "api-key";
  }
  await updateSession();
  return "session";
};

// Descriptor for one template-tag on a card. Retains the tag's declared type
// and, for field filters, the field reference needed to build a valid target.
export type TagInfo = {
  type: string;
  displayName?: string;
  required?: boolean;
  // Present for `dimension` (field filter) tags: ["field", id, {...}]
  fieldRef?: any;
};

/**
 * Reads a card's parameter metadata.
 *
 * Returns a map of tag name -> descriptor. An empty object means "no tags could
 * be determined", which the caller treats as unknown rather than as a card with
 * genuinely no parameters; see applyCardParams for how that is handled.
 *
 * Returns null when the card definition could not be read at all (permissions,
 * non-native card, or an unrecognised payload shape), so the caller can fall
 * back to optimistic encoding instead of dropping every parameter.
 */
export const getParametersInfo = async (
  cardId: number,
): Promise<Record<string, TagInfo> | null> => {
  const card = await api("GET", `/card/${cardId}`);

  if (!card || typeof card !== "object") {
    throw new Error(
      `Metabase returned no card for id ${cardId} (check METABASE_KEY permissions)`,
    );
  }

  const collection = card["collection"]?.["slug"];
  if (collection === undefined) {
    throw new Error(
      `Card ${cardId} has no collection.slug in the API response; ` +
        `METABASE_KEY may lack read access to this card's collection`,
    );
  }

  if (COLLECTION.indexOf(collection) < 0) {
    console.error(`Forbidden access to collection ${collection}`);

    throw new Error(`Forbidden access to collection ${collection}`);
  }

  const datasetQuery = card["dataset_query"];
  if (!datasetQuery || typeof datasetQuery !== "object") {
    console.warn(
      `Card ${cardId}: no dataset_query in the API response ` +
        `(METABASE_KEY may lack permission to read the card definition). ` +
        `Falling back to optimistic parameter encoding.`,
    );
    return null;
  }

  // Locate the template-tags. Different Metabase versions nest these
  // differently, so look in every known position before giving up.
  const native = datasetQuery["native"];
  const tagSources: Array<[string, any]> = [
    ["dataset_query.native.template-tags", native?.["template-tags"]],
    ["dataset_query.template-tags", datasetQuery["template-tags"]],
    ["card.template-tags", card["template-tags"]],
    ["card.parameters", card["parameters"]],
  ];

  let tags: Record<string, any> | undefined;
  let source = "";
  for (const [where, candidate] of tagSources) {
    if (candidate && typeof candidate === "object" && !Array.isArray(candidate)) {
      tags = candidate;
      source = where;
      break;
    }
    if (Array.isArray(candidate)) {
      // `parameters` is sometimes a list of {name, ...} objects.
      const asMap: Record<string, any> = {};
      for (const p of candidate) {
        if (p && typeof p === "object" && typeof p["name"] === "string") {
          asMap[p["name"]] = p;
        }
      }
      if (Object.keys(asMap).length > 0) {
        tags = asMap;
        source = where;
        break;
      }
    }
  }

  if (!tags || Object.keys(tags).length === 0) {
    const isNative =
      datasetQuery["type"] === "native" || card["query_type"] === "native";

    if (!isNative) {
      console.warn(
        `Card ${cardId} is not a native query ` +
          `(dataset_query.type=${JSON.stringify(datasetQuery["type"])}, ` +
          `query_type=${JSON.stringify(card["query_type"])}); ` +
          `it declares no template-tags, so URL parameters cannot be applied`,
      );
      return {};
    }

    // Native card but we could not find its tags. Do not assume it has none:
    // that would silently drop every parameter. Signal "unknown" instead.
    console.warn(
      `Card ${cardId} is a native query but no template-tags were found in ` +
        `the API response (looked in: ${tagSources.map(([w]) => w).join(", ")}). ` +
        `Falling back to optimistic parameter encoding.`,
    );
    return null;
  }

  const params: Record<string, TagInfo> = {};
  for (const [name, d] of Object.entries(tags)) {
    const spec = d as any;
    const info: TagInfo = { type: spec["type"] };
    if (spec["display-name"] !== undefined) info.displayName = spec["display-name"];
    else if (spec["display_name"] !== undefined)
      info.displayName = spec["display_name"];
    else if (spec["name"] !== undefined && spec["display-name"] === undefined)
      info.displayName = spec["name"];
    if (spec["required"] !== undefined) info.required = !!spec["required"];
    // Field filters carry the field reference we need for a valid target.
    if (spec["dimension"] !== undefined) info.fieldRef = spec["dimension"];
    else if (spec["fieldRef"] !== undefined) info.fieldRef = spec["fieldRef"];
    params[name] = info;
  }

  console.debug(
    `Card ${cardId}: read ${Object.keys(params).length} template-tag(s) from ${source}`,
  );

  return params;
};

// Query-string keys that are never Metabase card parameters. Sending these to
// Metabase makes it reject the whole request with
// "Invalid parameter: Card N does not have a template tag named ...".
const NON_CARD_PARAMS = new Set([
  "queryId",
  "queryid",
  "title",
  "cardId",
  "cardid",
  "display",
  "format",
  "callback",
  "_",
]);

export const isNonCardParam = (name: string): boolean =>
  NON_CARD_PARAMS.has(name);

// [{"type":"category","target":["variable",["template-tag","campaign_name"]],"value":"realgreendeal"}]
// [{"type":"category","target":["dimension",["field",1,null]],"value":["belarus"]}]
export const wrapParam = (name: string, value: string, tag?: TagInfo) => {
  const type = tag?.type;
  switch (type) {
    case "dimension": {
      const target = tag?.fieldRef
        ? ["dimension", tag.fieldRef]
        : ["dimension", ["template-tag", name]];
      return { type: "category", target, value: [value] };
    }
    case "number": {
      // Send a real number when the value is integral; otherwise pass the
      // string through so Metabase reports a meaningful error rather than NaN.
      const n = /^-?\d+$/.test(value) ? parseInt(value, 10) : value;
      return {
        type: "category",
        target: ["variable", ["template-tag", name]],
        value: n,
      };
    }
    case "date":
    case "text":
      return {
        type: "category",
        target: ["variable", ["template-tag", name]],
        value: value,
      };
    case undefined:
      // No metadata available (card definition unreadable). Encode optimistically
      // as a template-tag variable with a string value: Metabase accepts string
      // values for number tags too (verified), so this works for the common
      // text/number/date cases. Field filters (`dimension`) cannot be encoded
      // without their field reference and will be rejected by Metabase.
      return {
        type: "category",
        target: ["variable", ["template-tag", name]],
        value: value,
      };
    default:
      // Previously fell through to `undefined`, which JSON.stringify turned
      // into `null` and Metabase rejected opaquely. Fail loudly instead.
      throw new Error(
        `Unsupported parameter type "${type}" for template-tag "${name}"`,
      );
  }
};

/**
 * Builds the Metabase parameter payload for a request.
 *
 * When `cardInfo` is available (non-null) only tags the card declares are sent,
 * using their declared types. When it is null the card definition could not be
 * read, so every query-string parameter that is not a known non-card key is
 * sent optimistically.
 *
 * Returns null if a *known* required tag has no value, which the caller reports
 * as a missing_parameter error rather than forwarding an empty parameter list.
 */
export const buildCardParams = (
  query: Record<string, string>,
  cardInfo: Record<string, TagInfo> | null,
): { params: any[]; assumed: boolean } | { missing: TagInfo & { name: string } } => {
  const params: any[] = [];

  if (cardInfo === null) {
    // Optimistic mode: trust the query string.
    for (const [name, raw] of Object.entries(query)) {
      if (raw === undefined || raw === "") continue;
      if (isNonCardParam(name)) continue;
      params.push(wrapParam(name, raw, undefined));
    }
    return { params, assumed: true };
  }

  for (const [name, info] of Object.entries(cardInfo)) {
    const raw = query[name];
    if (raw === undefined || raw === "") {
      if (info.required) {
        return { missing: { ...info, name } };
      }
      continue;
    }
    params.push(wrapParam(name, raw, info));
  }
  return { params, assumed: false };
};

// card dataset_query:

export const fetchCard = async (id: number, params: any): Promise<any> => {
  const url = apiUrl(`/card/${id}/query/json`);

  const body =
    params && params.length > 0
      ? "parameters=" + encodeURIComponent(JSON.stringify(params))
      : undefined;

  const resp = await fetch(url, {
    method: "POST",
    headers: withAuth({
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
    }),
    body: body,
  });
  if (!resp.ok) {
    throw new Error(
      `Metabase query failed: ${resp.status} ${await resp.text()}`,
    );
  }
  return resp.json();
};
