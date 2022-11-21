import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import NodeCache from "node-cache";
import {
  api,
  updateSession,
  getParametersInfo,
  wrapParam,
  fetchCard,
} from "./metabase";
import { fetchUser, allowParams, UserData } from "./user";

interface Context {
  user: UserData | null;
}

declare global {
  namespace Express {
    interface Request {
      context: Context;
    }
  }
}

const cache = new NodeCache();
const cacheTimeout = parseInt(process.env["CACHE_TIMEOUT"] || "15");

for (const v of [
  "METABASE_URL",
  "METABASE_USERNAME",
  "METABASE_PASSWORD",
  "METABASE_COLLECTION",
]) {
  if (!process.env[v]) throw new Error(`Set ${v}`);
}

const app = express();

var corsOptions = {
  origin: [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://we.fixthestatusquo.org",
  ],
};
app.use(cors(corsOptions));

app.use(async (req, res, next) => {
  req.context = { user: null };
  const auth = req.headers.authorization;
  if (auth) {
    req.context.user = await fetchUser(auth);
    console.log("user",req.context.user);
  }

  next();
});

// Add middleware to a route to protect ita
app.options("/card/:id", cors(corsOptions));

app.get("/card/:id", async (req, res, next) => {
  if (!allowParams(req.context?.user, req.query)) {
    console.log(req.context?.user, req.query);
    return next(Error("User not authorized to use this parameter"));
  }

  try {
    const cardId = parseInt(req.params.id);
    const cardParams = [];

    const key4info = `info-${cardId}`;
    let cardInfo = cache.get(key4info);
    if (cardInfo === undefined) {
      cardInfo = await getParametersInfo(cardId);
      console.log(`Question ${cardId} parameters info:`, cardInfo);
      cache.set(key4info, cardInfo, cacheTimeout);
    }

    console.log("Request params:", Object.entries(req.query));
    for (const name of Object.keys(cardInfo)) {
      const value = req.query[name] as string;
      if (value) cardParams.push(wrapParam(name, value, cardInfo[name]));
    }
    console.log("cardParams for API:", cardParams);

    // get data with caching
    const key = JSON.stringify([cardId, Object.entries(cardParams).sort()]);
    let data: any = cache.get(key);
    if (data === undefined) {
      data = await fetchCard(cardId, cardParams);
      cache.set(key, data, cacheTimeout);
    }

    res.status(200);
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(data));
  } catch (e) {
    next(e);
  }
});

//function errorMiddleware(error: HttpException, request: Request, response: Response, next: NextFunction) {
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  res.status(400).json({
    error: err?.name || "error",
    message: err?.message || "generic error",
  });
});

const appPort = process.env["PORT"] || 4040;

updateSession().catch((e) => console.error(e));
const cron = setInterval(() => {
  updateSession();
}, 1000 * 60 * 15);

app.listen(appPort, () => {
  console.log(`Started server at port ${appPort}`);
});
