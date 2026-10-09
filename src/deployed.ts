// Read back what `upload` wrote to the Cloudflare KV namespace "snowflake":
// one key `<campaign>-<lang>` per language, value = { part: [variants] }.
import type { Variants } from "snowflake/fetch.js";
import { Cache } from "./cache.ts";

export type Deployed = {
  content: Variants; // only the languages that have a readable key
  errors: Record<string, string>; // lang -> why its value couldn't be read
};

// lowercased language codes as the engine writes them (en, en_gb). Used for
// keys of languages no longer in the config; config languages always match.
const LANG = /^[a-z]{2,3}(_[a-z]{2})?$/;

// every check would otherwise cost 1 list + 1 read per language against the
// Cloudflare API rate limit, which uploads share
const cache = new Cache(parseInt(process.env["CACHE_TIMEOUT"] || "15"));

export const forgetDeployed = (campaign: string) => cache.delete(campaign);

const kvBase = (): { base: string; token: string } => {
  const account = process.env["CLOUDFLARE_ACCOUNT_ID"];
  const namespace = process.env["CLOUDFLARE_KV_NAMESPACE_ID"];
  const token = process.env["CLOUDFLARE_API_TOKEN"];
  if (!account || !namespace || !token) {
    throw new Error(
      "missing CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_KV_NAMESPACE_ID / CLOUDFLARE_API_TOKEN",
    );
  }
  return {
    base: `https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${namespace}`,
    token,
  };
};

// Throws when the listing fails (credentials, network): the deployed state is
// then unknown. A single unreadable value only lands in `errors`.
// `written`: texts an upload just wrote. They replace what KV returns for
// those languages, which may still be the previous version (KV is eventually
// consistent), and bypass the cache.
export const deployed = async (
  campaign: string,
  configLangs: string[],
  written?: Variants,
): Promise<Deployed> => {
  const cached = written ? undefined : cache.get(campaign);
  if (cached) return cached;

  const { base, token } = kvBase();
  const headers = { Authorization: `Bearer ${token}` };
  const prefix = `${campaign}-`;

  // the prefix also matches other campaigns (foo- matches foo-bar-en), so
  // keep only keys whose rest is a language
  const langs: string[] = [];
  let cursor = "";
  do {
    const query = new URLSearchParams({ prefix, limit: "1000" });
    if (cursor) query.set("cursor", cursor);
    const res = await fetch(`${base}/keys?${query}`, { headers });
    if (!res.ok) throw new Error(`list ${res.status} ${await res.text()}`);
    const body = (await res.json()) as {
      result: { name: string }[];
      result_info?: { cursor?: string };
    };
    for (const { name } of body.result) {
      const lang = name.slice(prefix.length);
      if (configLangs.includes(lang) || LANG.test(lang)) langs.push(lang);
    }
    cursor = body.result_info?.cursor || "";
  } while (cursor);

  const result: Deployed = { content: {}, errors: {} };
  await Promise.all(
    langs.map(async (lang) => {
      const key = encodeURIComponent(`${prefix}${lang}`);
      try {
        const res = await fetch(`${base}/values/${key}`, { headers });
        if (!res.ok) throw new Error(`${res.status} ${await res.text()}`);
        result.content[lang] = JSON.parse(await res.text());
      } catch (e) {
        result.errors[lang] = (e as Error).message;
      }
    }),
  );
  for (const [lang, texts] of Object.entries(written ?? {})) {
    result.content[lang] = texts;
    delete result.errors[lang];
  }
  cache.set(campaign, result);
  return result;
};

// key order doesn't matter: config and KV may list parts differently
const canonical = (value: unknown): string =>
  JSON.stringify(value, (_, v) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1)))
      : v,
  );

// config language -> deployed texts are exactly the config texts
export const inSync = (
  config: Variants,
  live: Variants,
): Record<string, boolean> =>
  Object.fromEntries(
    Object.keys(config).map((lang) => [
      lang,
      lang in live && canonical(config[lang]) === canonical(live[lang]),
    ]),
  );
