import fetch from 'cross-fetch'

import { IMesonRpcs, MesonNetworkStatus } from '../types'
import { MesonRpcStatusCache } from './MesonRpcStatusCache'

export class MesonRpcs extends MesonRpcStatusCache implements IMesonRpcs {
  private readonly rpcManagerURL: string

  constructor (rpcManagerURL: string) {
    super()
    this.rpcManagerURL = rpcManagerURL
  }

  public async refreshAllRpcStatus () {
    try {
      const rpcStatusObject = await this.fetchRpcs()
      for (const [networkId, data] of Object.entries(rpcStatusObject)) {
        this.update(networkId, data)
      }
    } catch (err) {
      console.error(err)
    }
  }

  public async fetchRpcs (): Promise<Record<string, MesonNetworkStatus[]>> {
    const response = await fetch(this.rpcManagerURL)

    const body: {
      success: boolean
      data: Record<string, MesonNetworkStatus[]>
      error: string
    } = await response.json()

    if (!body.success) {
      throw new Error('failed to fetch rpcs ' + body.error)
    }

    return body.data
  }
}
