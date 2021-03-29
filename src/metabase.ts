import fetch from 'node-fetch'
import {basicAuth} from '@proca/api'

// export const auth = basicAuth({
//   username: process.env['METABASE_USERNAME'], 
//   password: process.env['METABASE_PASSWORD']
// })

export const apiUrl = (path:string) => {
  return process.env['METABASE_URL'] + '/api' + path
}

type Session = {
  id: string | undefined
}
const session : Session = {id:undefined};

const withSession = (headers) => {
  if (session.id) {
    return Object.assign(headers, { 'X-Metabase-Session': session.id })
  } else { 
    return headers 
  }
}

export const api = async (method : 'GET' | 'POST', path:string, params: Record<string,number | string> = undefined) => {
  const url = apiUrl(path)

  const resp = await fetch(url, {
    method: method,
    headers: withSession({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(params)
  })

  return resp.json()
}

export const fetchSession = async () => {
  return api('POST','/session', {
    username: process.env['METABASE_USERNAME'], 
    password: process.env['METABASE_PASSWORD']
  })
};

export const updateSession = () => {
  return fetchSession().then(({id}) => {
    const idstr = `${id}`
    session.id = idstr
    return idstr
  })
}

// CARD {"database":2,"native":{"template-tags":{"campaign_name":{"id":"5dd2c39a-7222-c46d-8de0-15efaffa1d98","name":"campaign_name","display-name":"Campaign name","type":"text","default":null}},"query":"SELECT * from \ncampaigns \n\n[[ WHERE name = {{campaign_name}}]]"},"type":"native"}
// CARD {"type":"native","native":{"query":"SELECT * from \ncampaigns \n\n[[ WHERE {{campaign_name}}]]","template-tags":{"campaign_name":{"id":"5dd2c39a-7222-c46d-8de0-15efaffa1d98","name":"campaign_name","display-name":"Campaign name","type":"dimension","dimension":["field-id",63],"widget-type":"category","default":null}}},"database":2}

export const getParametersInfo = async (cardId : number) => {
  const card = await api('GET', `/card/${cardId}`)
  if (card['dataset_query']['type'] !== 'native') return {}
  const parSpec = card['dataset_query']['native']['template-tags']

  const params = {}

  for (const [name, d] of Object.entries(parSpec)) {
    params[name] = d['type']
  }
  // type is dimension | text | number | date

  return params
}

// [{"type":"category","target":["variable",["template-tag","campaign_name"]],"value":"realgreendeal"}]
// [{"type":"category","target":["dimension",["template-tag","campaign_name"]],"value":["belarus"]}]
export const wrapParam = (name : string, value : string, type : string) => {
  switch (type) {
    case 'dimension': { 
      return {type: 'category', target: ['dimension', ['template-tag', name]], value: [value]}
    }
    case 'number':
      return {type: 'category', target: ['variable', ['template-tag', name]], value: parseInt(value)}
    case 'date':
    case 'text': {
      return {type: 'category', target: ['variable', ['template-tag', name]], value: value}
    }
  }
}

// card dataset_query:


export const fetchCard = async (id : number, params: any) : Promise<any> => {
  const url = apiUrl(`/card/${id}/query/json`)

  const body = params.length > 0 ? 
    ('parameters=' + encodeURIComponent(JSON.stringify(params))) :
    undefined

  const resp = await fetch(url, { 
    method: 'POST',
    headers: withSession({ 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }),
    body: body
  })
  return resp.json();
}
