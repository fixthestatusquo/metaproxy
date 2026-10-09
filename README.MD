# MetaProxy

A lightweight reverse proxy that lets the browser query **Metabase** cards directly, forwarding a **Proca** JWT and enforcing per-parameter access control.

It runs on **Node ≥ 22.18 natively, with no build step**. The TypeScript source runs directly via Node's built-in type stripping (no `tsc`, no `dist/`). The Metabase proxy uses only the built-in `fetch`, `node:http` and a small in-memory cache. The one runtime dependency is the [snowflake engine](https://github.com/fixthestatusquo/snowflake_engine), used by the `/snowflake` routes.

---

## Features

- **Metabase card proxy** — a single route, `GET /card/:id?<param>=<value>`, executes a Metabase native/SQL card with its template-tags and returns the JSON result as-is.
- **Proca user auth** — reads the `Authorization` header (a Proca JWT) and resolves the user's email against Proca.
- **Per-parameter access control** — authorization is driven by the template-tags the *card* declares, so the parameter that is verified is exactly the one sent to Metabase:
  - `org_id` → the value must parse as an integer and the user must belong to that organisation (`src/user.ts:authorizeParams`).
  - `org` → the user must belong to that organisation name.
  - Requests using an org-scoped tag without a valid token get `401`; a valid token without the org gets `403`.
  - Any other parameter is passed through untouched.
- **Collection allowlist** — `GET /card/:id` refuses to serve cards whose collection is not in `METABASE_COLLECTION`; access is rejected server-side before any query runs (`src/metabase.ts:getParametersInfo`).
- **Typed parameter wrapping** — incoming query-string params are converted into Metabase's typed `template-tags` payload, correctly handling `dimension`, `number`, `text` and `date` (`src/metabase.ts:wrapParam`).
- **API-key auth to Metabase** — authenticates with a static Metabase API key (`METABASE_KEY`), sent as the `X-API-Key` header on every request (`src/metabase.ts`). No login/session lifecycle to manage.
- **TTL result caching** — card metadata and card results are cached in-memory for `CACHE_TIMEOUT` seconds (default `15`), keyed by card id and the resolved parameter values (so an org-scoped result is never served for a different org).
- **CORS** — defaults to `localhost:3000` and `localhost:3001`; override with a comma-separated `CORS_ORIGIN`.
- **One runtime dependency** — the snowflake engine (installed from GitHub). Everything else is Node's standard library.

---

## API

### `GET /card/:id`

Runs Metabase card `:id` (must belong to an allowed collection) with the given query parameters.

**Query parameters:** any key matching a template-tag on the card, e.g. `?campaign_name=realgreendeal&org_id=5`.

**Headers:** `Authorization: Bearer <proca-jwt>` is required when the card uses `org_id` / `org` parameters, so the proxy can verify the user's organisation membership.

**Response:** `200` with the card's JSON result; `400` with `{ "error", "message" }` on failure (e.g. forbidden collection, unauthenticated org param).

### Snowflake

