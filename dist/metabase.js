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
exports.fetchCard = exports.wrapParam = exports.getParametersInfo = exports.updateSession = exports.fetchSession = exports.api = exports.apiUrl = void 0;
const node_fetch_1 = __importDefault(require("node-fetch"));
// export const auth = basicAuth({
//   username: process.env['METABASE_USERNAME'], 
//   password: process.env['METABASE_PASSWORD']
// })
const COLLECTION = (process.env['METABASE_COLLECTION'] || '').split(',');
const apiUrl = (path) => {
    return process.env['METABASE_URL'] + '/api' + path;
};
exports.apiUrl = apiUrl;
const session = { id: undefined };
const withSession = (headers) => {
    if (session.id) {
        return Object.assign(headers, { 'X-Metabase-Session': session.id });
    }
    else {
        return headers;
    }
};
const api = (method, path, params = undefined) => __awaiter(void 0, void 0, void 0, function* () {
    const url = exports.apiUrl(path);
    const resp = yield node_fetch_1.default(url, {
        method: method,
        headers: withSession({ 'Content-Type': 'application/json' }),
        body: JSON.stringify(params)
    });
    const body = yield resp.text();
    if (body[0] !== '{')
        throw new Error(`Error reply: ${body}`);
    return JSON.parse(body);
});
exports.api = api;
const fetchSession = () => __awaiter(void 0, void 0, void 0, function* () {
    return exports.api('POST', '/session', {
        username: process.env['METABASE_USERNAME'],
        password: process.env['METABASE_PASSWORD']
    });
});
exports.fetchSession = fetchSession;
const updateSession = () => {
    return exports.fetchSession().then(({ id }) => {
        const idstr = `${id}`;
        session.id = idstr;
        return idstr;
    });
};
exports.updateSession = updateSession;
// CARD {"database":2,"native":{"template-tags":{"campaign_name":{"id":"5dd2c39a-7222-c46d-8de0-15efaffa1d98","name":"campaign_name","display-name":"Campaign name","type":"text","default":null}},"query":"SELECT * from \ncampaigns \n\n[[ WHERE name = {{campaign_name}}]]"},"type":"native"}
// CARD {"type":"native","native":{"query":"SELECT * from \ncampaigns \n\n[[ WHERE {{campaign_name}}]]","template-tags":{"campaign_name":{"id":"5dd2c39a-7222-c46d-8de0-15efaffa1d98","name":"campaign_name","display-name":"Campaign name","type":"dimension","dimension":["field-id",63],"widget-type":"category","default":null}}},"database":2}
const getParametersInfo = (cardId) => __awaiter(void 0, void 0, void 0, function* () {
    const card = yield exports.api('GET', `/card/${cardId}`);
    const collection = card['collection']['slug'];
    if (COLLECTION.indexOf(collection) < 0)
        throw new Error(`Forbidden access to collection ${collection}`);
    if (card['dataset_query']['type'] !== 'native')
        return {};
    const parSpec = card['dataset_query']['native']['template-tags'];
    const params = {};
    for (const [name, d] of Object.entries(parSpec)) {
        params[name] = d['type'];
    }
    // type is dimension | text | number | date
    return params;
});
exports.getParametersInfo = getParametersInfo;
// [{"type":"category","target":["variable",["template-tag","campaign_name"]],"value":"realgreendeal"}]
// [{"type":"category","target":["dimension",["template-tag","campaign_name"]],"value":["belarus"]}]
const wrapParam = (name, value, type) => {
    switch (type) {
        case 'dimension': {
            return { type: 'category', target: ['dimension', ['template-tag', name]], value: [value] };
        }
        case 'number':
            return { type: 'category', target: ['variable', ['template-tag', name]], value: parseInt(value) };
        case 'date':
        case 'text': {
            return { type: 'category', target: ['variable', ['template-tag', name]], value: value };
        }
    }
};
exports.wrapParam = wrapParam;
// card dataset_query:
const fetchCard = (id, params) => __awaiter(void 0, void 0, void 0, function* () {
    const url = exports.apiUrl(`/card/${id}/query/json`);
    const body = params.length > 0 ?
        ('parameters=' + encodeURIComponent(JSON.stringify(params))) :
        undefined;
    console.log(`fetching card ${id} params ${params}`);
    const resp = yield node_fetch_1.default(url, {
        method: 'POST',
        headers: withSession({ 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }),
        body: body
    });
    return resp.json();
});
exports.fetchCard = fetchCard;
//# sourceMappingURL=metabase.js.map