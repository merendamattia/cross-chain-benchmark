/**
 * @file MesonNetwork
 */

import {
  IMesonNetwork,
  IMesonNetworkData,
  IMesonNetworkNativeCurrency,
  MesonAddressFormat,
  IMesonTokenData,
} from '../types'

import { MesonToken } from './MesonToken'

export class MesonNetwork<T extends MesonToken = MesonToken> implements IMesonNetwork {
  public static create (data: IMesonNetworkData): MesonNetwork {
    return new MesonNetwork(data, MesonToken.create)
  }

  public readonly tokens: T[] = []

  protected readonly data: IMesonNetworkData

  protected readonly tokenMap: Record<string, T> = {}

  protected constructor (data: IMesonNetworkData, creator: (network: IMesonNetwork, data: IMesonTokenData) => T) {
    this.data = data
    this.initTokens(creator)
  }

  public get id () {
    return this.data.id
  }

  public get networkId () {
    return this.data.id
  }

  public get name () {
    return this.data.name
  }

  public get alias () {
    return this.data.alias
  }

  public get chainId () {
    return this.data.chainId
  }

  public get slip44 () {
    return this.data.slip44
  }

  public get shortSlip44 () {
    return this.data.shortSlip44
  }

  public get addressFormat (): MesonAddressFormat {
    return this.data.addressFormat
  }

  public get url () {
    return this.data.url
  }

  public get mesonAddress () {
    return this.data.mesonAddress
  }

  public get explorer () {
    return this.data.explorer
  }

  public get nativeCurrency (): IMesonNetworkNativeCurrency | undefined {
    return this.data.nativeCurrency
  }

  public get metadata () {
    return this.data.metadata
  }

  public get extensions () {
    return this.data.extensions
  }

  public getData () {
    return this.data
  }

  public supportExtension (extensionType: string) {
    return this.extensions.includes(extensionType)
  }

  public getMesonAddressLink () {
    return `${this.explorer}/address/${this.mesonAddress}`
  }

  public hasToken (tokenIndex: number): boolean {
    return this.tokens.some(t => t.tokenIndex === tokenIndex)
  }

  public getTokenByTokenIndex (tokenIndex: number): T {
    return this.tokenMap[tokenIndex]
  }

  public getTokensByCategory (category: string): T[] {
    return this.tokens.filter(t => t.category === category.toLowerCase())
  }

  public getTokenByCategory (category: string): T | undefined {
    return this.getTokensByCategory(category)[0]
  }

  public getCoreToken (): T | undefined {
    return this.tokens.find(t => t.isCoreToken)
  }

  public getCoreSymbol (): string | undefined {
    return this.getCoreToken()?.symbol
  }

  protected initTokens (creator: (network: MesonNetwork, data: IMesonTokenData) => T) {
    this.data.tokens.forEach(tokenData => {
      const token = creator(this, tokenData)
      this.tokenMap[token.tokenIndex] = token
      this.tokens.push(token)
    })
  }
}
