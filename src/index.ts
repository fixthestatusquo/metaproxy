import express, {Request, Response, NextFunction} from 'express'
import jwt from 'express-jwt'
import jwksRsa from 'jwks-rsa'
import NodeCache from 'node-cache'
import {api, updateSession, getParametersInfo, wrapParam, fetchCard} from './metabase'


const cache = new NodeCache()

for (const v of ['JWKS_URL', 'METABASE_USERNAME', 'METABASE_PASSWORD']) {
    if (!(v in process.env)) 
        throw new Error(`Set ${v}`)
}

const jwks = ({jwks, algs = ["RS256"]}) => jwt({ 
  secret : jwksRsa.expressJwtSecret({
    cache: true,
    rateLimit: true,
    jwksRequestsPerMinute: 5,
    jwksUri: jwks
  }), 
  algorithms: algs 
})

const app = express()

var checkJwt = jwks({
    jwks : process.env['JWKS_URL']
});

 
// Add middleware to a route to protect it
app.get("/card/:id", checkJwt, async (req, res, next) => {
    const cardId = parseInt(req.params.id)
    const cardParams = []

    const key4info = `info-${cardId}`
    let cardInfo = cache.get(key4info)
    if (cardInfo === undefined) {
        cardInfo = await getParametersInfo(cardId)
        cache.set(key4info, cardInfo, 1000*10)
    }

    console.log('WTF', Object.entries(req.query))
    for (const name of Object.keys(cardInfo))  {
        const value = req.query[name] as string
        if (value)
            cardParams.push(wrapParam(name, value, cardInfo[name]))
    }
    console.log('cardParams:', cardParams)


    // get data with caching
    const key = JSON.stringify([cardId, Object.entries(cardParams).sort()])
    let data : any = cache.get(key)
    if (data === undefined) {
        data = await fetchCard(cardId, cardParams);
        console.log('boom', key, data)
        cache.set(key, data, 30*1000)
    }

    res.status(200)
    res.setHeader('Content-Type', 'application/json')
    res.end(JSON.stringify(data))
})

//function errorMiddleware(error: HttpException, request: Request, response: Response, next: NextFunction) {
app.use((err : any, _req : Request, res : Response, _next : NextFunction) => {
  res.status(400).json({
    name: err?.name || 'error',
    message: err?.message || 'generic error'
  });
});

const appPort = process.env['PORT'] || 4040;

updateSession().catch(e => console.error(e))
const cron = setInterval(( ) => {
    updateSession()
}, 1000*60*15);

app.listen(appPort, () => {
    console.log(`Started server at port ${appPort}`)
})
 


