/**
 * @file MesonBalance
 */
import { MesonNetworkStatus } from './MesonNetwork'

export interface IMesonRpcs {

  isUrlHealthy(networkId: string, url: string): boolean

  hasHealthyRpc(networkId: string): boolean

  getHealthyRpcStatus(networkId: string): MesonNetworkStatus[]

  getAllHealthyRpcStatus(): Record<string, MesonNetworkStatus[]>

  refreshAllRpcStatus(): Promise<void>

  fetchRpcs(): Promise<Record<string, MesonNetworkStatus[]>>
}