The snowflake routes wrap the [snowflake engine](https://github.com/fixthestatusquo/snowflake_engine) (`src/snowflake.ts`). A snowflake turns each language of a Proca campaign into lists of text variants per letter part (subject, body parts, twitter). The engine reads the campaign from `api.proca.app`, and `upload` publishes the variants to Cloudflare KV under one key per language, `<campaign>-<lang>`. The public worker then serves a random combination of variants at `https://snowflake.proca.app/<campaign>/<lang>`.

Every snowflake route requires `Authorization: Bearer <proca-jwt>`. Errors are returned as `{ "error", "message" }`. The `message` is meant to be shown to the user.

### `GET /snowflake/check/:campaign`

Fetches the campaign and returns its variant analysis without publishing anything. It also reads back what is currently deployed in Cloudflare KV, so the two can be compared. Any logged-in user can call it, because the texts are public anyway.

**Response:** `200` with `{ config: { analysis, content }, deployed, deployedError? }`:

- `config.content`: `{ <lang>: { <part>: [variant, …] } }`, the texts that would be published (from the config).
- `config.analysis.analysis`: `{ <lang>: { <part>: count } }`, the number of variants per language and part.
- `config.analysis.max`: the highest count of each part across languages.
- `config.analysis.error`: `{ <lang>: { <part>: diff } }` for each language with fewer variants than `max`. `diff` is negative, or `false` when the part is missing.
- `config.analysis.variants`: the total number of variants of each part, summed over languages.
- `config.analysis.total`: the number of combinations per language (twitter excluded).
- `config.analysis.all`: parts that are `empty` or `single` in every language. It also has `subject` when the best language has fewer than 5 subjects.

The analysis always covers every language, because "fewer variants" only means something compared to the other languages.

`deployed` describes the KV keys of the campaign, i.e. what `snowflake.proca.app/<campaign>/<lang>` serves:

- `deployed.content`: same shape as `config.content`, but only for the languages that have a KV key. A language missing from it is not deployed. It can include languages that were deployed earlier and have since been removed from the config, because those are still live.
- `deployed.analysis`: the same analysis as `config.analysis`, computed over the deployed texts. It uses the config's part names, so a part missing from KV shows up in `error` as `false`.
- `deployed.inSync`: `{ <lang>: boolean }` for every config language. `true` when the deployed texts are exactly the config texts (part order is ignored).
- `deployed.errors`: `{ <lang>: message }` for keys that exist but couldn't be read or parsed. Those languages are left out of `deployed.content`, so their state is unknown rather than "not deployed".

If KV can't be listed at all (missing `CLOUDFLARE_*` variables, a token without read access, Cloudflare down), the check still succeeds: `deployed` is `null` and `deployedError` says why.

The deployed state is cached for `CACHE_TIMEOUT` seconds per campaign, to stay under the Cloudflare API rate limit. An upload replaces the cached state with its own `deployed`.

### `POST /snowflake/upload/:campaign[?lang=<lang>]`

Fetches the campaign and writes its variants to Cloudflare KV. Only owners and campaigners of the campaign's lead org can call it.

**Query parameters:**

- `lang` (optional): publish only that language (key `<campaign>-<lang>`). It is case-insensitive. Without it, every language is published.

**Response:** `200` with `{ config, deployed, deployedError?, keys }`, the same shape as `check` plus `keys`, so the dashboard can replace its check data with it. `config` covers all languages, even with `lang`. `keys` lists only the KV keys actually written, e.g. `["mtt_x-fr"]`.

`deployed` is the state right after the upload: the languages just written come from the uploaded texts, the others are read from KV. Reading KV back could still return the previous version for a moment, so those languages are already `inSync: true`. The result also replaces the cached deployed state, so a `check` right after gets the same answer. If KV can't be read after a successful write, the upload still returns `200` with `deployed: null` and `deployedError`.

**Errors:**

| Status | `error` | When |
|---|---|---|
| `400` | `invalid_lang` | `lang` is empty, or the campaign has no such language (the message lists the available ones) |
| `401` | `Error` | No `Authorization` header |
| `403` | `Error` | The user is not an owner or campaigner of the lead org |
| `404` | `proca_error` | The campaign doesn't exist |
| `405` | `method_not_allowed` | Wrong HTTP method (`check` is `GET`, `upload` is `POST`) |
| `500` | `cloudflare_error` | The `CLOUDFLARE_*` variables are not configured |
| `502` | `cloudflare_error` | The Cloudflare KV API rejected the write. If several languages are uploaded, the ones before the failure are already written |
| `4xx/502` | `proca_error` | The Proca API failed or rejected the token |

---

## Configuration

All configuration is via environment variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| `METABASE_URL` | ✅ | — | Base URL of the Metabase instance, e.g. `https://metabase.yourdomain.com` |
| `METABASE_KEY` | ✅ | — | Metabase API key, sent as the `X-API-Key` header. Create one under *Admin settings → Authentication → API keys* |
| `PROCA_URL` | | `https://api.proca.app` | Proca GraphQL API endpoint used to resolve the user |
| `JWKS_URL` | | — | (reserved) URL of a `jwks.json` for token verification |
| `CORS_ORIGIN` | | `http://localhost:3000,http://localhost:3001` | Comma-separated list of allowed origins |
| `CACHE_TIMEOUT` | | `15` | TTL in seconds for cached card results and the deployed snowflake state |
| `PORT` | | `4040` | HTTP listen port |
| `CLOUDFLARE_ACCOUNT_ID` | for `/snowflake` | — | Cloudflare account of the `snowflake` KV namespace |
| `CLOUDFLARE_KV_NAMESPACE_ID` | for `/snowflake` | — | ID of the `snowflake` KV namespace |
| `CLOUDFLARE_API_TOKEN` | for `/snowflake` | — | Cloudflare API token with read and write access to that namespace (secret). Without them, `upload` fails and `check` returns `deployed: null` |

> Note: credentials in `.env` are for development only. Keep `.env` git-ignored (or rotate credentials if they were ever committed).

---

## Getting started

No build step. One `npm install` fetches the snowflake engine, then run it with Node.

```bash
# install the snowflake engine (a GitHub dependency; .npmrc allows git deps for npm ≥ 12)
npm install

# configure
cp .env.example .env   # or export the env vars above

# run (the entrypoint loads .env itself)
npm start              # => node bin/metaproxy.mjs
# or
./run.sh               # => node bin/metaproxy.mjs
# or
node src/index.ts      # needs the env vars set in your shell
```

> Requires Node ≥ 22.18, which runs this TypeScript natively (type stripping). There is no `dist/` and no `tsc` step.

---

## Development

Start the proxy natively:

```bash
npm start            # node bin/metaproxy.mjs
node src/index.ts    # run without the .env loader
```

Apart from the snowflake engine, everything is Node's standard library plus the `.ts` source in `src/`. The only dev dependency is `@types/node`, for editor type checking.

---

## Project layout

```
src/
  index.ts     # HTTP server (node:http), routing, CORS, caching, session refresh
  metabase.ts  # Metabase API client: session, card metadata, param wrapping, fetchCard
  user.ts      # Proca user resolution + parameter access control
  snowflake.ts # /snowflake/check and /snowflake/upload (wraps the snowflake engine)
  engine.d.ts  # types for the snowflake engine (plain JS dependency)
  deployed.ts  # reads the deployed snowflake back from Cloudflare KV
  cache.ts     # tiny in-memory TTL cache
```

---

## License

MIT
