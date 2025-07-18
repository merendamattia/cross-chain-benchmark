const fs = require('fs')
const path = require('path')

const pairs = [
  [
    'artifacts/contracts/Meson.sol/Meson.json',
    'packages/base/abis/MesonAbi.json',
  ],
  [
    'artifacts/contracts/test/MockToken.sol/MockToken.json',
    'packages/base/abis/ERC20Abi.json',
  ],
]

pairs.forEach(([from, to]) => {
  const content = fs.readFileSync(from, 'utf-8')
  const json = JSON.parse(content)

  const result = JSON.stringify({ contractName: json.contractName, abi: json.abi }, null, 2)

  const dirName = path.dirname(to)

  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true })
  }

  fs.writeFileSync(to, result, 'utf-8')
})
