/**
 * @file index
 */

import { BigNumber, BigNumberish } from '@ethersproject/bignumber'
import { formatUnits, parseUnits } from '@ethersproject/units'
import { keccak256 } from '@ethersproject/keccak256'
import { pack } from '@ethersproject/solidity'
import { Base58 } from '@ethersproject/basex'
import { isHexString } from '@ethersproject/bytes'

import { AddressFormat, CategoryTokenMap } from '../const'
import { MesonAddressFormat, IMesonBalance } from '../types'

function getTokenCategory (i: number) {
  if (CategoryTokenMap[i]) {
    return CategoryTokenMap[i]
  }
  return 'unsupported'
}

function getTokenType (tokenIndex: number, pod = false) {
  if (tokenIndex >= 252) {
    return 'eth'
  }

  if (tokenIndex >= 248) {
    return 'bnb'
  }

  if (tokenIndex >= 244) {
    return 'sol'
  }

  if (tokenIndex >= 240) {
    return 'btc'
  }

  if (tokenIndex >= 236) {
    return 'matic'
  }

  if (tokenIndex >= 192 && tokenIndex <= 195) {
    return 'm'
  }

  if (tokenIndex === 191) {
    return 'gas-token'
  }

  if (tokenIndex <= 64) {
    if (pod && tokenIndex <= 32 && tokenIndex > 16) {
      return 'pod'
    }
    return 'stablecoins'
  }

  if (tokenIndex <= 112) {
    // [65, 112] -> [1, 24]
    return (Math.floor((tokenIndex + 1) / 2) - 32).toString()
  }

  if (tokenIndex <= 128) {
    // [113, 128] -> [33, 48]
    return (tokenIndex - 80).toString()
  }

  return 'unknown'
}

function getIconFromToken (token: {icon?: string; tokenIndex: number}) {
  if (token.icon) {
    return token.icon
  }

  return getTokenCategory(token.tokenIndex)
}

const TOKEN_CATEGORY_TYPE_MAP = Object.entries(CategoryTokenMap).reduce<Record<string, string>>((acc, [key, value]) => {
  acc[value] = acc[value] || getTokenType(+key)
  return acc
}, {})

function getTokenTypeFromCategory (tokenCategory: string) {
  return TOKEN_CATEGORY_TYPE_MAP[tokenCategory] || 'unknown'
}

function isAddressFormat (str: string): str is MesonAddressFormat {
  return AddressFormat.includes(str as MesonAddressFormat)
}

function isCoreTokenIndex (tokenIndex: number): boolean {
  if (tokenIndex === -1) {
    return true
  }

  return (tokenIndex >= 49 && tokenIndex <= 64) || ((tokenIndex > 190) && ((tokenIndex % 4) === 3))
}

function timer (ms: number): Promise<void> {
  return new Promise(resolve => {
    const h = setTimeout(() => {
      clearTimeout(h)
      resolve()
    }, ms)
  })
}

function timeout<T> (promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    timer(ms).then(() => {
      throw new Error('Time out')
    }),
  ])
}

function fromSwapValue (value: BigNumberish) {
  return formatUnits(value || '0', 6).replace(/\.0*$/, '')
}

function toSwapValue (amount: string) {
  return parseUnits(amount || '0', 6)
}

function getSwapId (encoded: string, initiator: string) {
  const packed = pack(['bytes32', 'address'], [encoded, initiator])
  return keccak256(packed)
}

function formatBalance (raw: BigNumberish, decimals = 6): IMesonBalance {
  let value = BigNumber.from(raw)

  if (decimals > 6) {
    value = value.div(10 ** (decimals - 6))
  }

  return {
    value,
    display: fromSwapValue(value),
  }
}

function byte2hexStr (byte: number) {
  if (byte < 0 || byte > 255) {
    throw new Error('Input must be a byte')
  }

  const hexByteMap = '0123456789ABCDEF'

  let str = ''
  str += hexByteMap.charAt(byte >> 4)
  str += hexByteMap.charAt(byte & 0x0f)

  return str
}

function byteArray2hexStr (byteArray: Uint8Array) {
  let str = ''

  Array.from(byteArray).forEach(byte => {
    str += byte2hexStr(byte)
  })

  return str
}

function initiatorFromAddress (address: string) {
  if (isHexString(address)) {
    return address.toLowerCase()
  }

  return '0x' + byteArray2hexStr(Base58.decode(address)).substring(2, 42).toLowerCase()
}

export {
  getTokenType,
  getTokenCategory,
  getTokenTypeFromCategory,
  getIconFromToken,
  isAddressFormat,
  initiatorFromAddress,
  formatBalance,
  getSwapId,
  toSwapValue,
  fromSwapValue,
  isCoreTokenIndex,
  timer,
  timeout,
}

export { formatSaltHeader, parseSaltHeader } from './salt'
