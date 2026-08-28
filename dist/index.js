"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const http_1 = __importDefault(require("http"));
const url_1 = require("url");
const cache_1 = require("./cache");
const metabase_1 = require("./metabase");
const user_1 = require("./user");
const cache = new cache_1.Cache();
const cacheTimeout = parseInt(process.env["CACHE_TIMEOUT"] || "15");
for (const v of [
    "METABASE_URL",
    "METABASE_USERNAME",
    "METABASE_PASSWORD",
    "METABASE_COLLECTION",
]) {
    if (!process.env[v])
        throw new Error(`Set ${v}`);
}
const allowedOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((d) => d.trim())
    : ["http://localhost:3000", "http://localhost:3001"];
// Replaces the `cors` middleware for this proxy: reflect the origin if it is
// allowed, and answer preflight OPTIONS requests.
const corsHeaders = (origin) => {
    if (origin && allowedOrigins.indexOf(origin) >= 0) {
        return { "Access-Control-Allow-Origin": origin, Vary: "Origin" };
    }
    return { Vary: "Origin" };
};
const server = http_1.default.createServer((req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const origin = req.headers.origin;
    const url = new url_1.URL(req.url || "/", `http://${req.headers.host}`);
    if (req.method === "OPTIONS") {
        // CORS preflight
        res.writeHead(204, Object.assign(Object.assign({}, corsHeaders(origin)), { "Access-Control-Allow-Methods": "GET,HEAD,PUT,PATCH,POST,DELETE", "Access-Control-Allow-Headers": req.headers["access-control-request-headers"] || "", "Access-Control-Max-Age": "86400" }));
        res.end();
        return;
    }
    if (req.method === "GET" && url.pathname.startsWith("/card/")) {
        handleCard(req, res, url);
        return;
    }
    res.writeHead(404, Object.assign(Object.assign({}, corsHeaders(origin)), { "Content-Type": "application/json" }));
    res.end(JSON.stringify({ error: "not_found", message: "Not found" }));
}));
function handleCard(req, res, url) {
    return __awaiter(this, void 0, void 0, function* () {
        const origin = req.headers.origin;
        const fail = (code, name, message) => {
            res.writeHead(code, Object.assign(Object.assign({}, corsHeaders(origin)), { "Content-Type": "application/json" }));
            res.end(JSON.stringify({ error: name, message }));
        };
        try {
            // Authenticate (optional): reads the Authorization header, if present.
            let user = null;
            const auth = req.headers.authorization;
            if (auth) {
                console.log("fetching user");
                user = yield (0, user_1.fetchUser)(auth);
            }
            const query = Object.fromEntries(url.searchParams.entries());
            if (!(0, user_1.allowParams)(user, query)) {
                console.log(user, query);
                return fail(400, "Error", "User not authorized to use this parameter");
            }
            const cardId = parseInt(url.pathname.split("/")[2]);
            const cardParams = [];
            const key4info = `info-${cardId}`;
            let cardInfo = cache.get(key4info);
            if (cardInfo === undefined) {
                cardInfo = yield (0, metabase_1.getParametersInfo)(cardId);
                cache.set(key4info, cardInfo, cacheTimeout);
            }
            const names = Object.keys(cardInfo);
            for (let i = 0; i < names.length; i++) {
                const name = names[i];
                const value = query[name];
                if (value)
                    cardParams.push((0, metabase_1.wrapParam)(name, value, cardInfo[name]));
            }
            console.log(`Question ${cardId} parameters`, JSON.stringify(cardParams, null, 2));
            // get data with caching
            const key = JSON.stringify([cardId, Object.entries(cardParams).sort()]);
            let data = cache.get(key);
            if (data === undefined) {
                data = yield (0, metabase_1.fetchCard)(cardId, cardParams);
                cache.set(key, data, cacheTimeout);
            }
            res.writeHead(200, Object.assign(Object.assign({}, corsHeaders(origin)), { "Content-Type": "application/json" }));
            res.end(JSON.stringify(data));
        }
        catch (e) {
            const err = e;
            return fail(400, (err === null || err === void 0 ? void 0 : err.name) || "error", (err === null || err === void 0 ? void 0 : err.message) || "generic error");
        }
    });
}
const appPort = process.env["PORT"] || 4040;
(0, metabase_1.updateSession)().catch((e) => console.error(e));
const cron = setInterval(() => {
    (0, metabase_1.updateSession)();
}, 1000 * 60 * 15);
server.listen(appPort, () => {
    console.log(`Started server at port ${appPort}`);
});
//# sourceMappingURL=index.js.map