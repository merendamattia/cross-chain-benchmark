/**
 * @file MesonPresets
 * @author Zong Yu<liuxuanzy@vip.qq.com>
 */

import {
  IMesonNetworkData,
  IMesonPresets,
} from '../types'

import { MesonNetwork } from './MesonNetwork'

export class MesonPresets<T extends MesonNetwork = MesonNetwork> implements IMesonPresets {
  public static create (networks: IMesonNetworkData[], useTestnet = false): MesonPresets {
    return new MesonPresets(networks, MesonNetwork.create, useTestnet)
  }

  protected isTestnet = false

  protected networks: T[] = []

  protected networkIdMap: Record<string, T> = {}

  protected networkShortCoinTypeMap: Record<string, T> = {}

  protected networkChainIdMap: Record<string, T> = {}

  protected constructor (networks: IMesonNetworkData[], creator: (data: IMesonNetworkData) => T, useTestnet = false) {
    this.isTestnet = useTestnet
    this.initNetworks(networks, creator)
  }

  // region Public Methods

  public get useTestnet (): boolean {
    return this.isTestnet
  }

  public getNetworks (): T[] {
    return this.networks
  }

  public hasNetwork (networkId: string): boolean {
    return Boolean(this.networkIdMap[networkId])
  }

  public hasNetworkByChain (chainId: string): boolean {
    return Boolean(this.networkChainIdMap[chainId])
  }

  public hasNetworkByShortCoinType (shortSlip44: string): boolean {
    return Boolean(this.networkShortCoinTypeMap[shortSlip44])
  }

  public getNetworkByNetworkId (networkId: string): T {
    if (!this.networkIdMap[networkId]) {
      throw new Error(`Network id = '${networkId}' not found`)
    }

    return this.networkIdMap[networkId]
  }

  public getNetworkFromShortCoinType (shortCoinType: string): T {
    if (!this.networkShortCoinTypeMap[shortCoinType]) {
      throw new Error(`Network shortCoinType = '${shortCoinType}' not found`)
    }

    return this.networkShortCoinTypeMap[shortCoinType]
  }

  public getNetworkFromChainId (chainId: string): T {
    if (!this.networkChainIdMap[chainId]) {
      throw new Error(`Network chainId = '${chainId}' not found`)
    }

    return this.networkChainIdMap[chainId]
  }

  // endregion

  protected initNetworks (data: IMesonNetworkData[], creator: (data: IMesonNetworkData) => T) {
    this.networks = []
    this.networkIdMap = {}
    this.networkShortCoinTypeMap = {}
    this.networkChainIdMap = {}

    data.forEach(config => {
      const network = creator(config)

      this.networkIdMap[network.networkId] = network
      this.networkShortCoinTypeMap[network.shortSlip44] = network
      this.networkChainIdMap[network.chainId] = network
      this.networks.push(network)
    })
  }
}
