import { utils } from 'ethers'
import {
  Account as StarkAccount,
  CallData,
  ec,
  hash,
  constants,
  CairoCustomEnum,
  CairoOption,
  CairoOptionVariant,
} from 'starknet'
import StarkAdaptor from './StarkAdaptor'

const AX_ACCOUNT_CLASSHASH = '0x036078334509b514626504edc9fb252328d1a240e4e948bef8d0c08dff45927f'

export default class StarkWallet extends StarkAdaptor {
  readonly #privateKey: string
  readonly publicKey: string
  readonly #calldata: string[]
  readonly address: string
  readonly account: StarkAccount

  constructor(adaptor: StarkAdaptor, opt: { privateKey?: string, account?: StarkAccount }) {
    super(adaptor.client)
    if (opt.privateKey) {
      this.#privateKey = opt.privateKey
      this.publicKey = ec.starkCurve.getStarkKey(opt.privateKey)
      this.#calldata = CallData.compile({
        owner: new CairoCustomEnum({ Starknet: { pubkey: this.publicKey } }),
        guardian: new CairoOption(CairoOptionVariant.None),
      })
      this.address = utils.hexZeroPad(hash.calculateContractAddressFromHash(
        this.publicKey,
        AX_ACCOUNT_CLASSHASH,
        this.#calldata,
        0
      ), 32)
      this.account = new StarkAccount({
        nodeUrl: adaptor.nodeUrl
      }, this.address, opt.privateKey, undefined, constants.TRANSACTION_VERSION.V3)
    } else if (opt.account) {
      this.account = opt.account
      this.address = utils.hexZeroPad(this.account.address, 32)
    }
  }

  async deploy() {
    const tx = await this.account.deployAccount({
      classHash: AX_ACCOUNT_CLASSHASH,
      constructorCalldata: this.#calldata,
      contractAddress: this.address,
      addressSalt: this.publicKey,
    })
    return {
      hash: tx.transaction_hash,
      wait: (confirmations: number) => this.waitForTransaction(tx.transaction_hash, confirmations)
    }
  }

  async transfer({ to, value }) {
    this._coreToken.connect(this.account)
    const tx = await this._coreToken.transfer(to, value)
    this._coreToken.connect(null)
    return {
      hash: tx.transaction_hash,
      wait: (confirmations: number) => this.waitForTransaction(tx.transaction_hash, confirmations)
    }
  }

  async sendTransaction({ instance, method, args }) {
    const tx = await instance[method](...args)
    return {
      hash: tx.transaction_hash,
      wait: (confirmations: number) => this.waitForTransaction(tx.transaction_hash, confirmations)
    }
  }

  async signMessage(msg: string) {
    let signData: Uint8Array
    if (utils.isHexString(msg)) {
      signData = utils.arrayify(msg)
    } else {
      signData = utils.toUtf8Bytes(msg)
    }
    const msgHash = hash.computeHashOnElements([...signData])
    const { r, s, recovery } = ec.starkCurve.sign(msgHash, this.#privateKey)
    return utils.splitSignature({ r: utils.hexlify(r), s: utils.hexlify(s), recoveryParam: recovery }).compact
  }
}

export class StarkExtWallet extends StarkWallet {
  readonly ext: any

  constructor(adaptor: StarkAdaptor, ext) {
    super(adaptor, { account: ext?.connection?.wallet?.account })
    this.ext = ext
  }

  async deploy(): Promise<any> {
    throw new Error('Cannot deploy with extention wallet')
  }
}
