/**
 * @file formatSaltHeader
 */

import { IMesonSaltHeader } from '../types'

const getKeys = Object.keys as <T>(obj: T) => (keyof T)[]

const MESONFI_SALT_HEADER_DATA: Record<Exclude<keyof IMesonSaltHeader, 'trackId'>, number> = {
  notToContract: 0x8000,
  waiveServiceFee: 0x4000,
  isMesonTo: 0x2000,
  isApi: 0x1000,
  useNonTypedSigning: 0x0800,
  amountForCoreToken: 0x0400,
  amountToShare: 0x0200,
  usePointsToWaiveServiceFee: 0x0100,
  withReward: 0x0080,
  newFormatCoreToken: 0x0010,
}

export function formatSaltHeader (data: IMesonSaltHeader): string {
  const { trackId } = data

  let salt = 0

  getKeys(MESONFI_SALT_HEADER_DATA).forEach(key => {
    if (data[key]) {
      salt |= MESONFI_SALT_HEADER_DATA[key]
    }
  })

  salt |= trackId

  return '0x' + salt.toString(16).padStart(4, '0')
}

export function parseSaltHeader (saltHeader: string): IMesonSaltHeader {
  const saltNumber = parseInt(saltHeader.slice(2, 6), 16)

  return {
    notToContract: !!(saltNumber & MESONFI_SALT_HEADER_DATA.notToContract),
    waiveServiceFee: !!(saltNumber & MESONFI_SALT_HEADER_DATA.waiveServiceFee),
    isMesonTo: !!(saltNumber & MESONFI_SALT_HEADER_DATA.isMesonTo),
    isApi: !!(saltNumber & MESONFI_SALT_HEADER_DATA.isApi),
    useNonTypedSigning: !!(saltNumber & MESONFI_SALT_HEADER_DATA.useNonTypedSigning),
    amountForCoreToken: !!(saltNumber & MESONFI_SALT_HEADER_DATA.amountForCoreToken),
    amountToShare: !!(saltNumber & MESONFI_SALT_HEADER_DATA.amountToShare),
    usePointsToWaiveServiceFee: !!(saltNumber & MESONFI_SALT_HEADER_DATA.usePointsToWaiveServiceFee),
    withReward: !!(saltNumber & MESONFI_SALT_HEADER_DATA.withReward),
    newFormatCoreToken: !!(saltNumber & MESONFI_SALT_HEADER_DATA.newFormatCoreToken),
    trackId: saltNumber & 0x000f,
  }
}
