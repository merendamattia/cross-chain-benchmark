# Tools and Configs of Meson Smart Contract

This is a toolkit for Meson Smart Contract, which includes the following:

- Contract Abis
- Supported Networks and Tokens
- Useful library classes and helper functions

## Install

To install the base package, run:

```bash
npm install @mesonfi/base
```

or yarn

```bash
yarn add @mesonfi/base
```

Notice: the minimum version of `@mesonfi/base` is `1.27.1`, you must use other meson packages with the same version or
higher.

## Usage

you can use all the available classes and functions in `@mesonfi/base` directly:

### Presets (ABI & Networks)

- meson.ABI.Meson: the ABI of the Meson Smart Contract.
- meson.ABI.ERC20: the ABI of the ERC20 token contract.
- meson.Networks.Mainnets: All supported mainnet networks and tokens.
- meson.Networks.Testnets: All supported testnet networks and tokens.
- meson.Networks.V0Mainnets: All supported mainnet networks and tokens in v0 version.
- meson.Networks.V0Testnets: All supported testnet networks and tokens in v0 version.

### Constants

- meson.CONSTANTS.AddressFormat: constants for the address format used in Meson Smart Contract.
- meson.CONSTANTS.CategoryTokenMap: a map of token indexes to the token categories.
- meson.CONSTANTS.ADDRESS_ONE: the core token address in Meson Smart Contract.
- meson.CONSTANTS.ADDRESS_ZERO: the zero address in Meson Smart Contract.

### Helper Functions

- meson.useNetworks: this function will create a new MesonBase instance with your custom networks and tokens.

```javascript
import {meson} from '@mesonfi/base';

// this is the default config for explorer and backend.
const presets = meson.useNetworks({
    useTestnet: false,
    v0: false,
    withDisabled: true,
    disabledChains: [],
    allowEmptyTokens: true,
});

// After you can
const networks = presets.getNetworks();
const network = presets.getNetworkByNetworkId('eth');
const tokens = presets.tokens;
const coreToken = presets.getCoreToken();
```
- meson.getTokenType: function to get the token type which is defined in Meson Smart Contract.
- meson.getTokenCategory: function to get the token category which is defined in Meson Smart Contract.
- meson.getTokenTypeFromCategory: function to get the token type from the token category.
- meson.isAddressFormat: function to check if the provided address format is valid for Meson Smart Contract.
- meson.isCoreTokenIndex: function to check if the provided token index is a core token index in Meson Smart Contract.
- meson.initiatorFromAddress: function to get the initiator address from the provided address.
- meson.fromSwapValue and meson.toSwapValue: functions to convert the swap value between Meson Smart Contract
  and the frontend.
- meson.getSwapId: function to get the swap ID by combining the initiator address and the encoded swap data.
- meson.formatSaltHeader and meson.parseSaltHeader: functions to format and parse the salt header for swaps.
- meson.formatBalance: function to format the balance value to a human-readable string.
- meson.getIconFromToken: function to get the icon name from the token data, then you can get the token image from
  `https://static.meson.fi/icon/token/${name}.png`
- meson.timer and meson.timeout: tools to create a timer or timeout for async operations.

### Classes

- meson.Rpcs: class to get healthy RPCs supported by Meson, it can be used to do contract interaction for all
  supported network.

```javascript

import {meson} from '@mesonfi/base';

const demo = async () => {

    const rpcs = new meson.Rpcs('http://path.to/rpc');

    await rpcs.refreshAllRpcStatus();

    console.log(rpcs.getAllHealthyRpcStatus());
}
```
