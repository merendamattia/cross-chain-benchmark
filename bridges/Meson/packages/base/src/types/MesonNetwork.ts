/**
 * @file MesonNetwork
 */

import { IMesonToken, IMesonTokenData, IMesonTokenDataWithPartner, MesonAddressFormat } from './MesonToken'

export interface IMesonNetworkNativeCurrency {

  symbol: string

  decimals: number

  name?: string

  icon?: string
}

export interface IMesonNetworkMetadata {
  tx_hash_siglock?: string
  tx_hash_refcell?: string
  tx_hash_joyid?: string
  tx_hash_xudt?: string
  code_hash_refcell?: string
  code_hash_xudt?: string
  pools?: (number | string)[][]
}

export interface IMesonNetworkData {

  id: string

  name: string

  alias: string

  chainId: string

  explorer?: string

  slip44: string

  shortSlip44: string

  addressFormat: MesonAddressFormat

  url: string

  mesonAddress: string

  nativeCurrency?: IMesonNetworkNativeCurrency

  extensions: string[]

  metadata?: IMesonNetworkMetadata

  tokens: IMesonTokenData[]
}

export interface IMesonNetwork<T extends IMesonToken = IMesonToken> extends Omit<IMesonNetworkData, 'tokens'> {

  readonly networkId: string

  readonly tokens: T[]

  getData(): IMesonNetworkData

  supportExtension(extensionType: string): boolean

  getMesonAddressLink(): string

  hasToken(tokenIndex: number): boolean

  getTokenByTokenIndex(tokenIndex: number): T

  getTokensByCategory(category: string): T[]

  getTokenByCategory(category: string): T | undefined

  getCoreToken(): T | undefined

  getCoreSymbol(): string | undefined
}

export interface IMesonNetworkDataWithPartner extends Omit<IMesonNetworkData, 'tokens' | 'addressFormat'> {

  disabled?: boolean

  addressFormat: string

  uctAddress?: string

  tokens: IMesonTokenDataWithPartner[]
}

export interface MesonNetworkStatus {
  networkId: string
  current?: boolean
  url: string
  healthy: boolean
  latency?: number
  error?: string
  lastBlockNumber?: string
  lastBlockTimestamp?: string
  gasPrice?: string
}
