import { utils } from 'ethers'
import { type SuiTransactionBlockResponseOptions } from '@mysten/sui/client'
import { Ed25519Keypair as SuiKeypair } from '@mysten/sui/keypairs/ed25519'
import { Transaction as SuiTransaction } from '@mysten/sui/transactions'

import SuiAdaptor from './SuiAdaptor'

export default class SuiWallet extends SuiAdaptor {
  readonly keypair: SuiKeypair

  constructor(adaptor: SuiAdaptor, keypair?: SuiKeypair) {
    super(adaptor.client)
    this.keypair = keypair
  }

  get address() {
    return this.keypair.getPublicKey().toSuiAddress()
  }

  async transfer({ to, value }, options?: SuiTransactionBlockResponseOptions) {
    const transaction = new SuiTransaction()
    const [coin] = transaction.splitCoins(transaction.gas, [value])
    transaction.transferObjects([coin], to)
    const result = await this.client.signAndExecuteTransaction({ signer: this.keypair, transaction, options })
    return {
      hash: result.digest,
      wait: () => this._wrapSuiTx(result)
    }
  }

  async signMessage (msg: string) {
    const { signature } = await this.keypair.signPersonalMessage(utils.toUtf8Bytes(msg))
    return signature
  }

  async sendTransaction(transaction: SuiTransaction, options?: SuiTransactionBlockResponseOptions) {
    if (!(transaction instanceof SuiTransaction)) {
      return this.transfer(transaction, options)
    }
    const result = await this.client.signAndExecuteTransaction({ signer: this.keypair, transaction, options })
    return {
      hash: result.digest,
      wait: () => this._wrapSuiTx(result)
    }
  }

  _moveCallsFromTx (transaction: SuiTransaction) {
    return transaction.blockData.transactions.map(tx => {
      if (tx.kind === 'MoveCall') {
        return {
          ...tx,
          arguments: tx.arguments.map(arg => {
            if (arg.kind === 'Input') {
              if (typeof arg.value === 'number' || typeof arg.value === 'string') {
                return arg.value
              } else if (Array.isArray(arg.value)) {
                return utils.hexlify(arg.value)
              }
            }
          })
        }
      }
    }).filter(Boolean)
  }

  async deploy(module: string, metadata: string) {
    throw new Error('Not implemented')
  }
}

export class SuiExtWallet extends SuiWallet {
  readonly ext: any

  constructor(adaptor: SuiAdaptor, ext) {
    super(adaptor)
    this.ext = ext
  }

  get address() {
    return this.ext.signer.accounts?.[0]?.address as string
  }

  async sendTransaction(transaction: SuiTransaction, options?: SuiTransactionBlockResponseOptions) {
    const feat = this.ext.signer.features['sui:signAndExecuteTransactionBlock']
    const result = await feat.signAndExecuteTransactionBlock({
        transactionBlock:
        transaction, options,
        chain: 'sui:mainnet',
        account: this.ext.signer.accounts[0]
    })

    return {
      hash: result.digest,
      wait: () => this._wrapSuiTx(result)
    }
  }

  async deploy(): Promise<any> {
    throw new Error('Cannot deploy with extention wallet')
  }
}
