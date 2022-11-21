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
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const node_cache_1 = __importDefault(require("node-cache"));
const metabase_1 = require("./metabase");
const user_1 = require("./user");
const cache = new node_cache_1.default();
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
const app = express_1.default();
var corsOptions = {
    origin: [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://we.fixthestatusquo.org",
    ],
};
app.use(cors_1.default(corsOptions));
app.use((req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    req.context = { user: null };
    const auth = req.headers.authorization;
    if (auth) {
        req.context.user = yield user_1.fetchUser(auth);
        console.log("user", req.context.user);
    }
    next();
}));
// Add middleware to a route to protect ita
app.options("/card/:id", cors_1.default(corsOptions));
app.get("/card/:id", (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    if (!user_1.allowParams((_a = req.context) === null || _a === void 0 ? void 0 : _a.user, req.query)) {
        console.log((_b = req.context) === null || _b === void 0 ? void 0 : _b.user, req.query);
        return next(Error("User not authorized to use this parameter"));
    }
    try {
        const cardId = parseInt(req.params.id);
        const cardParams = [];
        const key4info = `info-${cardId}`;
        let cardInfo = cache.get(key4info);
        if (cardInfo === undefined) {
            cardInfo = yield metabase_1.getParametersInfo(cardId);
            console.log(`Question ${cardId} parameters info:`, cardInfo);
            cache.set(key4info, cardInfo, cacheTimeout);
        }
        console.log("Request params:", Object.entries(req.query));
        for (const name of Object.keys(cardInfo)) {
            const value = req.query[name];
            if (value)
                cardParams.push(metabase_1.wrapParam(name, value, cardInfo[name]));
        }
        console.log("cardParams for API:", cardParams);
        // get data with caching
        const key = JSON.stringify([cardId, Object.entries(cardParams).sort()]);
        let data = cache.get(key);
        if (data === undefined) {
            data = yield metabase_1.fetchCard(cardId, cardParams);
            cache.set(key, data, cacheTimeout);
        }
        res.status(200);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify(data));
    }
    catch (e) {
        next(e);
    }
}));
//function errorMiddleware(error: HttpException, request: Request, response: Response, next: NextFunction) {
app.use((err, _req, res, _next) => {
    res.status(400).json({
        error: (err === null || err === void 0 ? void 0 : err.name) || "error",
        message: (err === null || err === void 0 ? void 0 : err.message) || "generic error",
    });
});
const appPort = process.env["PORT"] || 4040;
metabase_1.updateSession().catch((e) => console.error(e));
const cron = setInterval(() => {
    metabase_1.updateSession();
}, 1000 * 60 * 15);
app.listen(appPort, () => {
    console.log(`Started server at port ${appPort}`);
});
//# sourceMappingURL=index.js.map