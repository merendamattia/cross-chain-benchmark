// SPDX-License-Identifier: MIT
pragma solidity 0.8.16;

import "./IMesonSwapEvents.sol";
import "../utils/MesonStates.sol";

/// @title MesonSwap
/// @notice The class to receive and process swap requests on the initial chain side.
/// Methods in this class will be executed by swap initiators or LPs
/// on the initial chain of swaps.
contract MesonSwap is IMesonSwapEvents, MesonStates {
  /// @notice Posted Swaps
  /// key: `encodedSwap` in format of `version:uint8|amount:uint40|salt:uint80|fee:uint40|expireTs:uint40|outChain:uint16|outToken:uint8|inChain:uint16|inToken:uint8`
  ///   version: Version of encoding
  ///   amount: The amount of tokens of this swap, always in decimal 6. The amount of a swap is capped at $100k so it can be safely encoded in uint48;
  ///   salt: The salt value of this swap, carrying some information below:
  ///     salt & 0x80000000000000000000 == true => will release to an EOA address, otherwise a smart contract;
  ///     salt & 0x40000000000000000000 == true => will waive *service fee*;
  ///     salt & 0x20000000000000000000 == true => meson.to;
  ///     salt & 0x10000000000000000000 == true => API;
  ///     salt & 0x08000000000000000000 == true => use *non-typed signing* (some wallets such as hardware wallets don't support EIP-712v1);
  ///     salt & 0x04000000000000000000 == true => swap for core token (n/a for releasing to contract);
  ///         salt & 0xfffff00000000000         => price for core token;
  ///         salt & 0x00000fff00000000         => amount for core token;
  ///     salt & 0x02000000000000000000 == true => share some release amount to partner;
  ///         salt & 0xffff000000000000 + 65536 => pool index to share;
  ///         salt & 0x0000ffff00000000         => amount to share;
  ///     salt & 0x01000000000000000000 == true => use points to waive service fee;
  ///                                              in reality, the salt header would be 0x41
  ///     salt & 0x0000ffffffffffffffff: customized data that can be passed to integrated 3rd-party smart contract;
  ///   fee: The fee given to LPs (liquidity providers). An extra service fee maybe charged afterwards;
  ///   expireTs: The expiration time of this swap on the initial chain. The LP should `executeSwap` and receive his funds before `expireTs`;
  ///   outChain: The target chain of a cross-chain swap (given by the last 2 bytes of SLIP-44);
  ///   outToken: The index of the token on the target chain. See `tokenForIndex` in `MesonToken.sol`;
  ///   inChain: The initial chain of a cross-chain swap (given by the last 2 bytes of SLIP-44);
  ///   inToken: The index of the token on the initial chain. See `tokenForIndex` in `MesonToken.sol`.
  /// value: `postedSwap` in format of `initiator:address|poolIndex:uint40`
  ///   initiator: The swap initiator who created and signed the swap request (not necessarily the one who posted the swap);
  //    poolIndex: The index of an LP pool. See `ownerOfPool` in `MesonStates.sol` for more information.
  mapping(uint256 => uint200) internal _postedSwaps;

  /// @dev This empty reserved space is put in place to allow future versions to
  /// add new variables without shifting down storage in the inheritance chain.
  /// See https://docs.openzeppelin.com/contracts/4.x/upgradeable#storage_gaps
  uint256[50] private __gap;

  /// @notice Anyone can call this method to post a swap request. This is step 1️⃣ in a swap.
  /// The r,s,v signature must be signed by the swap initiator. The initiator can call
  /// this method directly, in which case `poolIndex` should be zero and wait for LPs
  /// to call `bondSwap`. Initiators can also send the swap requests offchain (through the
  /// meson relayer service). An LP (pool owner or authorized addresses) who receives requests through
  /// the relayer can call this method to post and bond the swap in a single contract execution,
  /// in which case he should give his own `poolIndex`.
  ///
  /// The swap will last until `expireTs` and at most one LP pool can bond to it.
  /// After the swap expires, the initiator can cancel the swap and withdraw funds.
  ///
  /// Once a swap is posted and bonded, the bonding LP should call `lock` on the target chain.
  ///
  /// @dev Designed to be used by both swap initiators, pool owner, or authorized addresses
  /// @param encodedSwap Encoded swap information; also used as the key of `_postedSwaps`
  /// @param r Part of the signature
  /// @param yParityAndS Part of the signature
  /// @param postingValue The value to be written to `_postedSwaps`. See `_postedSwaps` for encoding format
  function postSwap(uint256 encodedSwap, bytes32 r, bytes32 yParityAndS, uint200 postingValue)
    external matchProtocolVersion(encodedSwap) verifyEncodedSwap(encodedSwap)
  {
    address initiator = _initiatorFromPosted(postingValue);
    uint40 poolIndex = _poolIndexFromPosted(postingValue);
    if (poolIndex > 0 && _msgSender() != initiator) {
      // If pool index is given, the signer should be the initiator or an authorized address
      require(poolOfAuthorizedAddr[_msgSender()] == poolIndex, "Signer should be an authorized address of the given pool");
    } // Otherwise, this is posted without bonding to a specific pool. Need to execute `bondSwap` later

    _checkRequestSignature(encodedSwap, r, yParityAndS, initiator);
    _postedSwaps[encodedSwap] = postingValue;

    uint8 tokenIndex = _inTokenIndexFrom(encodedSwap);
    _unsafeDepositToken(tokenIndex, initiator, _amountFrom(encodedSwap));

    emit SwapPosted(encodedSwap);
  }

  function postSwapFromInitiator(uint256 encodedSwap, uint200 postingValue)
    payable external matchProtocolVersion(encodedSwap) verifyEncodedSwap(encodedSwap)
  {
    address initiator = _initiatorFromPosted(postingValue);
    require(_msgSender() == initiator, "Transaction should be sent from initiator");
    _postedSwaps[encodedSwap] = postingValue;

    uint8 tokenIndex = _inTokenIndexFrom(encodedSwap);
    _unsafeDepositToken(tokenIndex, initiator, _amountFrom(encodedSwap));

    emit SwapPosted(encodedSwap);
  }

  function postSwapFromContract(uint256 encodedSwap, uint200 postingValue, address contractAddress)
    payable external matchProtocolVersion(encodedSwap) verifyEncodedSwap(encodedSwap)
  {
    address initiator = _initiatorFromPosted(postingValue);
    require(_msgSender() == contractAddress, "Transaction should be sent from contractAddress");
    _postedSwaps[encodedSwap] = postingValue;

    uint8 tokenIndex = _inTokenIndexFrom(encodedSwap);
    _unsafeDepositToken(tokenIndex, contractAddress, _amountFrom(encodedSwap));

    emit SwapPosted(encodedSwap);
  }

  /// @notice If `postSwap` is called by the initiator of the swap and `poolIndex`
  /// is zero, an LP (pool owner or authorized addresses) can call this to bond the swap to himself.
  /// @dev Designed to be used by pool owner or authorized addresses
  /// @param encodedSwap Encoded swap information; also used as the key of `_postedSwaps`
  /// @param poolIndex The index of an LP pool. See `ownerOfPool` in `MesonStates.sol` for more information.
  function bondSwap(uint256 encodedSwap, uint40 poolIndex) external {
    uint200 postedSwap = _postedSwaps[encodedSwap];
    require(postedSwap > 1, "Swap does not exist");
    require(_poolIndexFromPosted(postedSwap) == 0, "Swap bonded to another pool");
    require(poolOfAuthorizedAddr[_msgSender()] == poolIndex, "Signer should be an authorized address of the given pool");

    _postedSwaps[encodedSwap] = postedSwap | poolIndex;
    emit SwapBonded(encodedSwap);
  }

  /// @notice Cancel a swap. The swap initiator can call this method to withdraw funds
  /// from an expired swap request.
  /// @dev Designed to be used by swap initiators
  /// @param encodedSwap Encoded swap information; also used as the key of `_postedSwaps`
  function cancelSwap(uint256 encodedSwap) external {
    uint200 postedSwap = _postedSwaps[encodedSwap];
    require(postedSwap > 1, "Swap does not exist");
    require(_expireTsFrom(encodedSwap) < block.timestamp, "Swap is still locked");

    delete _postedSwaps[encodedSwap]; // Swap expired so the same one cannot be posted again

    uint8 tokenIndex = _inTokenIndexFrom(encodedSwap);
    _safeTransfer(tokenIndex, _initiatorFromPosted(postedSwap), _amountFrom(encodedSwap));

    emit SwapCancelled(encodedSwap);
  }

  function cancelSwapTo(uint256 encodedSwap, address recipient, bytes32 r, bytes32 yParityAndS) external {
    uint200 postedSwap = _postedSwaps[encodedSwap];
    require(postedSwap > 1, "Swap does not exist");
    require(_expireTsFrom(encodedSwap) < block.timestamp, "Swap is still locked");

    bytes32 digest = keccak256(abi.encodePacked(encodedSwap, recipient));
    _checkSignature(digest, r, yParityAndS, _initiatorFromPosted(postedSwap));

    delete _postedSwaps[encodedSwap]; // Swap expired so the same one cannot be posted again

    uint8 tokenIndex = _inTokenIndexFrom(encodedSwap);
    _safeTransfer(tokenIndex, recipient, _amountFrom(encodedSwap));

    emit SwapCancelled(encodedSwap);
  }

  /// @notice Execute the swap by providing a release signature. This is step 4️⃣ in a swap.
  /// Once the signature is verified, the current bonding pool will receive funds deposited 
  /// by the swap initiator.
  /// @dev Designed to be used by pool owner or authorized addresses of the current bonding pool
  /// @param encodedSwap Encoded swap information; also used as the key of `_postedSwaps`
  /// @param r Part of the release signature (same as in the `release` call)
  /// @param yParityAndS Part of the release signature (same as in the `release` call)
  /// @param recipient The recipient address of the swap
  /// @param depositToPool Whether to deposit funds to the pool (will save gas)
  function executeSwap(
    uint256 encodedSwap,
    bytes32 r,
    bytes32 yParityAndS,
    address recipient,
    bool depositToPool
  ) external {
    uint200 postedSwap = _postedSwaps[encodedSwap];
    require(postedSwap > 1, "Swap does not exist");

    // Swap expiredTs < current + MIN_BOND_TIME_PERIOD
    if (_expireTsFrom(encodedSwap) < block.timestamp + MIN_BOND_TIME_PERIOD) {
      // The swap cannot be posted again and therefore safe to remove it.
      // LPs who execute in this mode can save ~5000 gas.
      delete _postedSwaps[encodedSwap];
    } else {
      // The same swap information can be posted again, so set `_postedSwaps` value to 1 to prevent that.
      _postedSwaps[encodedSwap] = 1;
    }

    _checkReleaseSignature(encodedSwap, recipient, r, yParityAndS, _initiatorFromPosted(postedSwap));

    uint8 tokenIndex = _inTokenIndexFrom(encodedSwap);
    uint40 poolIndex = _poolIndexFromPosted(postedSwap);
    if (depositToPool) {
      _balanceOfPoolToken[_poolTokenIndexFrom(tokenIndex, poolIndex)] += _amountFrom(encodedSwap);
    } else {
      _safeTransfer(tokenIndex, ownerOfPool[poolIndex], _amountFrom(encodedSwap));
    }

    emit SwapExecuted(encodedSwap);
  }

  function directExecuteSwap(
    uint256 encodedSwap,
    bytes32 r,
    bytes32 yParityAndS,
    address initiator,
    address recipient
  ) payable external matchProtocolVersion(encodedSwap) verifyEncodedSwap(encodedSwap) {
    _checkReleaseSignature(encodedSwap, recipient, r, yParityAndS, initiator);

    _postedSwaps[encodedSwap] = 1;

    uint256 amount = _amountFrom(encodedSwap);
    uint8 tokenIndex = _inTokenIndexFrom(encodedSwap);
    _balanceOfPoolToken[_poolTokenIndexFrom(tokenIndex, 1)] += amount;

    _unsafeDepositToken(tokenIndex, initiator, amount);

    emit SwapExecuted(encodedSwap);
  }

  function simpleExecuteSwap(uint256 encodedSwap)
    payable external matchProtocolVersion(encodedSwap) verifyEncodedSwap(encodedSwap)
  {
    _postedSwaps[encodedSwap] = 1;

    uint256 amount = _amountFrom(encodedSwap);
    uint8 tokenIndex = _inTokenIndexFrom(encodedSwap);
    _balanceOfPoolToken[_poolTokenIndexFrom(tokenIndex, 1)] += amount;

    _unsafeDepositToken(tokenIndex, _msgSender(), amount);

    emit SwapExecuted(encodedSwap);
  }

  /// @notice Read information for a posted swap
  function getPostedSwap(uint256 encodedSwap) external view
    returns (address initiator, address poolOwner, bool exist)
  {
    uint200 postedSwap = _postedSwaps[encodedSwap];
    initiator = _initiatorFromPosted(postedSwap);
    exist = postedSwap > 0;
    if (initiator == address(0)) {
      poolOwner = address(0);
    } else {
      poolOwner = ownerOfPool[_poolIndexFromPosted(postedSwap)];
    }
  }

  modifier verifyEncodedSwap(uint256 encodedSwap) {
    require(_inChainFrom(encodedSwap) == SHORT_COIN_TYPE, "Swap not for this chain");
    require(
      _tokenType(_inTokenIndexFrom(encodedSwap)) == _tokenType(_outTokenIndexFrom(encodedSwap)),
      "In & out token types do not match"
    );
    require(_postedSwaps[encodedSwap] == 0, "Swap already exists");

    require(_amountFrom(encodedSwap) <= MAX_SWAP_AMOUNT, "For security reason, amount cannot be greater than 100k");

    uint256 delta = _expireTsFrom(encodedSwap) - block.timestamp;
    require(delta > MIN_BOND_TIME_PERIOD, "Expire ts too early");
    require(delta < MAX_BOND_TIME_PERIOD, "Expire ts too late");

    _;
  }

  function _isPremiumManager() internal view virtual returns (bool) {}
}
