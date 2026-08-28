#!/usr/bin/env sh
# MetaProxy runs natively with Node's type stripping — no build step.
# .env is loaded by the entrypoint itself, so this just starts it.
exec node bin/metaproxy.mjs
