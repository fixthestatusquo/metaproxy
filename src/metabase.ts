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

export const getParametersInfo = async (
  cardId: number,
): Promise<Record<string, TagInfo>> => {
  const card = await api("GET", `/card/${cardId}`);

  // A card the API key cannot fully read comes back without dataset_query (or
  // with it redacted). Previously this fell through to `return {}`, which made
  // the card look parameterless and produced a silent, hard-to-diagnose 400.
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
    throw new Error(
      `Card ${cardId} response has no dataset_query; ` +
        `METABASE_KEY likely lacks permission to read the card definition`,
    );
  }

  // Determine "is this a native/SQL card?" structurally rather than trusting
  // dataset_query.type: newer Metabase versions may omit that discriminator
  // (observed as `type=undefined` on v0.63), which previously made every card
  // look non-native and silently drop all URL parameters.
  const native = datasetQuery["native"];
  const isNative =
    datasetQuery["type"] === "native" ||
    card["query_type"] === "native" ||
    (native !== null && typeof native === "object") ||
    // Some payloads surface template-tags directly on dataset_query.
    (datasetQuery["template-tags"] !== undefined &&
      typeof datasetQuery["template-tags"] === "object");

  if (!isNative) {
    console.warn(
      `Card ${cardId} is not a native query ` +
        `(dataset_query.type=${JSON.stringify(datasetQuery["type"])}, ` +
        `query_type=${JSON.stringify(card["query_type"])}); ` +
        `it declares no template-tags, so URL parameters cannot be applied`,
    );
    return {};
  }

  const parSpec: Record<string, any> =
    (native && typeof native === "object" && native["template-tags"]) ||
    datasetQuery["template-tags"] ||
    {};

  const params: Record<string, TagInfo> = {};

  for (const [name, d] of Object.entries(parSpec)) {
    const spec = d as any;
    const info: TagInfo = { type: spec["type"] };
    if (spec["display-name"] !== undefined)
      info.displayName = spec["display-name"];
    if (spec["required"] !== undefined) info.required = !!spec["required"];
    // Field filters carry the field reference we need for a valid target.
    if (spec["dimension"] !== undefined) info.fieldRef = spec["dimension"];
    params[name] = info;
  }

  if (Object.keys(params).length === 0) {
    console.warn(
      `Card ${cardId} (collection=${collection}) declares no template-tags; ` +
        `no URL parameters will be applied`,
    );
  }

  return params;
};

// [{"type":"category","target":["variable",["template-tag","campaign_name"]],"value":"realgreendeal"}]
// [{"type":"category","target":["dimension",["field",1,null]],"value":["belarus"]}]
export const wrapParam = (name: string, value: string, tag: TagInfo) => {
  const type = tag.type;
  switch (type) {
    case "dimension": {
      // Field filters need a field reference. Fall back to the template-tag
      // form only if the card did not expose one.
      const target = tag.fieldRef
        ? ["dimension", tag.fieldRef]
        : ["dimension", ["template-tag", name]];
      return {
        type: "category",
        target,
        value: [value],
      };
    }
    case "number":
      return {
        type: "category",
        target: ["variable", ["template-tag", name]],
        value: parseInt(value),
      };
    case "date":
    case "text": {
      return {
        type: "category",
        target: ["variable", ["template-tag", name]],
        value: value,
      };
    }
    default:
      // Previously fell through to `undefined`, which JSON.stringify turned
      // into `null` and Metabase rejected opaquely. Fail loudly instead.
      throw new Error(
        `Unsupported parameter type "${type}" for template-tag "${name}"`,
      );
  }
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
