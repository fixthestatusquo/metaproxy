# MetaProxy

A lightweight reverse proxy that lets the browser query **Metabase** cards directly, forwarding a **Proca** JWT and enforcing per-parameter access control.

It runs on **Node ≥ 23.6 natively — zero runtime dependencies and no build step**. The TypeScript source runs directly via Node's built-in type stripping (no `tsc`, no `dist/`). Just the built-in `fetch`, `node:http`, and a small in-memory cache.

---

## Features

- **Metabase card proxy** — a single route, `GET /card/:id?<param>=<value>`, executes a Metabase native/SQL card with its template-tags and returns the JSON result as-is.
- **Proca user auth** — reads the `Authorization` header (a Proca JWT) and resolves the user's email against Proca.
- **Per-parameter access control** — a card query is only executed if the authenticated Proca user is allowed to use the requested parameters:
  - `org_id` → the user must belong to that organisation (`src/user.ts:allowParams`).
  - `org` → the user must belong to that organisation name.
  - Any other parameter is passed through untouched.
- **Collection allowlist** — `GET /card/:id` refuses to serve cards whose collection is not in `METABASE_COLLECTION`; access is rejected server-side before any query runs (`src/metabase.ts:getParametersInfo`).
- **Typed parameter wrapping** — incoming query-string params are converted into Metabase's typed `template-tags` payload, correctly handling `dimension`, `number`, `text` and `date` (`src/metabase.ts:wrapParam`).
- **Automatic session management** — logs into Metabase on startup and refreshes the session every 15 minutes (`src/index.ts` + `src/metabase.ts:fetchSession`/`updateSession`).
- **TTL result caching** — card metadata and card results are cached in-memory for `CACHE_TIMEOUT` seconds (default `15`), keyed by card id (or card id + parameters).
- **CORS** — defaults to `localhost:3000` and `localhost:3001`; override with a comma-separated `CORS_ORIGIN`.
- **Zero runtime dependencies** — only Node's standard library at runtime.

---

## API

### `GET /card/:id`

Runs Metabase card `:id` (must belong to an allowed collection) with the given query parameters.

**Query parameters:** any key matching a template-tag on the card, e.g. `?campaign_name=realgreendeal&org_id=5`.

**Headers:** `Authorization: Bearer <proca-jwt>` is required when the card uses `org_id` / `org` parameters, so the proxy can verify the user's organisation membership.

**Response:** `200` with the card's JSON result; `400` with `{ "error", "message" }` on failure (e.g. forbidden collection, unauthenticated org param).

---

## Configuration

All configuration is via environment variables:

| Variable | Required | Default | Description |
|---|---|---|---|
| `METABASE_URL` | ✅ | — | Base URL of the Metabase instance, e.g. `https://metabase.yourdomain.com` |
| `METABASE_USERNAME` | ✅ | — | Metabase login email |
| `METABASE_PASSWORD` | ✅ | — | Metabase password |
| `PROCA_URL` | | `https://api.proca.app` | Proca GraphQL API endpoint used to resolve the user |
| `JWKS_URL` | | — | (reserved) URL of a `jwks.json` for token verification |
| `CORS_ORIGIN` | | `http://localhost:3000,http://localhost:3001` | Comma-separated list of allowed origins |
| `CACHE_TIMEOUT` | | `15` | TTL in seconds for cached card results |
| `PORT` | | `4040` | HTTP listen port |

> Note: credentials in `.env` are for development only. Keep `.env` git-ignored (or rotate credentials if they were ever committed).

---

## Getting started

No install and no build step — just run it with Node.

```bash
# configure
cp .env.example .env   # or export the env vars above

# run (the entrypoint loads .env itself)
npm start              # => node bin/metaproxy.mjs
# or
./run.sh               # => node bin/metaproxy.mjs
# or
node src/index.ts      # needs the env vars set in your shell
```

> Requires Node ≥ 23.6, which runs this TypeScript natively (type stripping). There is no `dist/`, no `tsc`, and no runtime `npm install` needed.

---

## Development

Start the proxy natively:

```bash
npm start            # node bin/metaproxy.mjs
node src/index.ts    # run without the .env loader
```

There are no dependencies — everything is Node's standard library plus the `.ts` source in `src/`.

---

## Project layout

```
src/
  index.ts     # HTTP server (node:http), routing, CORS, caching, session refresh
  metabase.ts  # Metabase API client: session, card metadata, param wrapping, fetchCard
  user.ts      # Proca user resolution + parameter access control
  cache.ts     # tiny in-memory TTL cache
```

---

## License

MIT
