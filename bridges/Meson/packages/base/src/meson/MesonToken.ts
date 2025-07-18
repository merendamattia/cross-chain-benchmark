/**
 * @file MesonToken
 */

import { ADDRESS_ONE } from '../const'
import { IMesonNetwork, IMesonToken, IMesonTokenData } from '../types'
import { getTokenCategory, getTokenType } from '../utils'

export class MesonToken<T extends IMesonNetwork = IMesonNetwork> implements IMesonToken {
  public static create (network: IMesonNetwork, data: IMesonTokenData): MesonToken {
    return new MesonToken(network, data)
  }

  protected readonly network: T

  protected readonly data: IMesonTokenData

  protected constructor (network: T, data: IMesonTokenData) {
    this.data = data
    this.network = network
  }

  public get tokenIndex (): number {
    return this.data.tokenIndex
  }

  public get symbol (): string {
    return this.data.symbol
  }

  public get name (): string {
    return this.data.name
  }

  public get icon (): string {
    if (this.data.icon) {
      return this.data.icon
    }

    if (this.tokenIndex === 191) {
      return this.network.networkId
    }

    return this.category
  }

  public get addr (): string {
    return this.data.addr
  }

  public get decimals (): number {
    return this.data.decimals
  }

  public get link (): string | undefined {
    return this.data.link
  }

  public get type (): string {
    return getTokenType(this.tokenIndex)
  }

  public get category (): string {
    if (this.tokenIndex === 191) {
      return `core-token-${this.network.networkId}`
    }

    return getTokenCategory(this.tokenIndex)
  }

  public get isCoreToken (): boolean {
    return this.addr === ADDRESS_ONE
  }

  public getTokenLink () {
    if (this.isCoreToken) {
      return `${this.network.explorer}`
    }

    if (this.link) {
      return `${this.network.explorer}/${this.link}`
    }

    return `${this.network.explorer}/token/${this.addr}`
  }

  public getAddressLink () {
    return `${this.network.explorer}/address/${this.addr}`
  }
}
