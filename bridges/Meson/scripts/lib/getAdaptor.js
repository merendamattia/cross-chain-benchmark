const { ethers } = require('hardhat')
const presets = require('@mesonfi/presets').default

const CustomGasFeeProviderWrapper = require('./CustomGasFeeProviderWrapper')

exports.getAdaptor = function getAdaptor (network) {
  if (!presets.getNetwork(network.id)) {
    presets.useTestnet(true)
  }

  if (network.addressFormat === 'ethers' && !network.id.startsWith('zksync') && !network.id.startsWith('zklink')) {
    const provider = new ethers.providers.JsonRpcProvider(network.url)
    ethers.provider = new CustomGasFeeProviderWrapper(provider)
    return ethers.provider
  } else {
    return presets.createAdaptor(network.id, network.url)
  }
}
