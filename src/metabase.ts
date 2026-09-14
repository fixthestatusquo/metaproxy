const COLLECTION = (process.env["METABASE_COLLECTION"] || "").split(",");

export const apiUrl = (path: string) => {
  return process.env["METABASE_URL"] + "/api" + path;
};

// Authenticates to Metabase with a static API key (env METABASE_KEY),
// sent as the X-API-Key header on every request.
const withApiKey = (headers: Record<string, string>) => {
  return Object.assign(headers, { "X-API-Key": process.env["METABASE_KEY"] });
};

export const api = async (
  method: "GET" | "POST",
  path: string,
  params?: Record<string, number | string>,
): Promise<any> => {
  const url = apiUrl(path);

  const resp = await fetch(url, {
    method,
    headers: withApiKey({ "Content-Type": "application/json" }),
    body: JSON.stringify(params),
  });

  const body = await resp.text();

  if (body[0] !== "{") throw new Error(`Error reply: ${body}`);

  return JSON.parse(body);
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

  if (datasetQuery["type"] !== "native") {
    // A GUI/structured question has no template-tags to bind URL params to.
    console.warn(
      `Card ${cardId} is not a native query (type=${datasetQuery["type"]}); ` +
        `it declares no template-tags, so URL parameters cannot be applied`,
    );
    return {};
  }

  const parSpec = datasetQuery["native"]?.["template-tags"] || {};

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
    headers: withApiKey({
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
