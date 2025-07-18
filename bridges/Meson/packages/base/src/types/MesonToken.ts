/**
 * @file MesonToken
 */

import type { AddressFormat } from '../const'

export type MesonAddressFormat = (typeof AddressFormat)[number];

export interface IMesonTokenData {

  tokenIndex: number

  symbol: string

  name: string

  icon?: string

  addr: string

  decimals: number

  link?: string
}

export interface IMesonToken extends IMesonTokenData {

  readonly type: string
  readonly category: string
  readonly isCoreToken: boolean

  getTokenLink(): string

  getAddressLink(): string
}

export interface IMesonTokenDataWithPartner extends IMesonTokenData {

  disabled?: boolean

  partner?: string
}
