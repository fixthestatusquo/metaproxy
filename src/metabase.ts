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
  // The template-tag's UUID, used as the parameter `id` when known.
  dimensionId?: string;
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

  // Locate the template-tags. Metabase versions expose these in different
  // places:
  //   v0.46 and earlier : dataset_query.native["template-tags"]  (object keyed
  //                       by tag name)
  //   v0.49+ (observed v0.63): dataset_query.stages[0]["template-tags"] as an
  //                       ARRAY of tag objects, within MBQL v2 where
  //                       dataset_query has no "type"/"native" keys at all.
  const native = datasetQuery["native"];
  const stages = datasetQuery["stages"];

  // Flatten any stage-declared template-tags (array or object) into one map.
  const fromStages = (): Record<string, any> | undefined => {
    if (!Array.isArray(stages)) return undefined;
    const merged: Record<string, any> = {};
    for (const stage of stages) {
      const st = stage?.["template-tags"];
      if (!st) continue;
      if (Array.isArray(st)) {
        for (const t of st) {
          if (t && typeof t === "object" && typeof t["name"] === "string") {
            merged[t["name"]] = t;
          }
        }
      } else if (typeof st === "object") {
        for (const [name, t] of Object.entries(st)) merged[name] = t;
      }
    }
    return Object.keys(merged).length > 0 ? merged : undefined;
  };

  const tagSources: Array<[string, any]> = [
    ["dataset_query.stages[].template-tags", fromStages()],
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
      // Tag lists arrive as arrays of {name, ...} objects.
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
      datasetQuery["type"] === "native" ||
      card["query_type"] === "native" ||
      // MBQL v2 (v0.49+): a native stage carries the SQL string.
      (Array.isArray(stages) &&
        stages.some(
          (s) =>
            s &&
            (s["lib/type"] === "mbql.stage/native" ||
              typeof s["native"] === "string"),
        ));

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
    if (typeof spec["id"] === "string" && spec["id"] !== "") {
      info.dimensionId = spec["id"];
    }
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

// Metabase parameter objects. The `id` key is required by newer Metabase
// versions (v0.63 rejects a parameter without it, reporting
// "parameters[0].id: missing required key, received: nil"), and is accepted
// and ignored by older ones, so it is always included.
//
// The VALUE matters on v0.63: it must be the template-tag's UUID. Verified
// against metabase.proca.app (v0.63.13), card 179:
//   id="org_id" (name)                        -> 400 "pick a value for 'Org'"
//   id="183a7d06-e73e-75d6-1f7f-90a0225585d8" -> 200 with rows
// v0.46 ignores `id` entirely, so it also works there.
//
// The UUID is per-card and per-tag, so it is always read from the card
// definition at runtime and never hardcoded. When the card definition is
// unreadable there is no UUID to use and the name is sent instead, which v0.63
// will reject; that case is logged by the caller.
const paramIdStyle = () => process.env["PARAM_ID_STYLE"] || "uuid";

// [{"id":"campaign_name","type":"category","target":["variable",["template-tag","campaign_name"]],"value":"realgreendeal"}]
// [{"id":"campaign_name","type":"category","target":["dimension",["field",1,null]],"value":["belarus"]}]
export const wrapParam = (name: string, value: string, tag?: TagInfo) => {
  const type = tag?.type;
  const id =
    paramIdStyle() === "uuid" && tag?.dimensionId ? tag.dimensionId : name;
  switch (type) {
    case "dimension": {
      const target = tag?.fieldRef
        ? ["dimension", tag.fieldRef]
        : ["dimension", ["template-tag", name]];
      return { id, type: "category", target, value: [value] };
    }
    case "number": {
      // Send a real number when the value is integral; otherwise pass the
      // string through so Metabase reports a meaningful error rather than NaN.
      const n = /^-?\d+$/.test(value) ? parseInt(value, 10) : value;
      return {
        id,
        type: "category",
        target: ["variable", ["template-tag", name]],
        value: n,
      };
    }
    case "date":
    case "text":
      return {
        id,
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
        id,
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

  if (process.env["DEBUG_PARAMS"] === "1") {
    console.log(`POST ${url} parameters=${JSON.stringify(params)}`);
  }

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
