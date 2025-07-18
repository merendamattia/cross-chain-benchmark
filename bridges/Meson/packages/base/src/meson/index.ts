/**
 * @file MesonPresetsManager
 */
import ERC20Abi from '../../abis/ERC20Abi.json'
import MesonAbi from '../../abis/MesonAbi.json'
import Mainnets from '../../networks/mainnets.json'

import Testnets from '../../networks/testnets.json'
import V0Mainnets from '../../networks/v0/mainnets.json'
import V0Testnets from '../../networks/v0/testnets.json'

import {
  ContractInterface,
  IMesonNetworkData,
  IMesonNetworkDataWithPartner,
  IMesonPresets,
  IMesonTokenData,
} from '../types'

import { isAddressFormat } from '../utils'
import { MesonPresets } from './MesonPresets'

export * as CONSTANTS from '../const'

export * from '../utils'

export { MesonPresets } from './MesonPresets'

export { MesonRpcs as Rpcs } from './MesonRpcs'

export { MesonRpcStatusCache as RpcStatusCache } from './MesonRpcStatusCache'

export type MesonPartnerMatcher = (partner?: string) => boolean;

export interface IMesonBaseOptions {
  useTestnet?: boolean
  v0?: boolean
  withDisabled?: boolean
  disabledChains?: string[]
  allowEmptyTokens?: boolean
  networkMatcher?: MesonPartnerMatcher
}

function matchNetworks (options: IMesonBaseOptions): IMesonNetworkData[] {
  const {
    useTestnet = false,
    disabledChains = [],
    networkMatcher = () => true,
    allowEmptyTokens = false,
    withDisabled = false,
    v0,
  } = options

  const v1Data: IMesonNetworkDataWithPartner[] = useTestnet ? Testnets : Mainnets
  const v0Data: IMesonNetworkDataWithPartner[] = useTestnet ? V0Testnets : V0Mainnets
  const data = v0 ? v0Data : v1Data

  const networks: IMesonNetworkData[] = []

  data.forEach(network => {
    const {
      id,
      disabled,
      addressFormat,
      tokens: list,
      ...extra
    } = network

    if ((disabled && !withDisabled) || !isAddressFormat(addressFormat) || disabledChains.includes(id)) {
      return
    }

    const tokens: IMesonTokenData[] = []

    list.forEach(token => {
      const {
        disabled: tokenDisabled,
        partner,
        ...tokenData
      } = token

      if ((tokenDisabled && !withDisabled) || !networkMatcher(partner)) {
        return
      }

      tokens.push(tokenData)
    })

    if (!tokens.length && !allowEmptyTokens) {
      return
    }

    networks.push({
      ...extra,
      id,
      addressFormat,
      tokens,
    })
  })

  return networks
}

export const Networks: Record<'Mainnets' | 'Testnets' | 'V0Mainnets' | 'V0Testnets', IMesonNetworkDataWithPartner[]> = {
  Mainnets,
  Testnets,
  V0Mainnets,
  V0Testnets,
}

export const ABI: Record<'Meson' | 'ERC20', ContractInterface> = {
  Meson: MesonAbi.abi,
  ERC20: ERC20Abi.abi,
}

export function useNetworks(config: IMesonBaseOptions): IMesonPresets;
export function useNetworks(networks?: IMesonNetworkData[], useTestnet?: boolean): IMesonPresets;
export function useNetworks (config: IMesonBaseOptions | IMesonNetworkData[] = [], useTestnet?: boolean): IMesonPresets {
  if (Array.isArray(config)) {
    return MesonPresets.create(config, useTestnet)
  }

  return MesonPresets.create(matchNetworks(config), config.useTestnet)
}
