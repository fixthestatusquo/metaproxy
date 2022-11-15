import {request, httpLink} from '@proca/api'

import * as proca from './proca'


export type UserData = {orgIds: number[], orgNames: string[]}

export const fetchUser = async (auth : string) => {
  const api = httpLink('https://api.proca.app', {authorization: auth})

  const result = await request<proca.UserOrgs, proca.UserOrgsVariables>(api, proca.UserOrgsDocument, {})

  const r = {orgIds: [], orgNames: []}

  if (result.error) {
    return r
  }

  for (const role of result.data.currentUser.roles) {
      if (role.org.__typename === 'PrivateOrg') {
        r.orgIds.push(role.org.id)
        r.orgNames.push(role.org.name)
      }
  }
  return r
}



export const allowParams = (user : UserData | undefined, params : Record<string, any>) : boolean => {
  if ('org_id' in params) {
    if (!user) return false
    console.log(parseInt(params['org_id']))
    console.log(user.orgIds)
    const org_id = parseInt(params['org_id'])
    if (user.orgIds.indexOf(org_id) < 0) {
      return false
    }
  }

  if ('org' in params) {
    if (!user) return false
    if (user.orgNames.indexOf(params['org']) < 0) {
      return false
    }
  }

  return true
}
