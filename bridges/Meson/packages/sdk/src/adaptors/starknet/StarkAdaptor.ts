import { BigNumber, type providers } from 'ethers'
import {
  type RpcProvider as StarkProvider,
  Contract as StarkContract,
} from 'starknet'
import * as RPCSPEC07 from 'starknet-types-07'

import { meson } from '@mesonfi/base'
import type { IAdaptor, WrappedTransaction } from '../types'

import AbiERC20 from './abi/ERC20.json'
import parseCalldata from './parse'

const ETH_ADDRESS = '0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7'
const STRK_ADDRESS = '0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d'

export default class StarkAdaptor implements IAdaptor {
  #client: StarkProvider | any

  protected readonly _coreToken: StarkContract

  constructor(client: StarkProvider) {
    this.#client = client
    this._coreToken = new StarkContract(AbiERC20, STRK_ADDRESS, client)
  }

  get client() {
    return this.#client
  }

  protected set client(c) {
    this.#client = c
  }

  get nodeUrl() {
    return this.#client.channel.nodeUrl
  }

  async detectNetwork(): Promise<any> {
    return await this.client.getChainId()
  }

  async getBlockNumber() {
    const result = await this.client.getBlockLatestAccepted()
    return result.block_number
  }

  async getGasPrice() {
    return BigNumber.from(0)
  }

  async getTransactionCount(addr: string) {
    return await this.client.getNonceForAddress(addr)
  }

  async getBalance(addr: string) {
    const balance = await this._coreToken.balance_of(addr)
    return BigNumber.from(balance)
  }

  async getCode(addr: string): Promise<string> {
    // TODO
    return ''
  }

  async getLogs(filter: providers.Filter) {
    const eventFilter: RPCSPEC07.EventFilter = {
      from_block: { block_number: Number(filter.fromBlock) },
      to_block: { block_number: Number(filter.toBlock) },
      address: filter.address,
      chunk_size: 100, // TODO
    }
    const result = await this.client.getEvents(eventFilter)
    return result.events.map(raw => _wrapStarknetEvent(raw)).reverse()
  }

  on () {}
  removeAllListeners () {}

  async send(method, params) {
    if (method === 'eth_getTransactionByHash') {
      return _wrapStarknetTx(await this.client.getTransactionByHash(params[0]))
    } else if (method === 'eth_getTransactionReceipt') {
      return _wrapStarknetReceipt(await this.client.getTransactionReceipt(params[0]))
    }

    if (method === 'eth_getBlockByNumber' || method === 'eth_getBlockByHash') {
      if (params[0] === 'n/a') {
        return {}
      }
      if (params[1]) {
        return _wrapStarknetBlock(await this.client.getBlockWithTxs(params[0]))
      } else {
        return _wrapStarknetBlock(await this.client.getBlockWithTxHashes(params[0]))
      }
    }
  }

  async waitForTransaction(hash: string, confirmations?: number, timeout?: number) {
    return new Promise<WrappedTransaction>((resolve, reject) => {
      const tryGetTransaction = async () => {
        try {
          const receipt = await this.client.getTransactionReceipt(hash)
          if (receipt.finality_status) {
            clearInterval(h)
            resolve(_wrapStarknetReceipt(receipt))
          }
        } catch {}
      }
      const h = setInterval(tryGetTransaction, 5000)
      tryGetTransaction()

      if (timeout) {
        meson.timer(timeout * 1000).then(() => {
          clearInterval(h)
          reject(new Error('Time out'))
        })
      }
    })
  }
}

function _wrapStarknetEvent(raw) {
  console.log(raw)
  return raw
}

function _wrapStarknetBlock(raw: RPCSPEC07.BlockWithTxs | RPCSPEC07.BlockWithTxHashes) {
  if (!('block_hash' in raw)) {
    return
  }
  return {
    hash: raw.block_hash,
    parentHash: raw.parent_hash,
    number: raw.block_number,
    timestamp: raw.timestamp,
    transactions: raw.transactions.map(tx => _wrapStarknetTx(tx)).filter(Boolean)
  }
}

function _wrapStarknetTx(raw: RPCSPEC07.TransactionWithHash) {
  if (!raw?.transaction_hash) {
    return
  }
  const { transaction_hash, type, version } = raw
  if (type !== 'INVOKE') {
    return
  }
  if (version !== '0x1' && version !== '0x3') {
    return
  }
  const { sender_address, calldata } = raw
  const parsed = parseCalldata(calldata)
  return {
    blockHash: 'n/a',
    hash: transaction_hash,
    from: sender_address,
    to: parsed[0].to,
    value: '0',
    input: parsed,
  }
}

function _wrapStarknetReceipt(raw: RPCSPEC07.TransactionReceipt) {
  const {
    transaction_hash,
    actual_fee,
    execution_status,
    finality_status,
  } = raw
  if (!finality_status) {
    return
  }
  return {
    blockHash: raw['block_hash'],
    blockNumber: raw['block_number'],
    hash: transaction_hash,
    status: execution_status === 'SUCCEEDED' ? '0x1' : '0x0',
  }
}
