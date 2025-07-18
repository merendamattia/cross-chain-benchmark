const fs = require('fs')
const path = require('path')

const pairs = [
  [
    'typechain-types/@openzeppelin/contracts/token/ERC20/ERC20.ts',
    'packages/base/abis/ERC20Contract.d.ts',
  ],
  [
    'typechain-types/contracts/Meson.ts',
    'packages/base/abis/MesonContract.d.ts',
  ],
  [
    'typechain-types/common.ts',
    'packages/base/abis/ContractTypes.d.ts',
  ],
]

pairs.forEach(([from, to]) => {
  const content = fs.readFileSync(from, 'utf-8')
  const result = content
    .replace(/"(?:..\/)+common"/, '"./ContractTypes"')
    .replace('export interface ERC20 extends ', 'export interface ERC20Contract extends ')
    .replace('export interface Meson extends ', 'export interface MesonContract extends ')

  const dirName = path.dirname(to)

  if (!fs.existsSync(dirName)) {
    fs.mkdirSync(dirName, { recursive: true })
  }

  fs.writeFileSync(to, result, 'utf-8')
})
