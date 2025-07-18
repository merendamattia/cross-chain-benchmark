const { EthersProviderWrapper } = require('@nomiclabs/hardhat-ethers/internal/ethers-provider-wrapper')

module.exports = class CustomGasFeeProviderWrapper extends EthersProviderWrapper {
  async getFeeData() {
    const feeData = await this._checkEip1559() || { gasPrice: await this.getGasPrice() }
    return feeData
  }

  _eip1559FeeData = undefined
  async _checkEip1559 () {
    if (typeof this._eip1559FeeData !== 'undefined') {
      return this._eip1559FeeData
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

    setTimeout(() => this._eip1559FeeData = undefined, 60_000)

    if (!transactions.length || eip1559Transactions.length / transactions.length < 0.5) {
      this._eip1559FeeData = null
      return
    }

    const sorted = eip1559Transactions.sort((tx1, tx2) => tx1.maxFeePerGas.lt(tx2.maxFeePerGas) ? -1 : 1)
    const index = Math.floor(sorted.length * 0.5)
    const { gasPrice, maxFeePerGas, maxPriorityFeePerGas } = sorted[index]
    this._eip1559FeeData = { gasPrice, maxFeePerGas, maxPriorityFeePerGas }

    return this._eip1559FeeData
  }

  async estimateGas(transaction) {
    return await super.estimateGas(transaction)
  }
}
