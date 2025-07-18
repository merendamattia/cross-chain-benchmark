import { BigNumber, utils } from 'ethers'
import { Aptos as AptosClient } from '@aptos-labs/ts-sdk'

import { IAdaptor } from '../types'

// ad hoc
const mesonAddress = '0x521ac831177db52270301c7e4f068f8ee4231e47ba571fab86de718dc181f4cf'

export default class AptosAdaptor implements IAdaptor {
  #client: AptosClient

  constructor(client: AptosClient) {
    this.#client = client
  }

  get client() {
    return this.#client
  }

  protected set client(c) {
    this.#client = c
  }

  get nodeUrl() {
    return this.client.config.fullnode
  }

  async detectNetwork(): Promise<any> {
    return await this.client.getLedgerInfo()
  }

  async getBlockNumber() {
    const info = await this.detectNetwork()
    return Number(info.block_height)
  }

  async getGasPrice() {
    return BigNumber.from(0)
  }

  async getTransactionCount(addr: string) {
  }

  async getBalance(addr) {
    const type = `0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>`
    try {
      const result = await this.client.getAccountResource({ accountAddress: addr, resourceType: type })
      return BigNumber.from(result.coin.value)
    } catch (e) {
      if (e.errors) {
        e = e.errors[0]
      }
      if (e.data?.error_code === 'resource_not_found') {
        return BigNumber.from(0)
      }
      throw e
    }
  }

  async getCode(addr: string): Promise<string> {
    // TODO
    return ''
  }

  async getLogs(filter) {
    const list1 = await this.client.getAccountEventsByEventType({
      accountAddress: '0x0',
      eventType: `${filter.address}::MesonSwap::SwapExecuted`,
      options: { limit: 20, orderBy: [{ transaction_block_height: 'desc' }] }
    })
    const list2 = await this.client.getAccountEventsByEventType({
      accountAddress: '0x0',
      eventType: `${filter.address}::MesonSwap::SwapPosted`,
      options: { limit: 20, orderBy: [{ transaction_block_height: 'desc' }] }
    })
    return [...list1, ...list2]
      .map(raw => _wrapAptosEvent(raw, filter.address))
      .sort((e1, e2) => e2.blockNumber - e1.blockNumber)
  }

  on () {}
  removeAllListeners () {}

  async send(method, params) {
    if (method === 'eth_getBlockByNumber') {
      if (params[0] === 'latest') {
        const number = await this.getBlockNumber()
        const block = await this.client.getBlockByHeight({ blockHeight: number, options: { withTransactions: false } })
        return _wrapAptosBlock(block)
      } else {
        const number = parseInt(params[0])
        const block = await this.client.getBlockByHeight({ blockHeight: number, options: { withTransactions: params[1] } })
        return _wrapAptosBlock(block)
      }
    } else if (method === 'eth_getBlockByHash') {
      if (params[0] === 'n/a') {
        return {}
      }
      const number = parseInt(params[0])
      const block = await this.client.getBlockByHeight({ blockHeight: number, options: { withTransactions: params[1] } })
      return _wrapAptosBlock(block)
    } else if (method === 'eth_getTransactionByHash') {
      if (params[0].startsWith('0x')) {
        return _wrapAptosTx(await this.client.getTransactionByHash({ transactionHash: params[0] }))
      }
      return _wrapAptosTx(await this.client.getTransactionByVersion({ ledgerVersion: params[0] }))
    } else if (method === 'eth_getTransactionReceipt') {
      if (params[0].startsWith('0x')) {
        return _wrapAptosTx(await this.client.getTransactionByHash({ transactionHash: params[0] }))
      }
      return _wrapAptosTx(await this.client.getTransactionByVersion({ ledgerVersion: params[0] }))
    }
  }

  async waitForTransaction(hash: string, confirmations?: number, timeout?: number) {
    const result = await this.client.waitForTransaction({
      transactionHash: hash,
      options: {
        checkSuccess: !!confirmations,
        timeoutSecs: timeout || 20
      }
    })
    return _wrapAptosTx(result)
  }
}

function _wrapAptosEvent(raw, address) {
  const { transaction_block_height, transaction_version } = raw
  return {
    blockNumber: transaction_block_height,
    address,
    transactionHash: transaction_version.toString(),
  }
}

function _wrapAptosBlock(raw) {
  return {
    hash: '0x' + Number(raw.block_height).toString(16),
    parentHash: '0x' + Number(raw.block_height - 1).toString(16),
    number: raw.block_height,
    timestamp: Math.floor(raw.block_timestamp / 1000000).toString(),
    transactions: raw.transactions?.filter(tx => tx.type === 'user_transaction').map(_wrapAptosTx) || []
  }
}

function _wrapAptosTx(raw) {
  let to = raw.payload?.function?.split('::')?.[0] || '0x'
  let payload = raw.payload

  // ad hoc for okx
  if (raw.payload?.function === '0xdd6dba734fc12f45618be09d9456dbe101698fd2eca68bb2e4e64172a122b64f::meson_adapter::xbridge_meson') {
    payload = {
      type: 'entry_function_payload',
      function: `${mesonAddress}::MesonSwap::postSwapFromInitiator`,
      arguments: [
        payload.arguments[7],
        payload.arguments[8],
        '1', // payload.arguments[9],
      ],
      contractAddress: to,
    }
    to = mesonAddress
  }

  return {
    blockHash: 'n/a',
    blockNumber: '',
    hash: utils.hexZeroPad(raw.hash, 32),
    from: utils.hexZeroPad(raw.sender, 32),
    to: utils.hexZeroPad(to, 32),
    value: '0',
    input: JSON.stringify(payload),
    timestamp: Math.floor(raw.timestamp / 1000000).toString(),
    status: raw.success ? '0x1' : '0x0'
  }
}
