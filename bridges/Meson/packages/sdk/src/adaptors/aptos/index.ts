import { BigNumber, BigNumberish, utils } from 'ethers'
import { Account as AptosAccount, Ed25519PrivateKey } from '@aptos-labs/ts-sdk'
import memoize from 'lodash/memoize'

import { meson } from '@mesonfi/base'
import { Swap } from '../../Swap'
import AptosAdaptor from './AptosAdaptor'
import AptosWallet, { AptosExtWallet } from './AptosWallet'

export function getWallet(privateKey: string = '', adaptor: AptosAdaptor, Wallet = AptosWallet): AptosWallet {
  if (privateKey && !privateKey.startsWith('0x')) {
    privateKey = '0x' + privateKey
  }
  const key = new Ed25519PrivateKey(privateKey)
  const signer = AptosAccount.fromPrivateKey({ privateKey: key })
  return new Wallet(adaptor, signer)
}

export function getWalletFromExtension(ext, adaptor: AptosAdaptor): AptosExtWallet {
  return new AptosExtWallet(adaptor, ext)
}

export function getContract(address: string, abi, adaptor: AptosAdaptor) {
  const memoizedGetStoreAddress = memoize(async () => {
    const payload = {
      function: `${address}::MesonStates::get_store_address` as `${string}::${string}::${string}`,
      typeArguments: [],
      functionArguments: [],
    }
    const result = await adaptor.client.view({ payload })
    return result[0] as string
  })

  const memoizedGetGeneralStore = memoize(async () => {
    const storeAddress = await memoizedGetStoreAddress()
    return await memoizedGetResource(storeAddress, `${address}::MesonStates::GeneralStore`) as any
  })

  const getResource = async (accountAddress: string, resourceType: `${string}::${string}::${string}`) => {
    try {
      return await adaptor.client.getAccountResource({ accountAddress, resourceType })
    } catch (e) {
      if (e.errors) {
        e = e.errors[0]
      }
      if (e.data?.error_code === 'resource_not_found') {
        return
      }
      throw e
    }
  }
  const memoizedGetResource = memoize(getResource, (addr: string, type: string) => `${addr}|${type}`)

  const readTable = async (handle: string, data: { key_type: string, value_type: string, key: any }) => {
    try {
      return await adaptor.client.getTableItem({ handle, data })
    } catch (e) {
      if (e.errors) {
        e = e.errors[0]
      }
      if (e.data?.error_code === 'table_item_not_found') {
        return
      }
      throw e
    }
  }

  const getSupportedTokens = memoize(async () => {
    const generalStore = await memoizedGetGeneralStore()
    const indexes: number[] = []
    const tokens: string[] = []
    for (const i of [1, 2]) {
      const result = await readTable(generalStore.supported_assets.handle, {
        key_type: 'u8',
        value_type: '0x1::object::Object<0x1::fungible_asset::Metadata>',
        key: i
      }) as any
      if (!result) {
        continue
      }
      indexes.push(i)
      tokens.push(formatAddress(result.inner))
    }
    return { tokens, indexes }
  })

  const getTokenIndex = async (tokenAddr: string) => {
    const { tokens, indexes } = await getSupportedTokens()
    const i = tokens.findIndex(addr => addr === tokenAddr)
    if (i === -1) {
      throw new Error(`Token ${tokenAddr} not found.`)
    }
    return indexes[i]
  }

  const getTokenAddr = async (tokenIndex: number) => {
    const { tokens, indexes } = await getSupportedTokens()
    const i = indexes.findIndex(i => i === tokenIndex)
    if (i === -1) {
      throw new Error(`Token index ${tokenIndex} not found.`)
    }
    return tokens[i]
  }

  // TODO: What if owner of pool is transferred?
  const ownerOfPool = async (poolIndex: BigNumberish) => {
    const generalStore = await memoizedGetGeneralStore()
    return await readTable(generalStore.pool_owners.handle, {
      key_type: 'u64',
      value_type: 'address',
      key: BigNumber.from(poolIndex).toString()
    })
  }

  const poolOfAuthorizedAddr = async (addr: string) => {
    const generalStore = await memoizedGetGeneralStore()
    return +await readTable(generalStore.pool_of_authorized_addr.handle, {
      key_type: 'address',
      value_type: 'u64',
      key: addr
    }) || 0
  }

  return new Proxy({}, {
    get(target, prop: string) {
      if (prop === 'address') {
        return address
      } else if (prop === 'provider') {
        return adaptor
      } else if (prop === 'signer') {
        if (adaptor instanceof AptosWallet) {
          return adaptor
        }
        throw new Error(`AptosContract doesn't have a signer.`)
      } else if (prop === 'interface') {
        return {
          format: () => abi,
          parseTransaction: tx => {
            const payload = JSON.parse(tx.data)
            if (payload.type !== 'entry_function_payload') {
              throw new Error(`Payload type ${payload.type} unsupported`)
            }
            const { function: fun, arguments: rawArgs } = payload
            const name = fun.split('::')[2]
            const args: any = { encodedSwap: rawArgs[0].replace('0x20', '0x') }
            switch (name) {
              case 'postSwapFromInitiator': {
                const poolIndex = rawArgs[2].startsWith('0x')
                  ? new DataView(utils.arrayify(rawArgs[2]).buffer).getBigUint64(0, true).toString()
                  : rawArgs[2]
                let initiator = rawArgs[1]
                if (initiator.length === 44) {
                  initiator = initiator.replace('0x14', '0x')
                }
                args.postingValue = BigNumber.from(utils.solidityPack(['address', 'uint40'], [initiator, poolIndex]))
                if (payload.contractAddress) {
                  args.contractAddress = payload.contractAddress
                }
                break
              }
              case 'bondSwap':
              case 'simpleExecuteSwap':
              case 'cancelSwap':
                break
              case 'lockSwap':
              case 'unlock':
                args.initiator = rawArgs[1]
                if (args.initiator.length === 44) {
                  args.initiator = args.initiator.replace('0x14', '0x')
                }
                break
              case 'executeSwap':
                args.recipient = rawArgs[2]
                if (args.recipient.length === 44) {
                  args.recipient = args.recipient.replace('0x14', '0x')
                }
                break
              case 'release':
                args.initiator = rawArgs[2]
                if (args.initiator.length === 44) {
                  args.initiator = args.initiator.replace('0x14', '0x')
                }
                break
              case 'directRelease':
                args.initiator = rawArgs[2]
                args.recipient = rawArgs[3]
                break
            }
            if (['executeSwap', 'release', 'directRelease'].includes(name)) {
              let signature = rawArgs[1]
              if (signature.length === 132) {
                signature = signature.replace('0x40', '0x')
              }
              const { r, yParityAndS } = utils.splitSignature(signature)
              args.r = r
              args.yParityAndS = yParityAndS
            }
            return { name, args }
          }
        }
      } else if (['queryFilter', 'on', 'removeAllListeners'].includes(prop)) {
        return () => {}
      } else if (prop === 'connect') {
        return (wallet: AptosWallet) => getContract(address, abi, wallet)
      } else if (prop === 'filters') {
        throw new Error('AptosContract.filters not implemented')
      } else if (prop === 'pendingTokenBalance') {
        return async tokenIndex => {
          const tokenAddr = await getTokenAddr(tokenIndex)
          const storeAddress = await memoizedGetStoreAddress()
          const payload = {
            function: '0x1::primary_fungible_store::balance' as `${string}::${string}::${string}`,
            typeArguments: ['0x1::fungible_asset::Metadata'],
            functionArguments: [storeAddress, tokenAddr],
          }
          const data = await adaptor.client.view({ payload })
          return BigNumber.from(data?.[0] || 0)
        }
      }

      let method = abi.find(item => item.name === prop)
      if (method?.type === 'function') {
        if (['view', 'pure'].includes(method.stateMutability)) {
          return async (...args) => {
            let options
            if (args.length > method.inputs.length) {
              options = args.pop()
            }

            // ERC20 like
            if (['name', 'symbol', 'decimals'].includes(prop)) {
              const metadata = await getResource(address, `0x1::fungible_asset::Metadata`)
              return metadata[prop]
            } else if (prop === 'balanceOf') {
              const payload = {
                function: '0x1::primary_fungible_store::balance' as `${string}::${string}::${string}`,
                typeArguments: ['0x1::fungible_asset::Metadata'],
                functionArguments: [args[0], address],
              }
              const data = await adaptor.client.view({ payload })
              return BigNumber.from(data?.[0] || 0)
            } else if (prop === 'allowance') {
              return BigNumber.from(2).pow(128).sub(1)
            }

            // Meson
            if (prop === 'getShortCoinType') {
              return '0xf27d'
            } else if (prop === 'getSupportedTokens') {
              return await getSupportedTokens()
            } else if (prop === 'ownerOfPool') {
              return formatAddress(await ownerOfPool(args[0]) as string)
            } else if (prop === 'poolOfAuthorizedAddr') {
              return await poolOfAuthorizedAddr(args[0])
            } else if (prop === 'poolTokenBalance') {
              const [tokenAddr, poolOwner] = args
              const poolIndex = await poolOfAuthorizedAddr(poolOwner)
              if (!poolIndex) {
                return BigNumber.from(0)
              }
              const poolTokenIndex = utils.solidityPack(['uint8', 'uint40'], [await getTokenIndex(tokenAddr), poolIndex])
              const generalStore = await memoizedGetGeneralStore()
              const result = await readTable(generalStore.balance_of_pool.handle, {
                key_type: 'u64',
                value_type: 'u64',
                key: BigNumber.from(poolTokenIndex).toString()
              })
              return BigNumber.from(result || 0)
            } else if (prop === 'serviceFeeCollected') {
              const [tokenIndex] = args
              const poolTokenIndex = utils.solidityPack(['uint8', 'uint40'], [tokenIndex, 0])
              const generalStore = await memoizedGetGeneralStore()
              const result = await readTable(generalStore.in_pool_coins.handle, {
                key_type: 'u64',
                value_type: 'u64',
                key: BigNumber.from(poolTokenIndex).toString()
              })
              return BigNumber.from(result || 0)
            } else if (prop === 'getPostedSwap') {
              const generalStore = await memoizedGetGeneralStore()
              const result = await readTable(generalStore.posted_swaps.handle, {
                key_type: 'vector<u8>',
                value_type: `${address}::MesonStates::PostedSwap`,
                key: `${Swap.decode(args[0]).encoded}ff`
              }) as any
              if (!result) {
                return { exist: false }
              }
              const pending = result.from_address !== '0x0'
              return {
                initiator: pending ? result.initiator : undefined,
                poolOwner: pending ? await ownerOfPool(result.pool_index) : undefined,
                exist: true
              }
            } else if (prop === 'getLockedSwap') {
              const generalStore = await memoizedGetGeneralStore()
              const result = await readTable(generalStore.locked_swaps.handle, {
                key_type: 'vector<u8>',
                value_type: `${address}::MesonStates::LockedSwap`,
                key: meson.getSwapId(Swap.decode(args[0]).encoded, args[1])
              }) as any
              if (!result) {
                return { until: 0 } // never locked
              } else if (!Number(result.until)) {
                return { until: 0, poolOwner: '0x1' } // locked & released
              }
              return {
                until: Number(result.until),
                poolOwner: await ownerOfPool(result.pool_index)
              }
            }

            throw new Error(`AptosContract read not implemented (${prop})`)
          }
        } else {
          return async (...args) => {
            let options
            if (args.length > method.inputs.length) {
              options = args.pop()
            }

            const module = _findMesonMethodModule(prop)
            const payload = {
              function: `${address}::${module}::${prop}`,
              type_arguments: [],
              arguments: []
            }

            if (prop === 'transfer') {
              const [to, amount] = args
              payload.function = '0x1::primary_fungible_store::transfer'
              payload.type_arguments = ['0x1::fungible_asset::Metadata']
              payload.arguments = [address, to, BigNumber.from(amount).toString()]
            } else if (prop === 'addSupportToken') {
              const [tokenAddr, tokenIndex] = args
              payload.arguments = [tokenIndex, tokenAddr]
            } else if (prop === 'removeSupportToken') {
              const [tokenIndex] = args
              payload.arguments = [tokenIndex]
            } else if (['depositAndRegister', 'deposit', 'withdraw'].includes(prop)) {
              const poolTokenIndex = BigNumber.from(args[1])
              const tokenIndex = poolTokenIndex.div(2 ** 40).toNumber()
              const poolIndex = poolTokenIndex.mod(BigNumber.from(2).pow(40)).toHexString()
              payload.arguments = [BigNumber.from(args[0]).toHexString(), poolIndex, tokenIndex]
            } else if (['addAuthorizedAddr', 'removeAuthorizedAddr', 'transferPoolOwner'].includes(prop)) {
              payload.arguments = [args[0]]
            } else if (prop === 'withdrawServiceFee') {
              const [tokenIndex, amount, toPoolIndex] = args
              payload.arguments = [BigNumber.from(amount).toHexString(), toPoolIndex, tokenIndex]
            } else {
              const swap = Swap.decode(args[0])
              if (prop === 'postSwapFromInitiator') {
                const [_, postingValue] = args
                payload.arguments = [
                  _vectorize(swap.encoded),
                  _vectorize(postingValue.substring(0, 42)), // initiator
                  `0x${postingValue.substring(42)}` // pool_index
                ]
              } else if (prop === 'bondSwap') {
                payload.arguments = [_vectorize(swap.encoded), args[1].toString()]
              } else if (prop === 'cancelSwap') {
                payload.arguments = [_vectorize(swap.encoded)]
              } else if (prop === 'executeSwap') {
                const [_, r, yParityAndS, recipient, depositToPool] = args
                payload.arguments = [
                  _vectorize(swap.encoded),
                  _getCompactSignature(r, yParityAndS),
                  _vectorize(recipient.substring(0, 42)),
                  depositToPool
                ]
              } else if (prop === 'simpleExecuteSwap') {
                payload.arguments = [_vectorize(swap.encoded)]
              } else if (prop === 'lockSwap') {
                const [_, { initiator, recipient }] = args
                payload.arguments = [
                  _vectorize(swap.encoded),
                  _vectorize(initiator),
                  recipient
                ]
              } else if (prop === 'unlock') {
                const [_, initiator] = args
                payload.arguments = [
                  _vectorize(swap.encoded),
                  _vectorize(initiator)
                ]
              } else if (prop === 'release') {
                const [_, r, yParityAndS, initiator] = args
                payload.arguments = [
                  _vectorize(swap.encoded),
                  _getCompactSignature(r, yParityAndS),
                  _vectorize(initiator)
                ]
              } else if (prop === 'directRelease') {
                const [_, r, yParityAndS, initiator, recipient] = args
                payload.arguments = [
                  _vectorize(swap.encoded),
                  _getCompactSignature(r, yParityAndS),
                  _vectorize(initiator),
                  recipient
                ]
              }
            }

            return await (adaptor as AptosWallet).sendTransaction(payload, options)
          }
        }
      }
      return target[prop]
    }
  })
}

function _findMesonMethodModule(method) {
  const moduleMethods = {
    MesonStates: ['addSupportToken', 'removeSupportToken'],
    MesonPools: [
      'depositAndRegister',
      'deposit',
      'withdraw',
      'addAuthorizedAddr',
      'removeAuthorizedAddr',
      'transferPoolOwner',
      'withdrawServiceFee',
      'lockSwap',
      'unlock',
      'release',
      'directRelease',
    ],
    MesonSwap: [
      'postSwapFromInitiator',
      'bondSwap',
      'cancelSwap',
      'executeSwap',
      'simpleExecuteSwap'
    ],
  }

  for (const module of Object.keys(moduleMethods)) {
    if (moduleMethods[module].includes(method)) {
      return module
    }
  }
}

function _vectorize(hex: string) {
  return Array.from(utils.arrayify(hex))
}

function _getCompactSignature(r: string, yParityAndS: string) {
  return _vectorize(r + yParityAndS.replace(/^0x/, ''))
}

export function formatAddress(addr: string) {
  const parts = addr.split('::')
  if (!parts[0].startsWith('0x')) {
    parts[0] = '0x' + parts[0]
  }
  parts[0] = utils.hexZeroPad(parts[0], 32)
  return parts.join('::')
}
