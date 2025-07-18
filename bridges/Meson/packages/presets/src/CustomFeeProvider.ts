import { providers, BigNumber, utils } from 'ethers'

export const CustomFeeHttpProvider = extendProvider(providers.StaticJsonRpcProvider) as typeof providers.StaticJsonRpcProvider
export const CustomFeeWsProvider = extendProvider(providers.WebSocketProvider) as typeof providers.WebSocketProvider

type Class<T> = new (...args: any[]) => T
function extendProvider(Provider: Class<providers.JsonRpcProvider>) {
  class CustomFeeProvider extends Provider {
    override async estimateGas(transaction: utils.Deferrable<providers.TransactionRequest>): Promise<BigNumber> {
      const gasLimit = await super.estimateGas(transaction)
      // TODO: logger.debug('Transaction', `estimate gas success`, { estimateGas: gasLimit.toString() })
      // TODO: log errors
      return gasLimit.mul(1.2 * 100).div(100)
    }

    override async getFeeData(): Promise<providers.FeeData>  {
      const feeData = await this._checkEip1559() || { gasPrice: await this.getGasPrice() }
      return feeData
    }
  
    #eip1559FeeData = undefined
    async _checkEip1559 () {
      if (typeof this.#eip1559FeeData !== 'undefined') {
        return this.#eip1559FeeData
      }
  
      const block = await this.getBlockWithTransactions('latest')
      const transactions = [...block.transactions]
      let offset = 0
      while (transactions.length < 20) {
        offset++
        transactions.push(...(await this.getBlockWithTransactions(block.number - offset)).transactions)
        if (offset > 5) {
          break
        }
      }
      const eip1559Transactions = transactions.filter(tx => tx.maxFeePerGas && tx.maxPriorityFeePerGas)
  
      setTimeout(() => this.#eip1559FeeData = undefined, 60_000)
  
      if (!transactions.length || eip1559Transactions.length / transactions.length < 0.5) {
        this.#eip1559FeeData = null
        return
      }
  
      const sorted = eip1559Transactions.sort((tx1, tx2) => tx1.maxFeePerGas.lt(tx2.maxFeePerGas) ? -1 : 1)
      const index = Math.floor(sorted.length * 0.5)
      const { gasPrice, maxFeePerGas, maxPriorityFeePerGas } = sorted[index]
      this.#eip1559FeeData = { gasPrice, maxFeePerGas, maxPriorityFeePerGas }
  
      return this.#eip1559FeeData
    }
  }
  return CustomFeeProvider as unknown
}
