import { MesonNetworkStatus } from '../types'

export class MesonRpcStatusCache {
  protected readonly cache = new Map<string, MesonNetworkStatus[]>()

  public isUrlHealthy (networkId: string, url: string): boolean {
    const rpcStatusList = this.cache.get(networkId) || []
    return Boolean(rpcStatusList.find(status => status.url === url)?.healthy)
  }

  public hasHealthyRpc (networkId: string): boolean {
    return this.getHealthyRpcStatus(networkId).length > 0
  }

  public getHealthyRpcStatus (networkId: string): MesonNetworkStatus[] {
    return (this.cache.get(networkId) || []).filter(rpc => rpc.healthy)
  }

  public getAllHealthyRpcStatus (): Record<string, MesonNetworkStatus[]> {
    const result = new Map<string, MesonNetworkStatus[]>()

    for (const networkId of this.cache.keys()) {
      result.set(networkId, this.getHealthyRpcStatus(networkId))
    }

    return Object.fromEntries(result)
  }

  protected update (networkId: string, rpcStatusList: MesonNetworkStatus[]) {
    this.cache.set(networkId, rpcStatusList)
  }
}
