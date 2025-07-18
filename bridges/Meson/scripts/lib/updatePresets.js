const path = require('path')
const fs = require('fs')

const mainnetsPath = path.join(__dirname, '../../packages/base/networks/mainnets.json')
const testnetsPath = path.join(__dirname, '../../packages/base/networks/testnets.json')

module.exports = function updatePresets (network) {
  const mainnets = require(mainnetsPath)
  let index = mainnets.findIndex(item => item.id === network.id)
  if (index > -1) {
    // mainnet
    mainnets.splice(index, 1, network)
    fs.writeFileSync(mainnetsPath, JSON.stringify(mainnets, null, 2))
    return
  }

  // testnet
  const testnets = require(testnetsPath)
  index = testnets.findIndex(item => item.id === network.id)
  if (index === -1) {
    throw new Error(`Invalid network: ${networkId}`)
  }
  testnets.splice(index, 1, network)
  fs.writeFileSync(testnetsPath, JSON.stringify(testnets, null, 2))
}
