# Meson Smart Contract in Solidity

This repository contains the Solidity implementation for the Meson protocol.
See [Meson Docs](https://docs.meson.fi/protocol/background) for the design details of Meson.

## Local development

This repo includes Meson's smart contracts in Solidity for deployment to multiple EVM-compatible blockchains. It also includes Meson JS SDKs in the `packages` folder for integrating into other Meson projects to interact with Meson contracts.

Run `yarn` to install the project dependencies. Because the contracts of Meson need to be deployed on different chains, this project provides a script to switch current chain. Before the first time of compilation, run `yarn hardhat chain --testnet ropsten` to initialize contracts to Ropsten testnet. This command will copy the config file `MesonConfig.sol` to `contracts/utils` folder and set system invariants for the selected chain.

You can also run `yarn hardhat chain --testnet [id]` or `yarn hardhat chain --mainnet [id]` to switch the project to other chains. See `packages/base/networks/testnets.json` and `packages/base/networks/mainnets.json` for available chains and their respective id's.

### Run tests

Test cases are given in the `tests` folder. Before running the test, please run `yarn build:packages` to build Meson SDKs which are used by contract tests. Then, run `yarn test` to perform tests for Meson contracts. Notice that the test script will switch the current chain to Ethereum testnet because Meson contract tests should be run under this condition.

The core Meson SDK `@mesonfi/sdk` also provides its own test cases. Go to folder `packages/sdk` and run `yarn test` to perform tests for it. SDK tests also requires Ethereum environment so make sure the current chain is switched to Ethereum.

### Generate docs

Run `yarn docgen` to generate docs for Meson smart contracts, which are extracted from comments in the contract source codes. See generated docs under the `docs` folder.

### Estimate gas consumptions

This project provides two scripts to estimate gas consumptions for crucial methos of Meson. Run `yarn hardhat estimate` to estimate the normal deployed Meson contracts, and run `yarn hardhat estimate --upgradable true` to estimate gas when Meson is deployed as an upgradable contract.

## Deployment

Meson smart contracts can be deployed to multiple blockchains, either on their testsnets or mainnets. You can see many scripts of `yarn testnet:[id]` and `yarn deploy:[id]` with different values of id (which specifies the deploying chain) in `packages.json`. They are deployment scripts for Meson supported testnets and mainnets, respectively. These scripts will switch the current chain for the project, compile the smart contract, and run the actual script to deploy the upgradable version of Meson smart contract.

The deployment process consists of the following steps

1. Copy the config file `MesonConfig.sol` to `contracts/utils` folder and set up system invariants based on the selected network, and whether it is a testnet or mainnet;
2. Build Meson smart contracts;
3. Read initialization parameters (supported tokens) from `@mesonfi/base`;
4. Deploy the upgradable version of Meson with signer given by environment variables;
5. Write the address of deployed contract back to `@mesonfi/base`.

See the actual deploy scripts located in `scripts/deploy.js`. The connection config to different blockchains are given by the `@mesonfi/base` sdk in the `packages/base/networks/testnets.json` and `packages/base/networks/mainnets.json` files.

### Constructor parameters

Meson use a whitelist for supported stablecoins (`address[] supportedTokens`), which are specified on first deployment as the constructor parameter. The deploy script will read tokens from `@mesonfi/base` and set them for each chain.

## Become a Liquidity Provider

Any user who wishes to become Meson's liquidity provider needs to first register a pool index (by calling contract method `depositAndRegister`) and transfer supported stablecoins into the Meson contract. Related operations are provided in `scripts/pool.js`. Open the corresponding file and edit the parameters include token symbol, deposit amount, pool index, and run `yarn hardhat pool --testnet [id]` or `yarn hardhat pool --mainnet [id]` to execute the deposit operation. The `pool.js` files also provide withdraw scripts and please use them as needed.
