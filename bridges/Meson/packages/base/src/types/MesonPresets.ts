/**
 * @file MesonConfig
 */

import { IMesonNetwork } from './MesonNetwork'

export interface IMesonPresets<T extends IMesonNetwork = IMesonNetwork> {

  readonly useTestnet: boolean

  getNetworks(): T[]

  hasNetwork(networkId: string): boolean

  hasNetworkByChain(chainId: string): boolean

  hasNetworkByShortCoinType(shortSlip44: string): boolean

  getNetworkByNetworkId(networkId: string): T

  getNetworkFromShortCoinType(shortCoinType: string): T

  getNetworkFromChainId(chainId: string): T
}
