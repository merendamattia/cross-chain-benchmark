// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import { IERC20 } from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import { SafeERC20 } from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import { ArbitrumL2ERC20GatewayLike } from "../../interfaces/ArbitrumBridge.sol";
import { WithdrawalHelperBase } from "./WithdrawalHelperBase.sol";
import { ITokenMessenger } from "../../external/interfaces/CCTPInterfaces.sol";
import { WETH9Interface } from "../../external/interfaces/WETH9Interface.sol";
import { CrossDomainAddressUtils } from "../../libraries/CrossDomainAddressUtils.sol";

/**
 * @title Arbitrum_WithdrawalHelper
 * @notice This contract interfaces with L2-L1 token bridges and withdraws tokens to a single address on L1.
 * @dev This contract should be deployed on Arbitrum L2s which only use CCTP or the canonical Arbitrum gateway router to withdraw tokens.
 * @custom:security-contact bugs@across.to
 */
contract Arbitrum_WithdrawalHelper is WithdrawalHelperBase {
    using SafeERC20 for IERC20;

    // Error which triggers when the supplied L1 token does not match the Arbitrum gateway router's expected L2 token.
    error InvalidTokenMapping();

    /*
     * @notice Constructs the Arbitrum_WithdrawalHelper.
     * @param _l2Usdc Address of native USDC on the L2.
     * @param _cctpTokenMessenger Address of the CCTP token messenger contract on L2.
     * @param _wrappedNativeToken Address of the wrapped native token contract on L2.
     * @param _destinationCircleDomainId Circle's assigned CCTP domain ID for the destination network. For Ethereum, this is 0.
     * @param _l2GatewayRouter Address of the Arbitrum l2 gateway router contract.
     * @param _tokenRecipient L1 Address which will unconditionally receive tokens withdrawn from this contract.
     */
    constructor(
        IERC20 _l2Usdc,
        ITokenMessenger _cctpTokenMessenger,
        WETH9Interface _wrappedNativeToken,
        uint32 _destinationCircleDomainId,
        address _l2GatewayRouter,
        address _tokenRecipient
    )
        WithdrawalHelperBase(
            _l2Usdc,
            _cctpTokenMessenger,
            _wrappedNativeToken,
            _destinationCircleDomainId,
            _l2GatewayRouter,
            _tokenRecipient
        )
    {}

    /**
     * @notice Initializes the withdrawal helper contract.
     * @param _crossDomainAdmin L1 address of the contract which may execute admin functions on this contract.
     */
    function initialize(address _crossDomainAdmin) public initializer {
        __WithdrawalHelper_init(_crossDomainAdmin);
    }

    /*
     * @notice Calls CCTP or the Arbitrum gateway router to withdraw tokens back to the TOKEN_RECIPIENT L1 address.
     * @param l1Token Address of the L1 token to receive.
     * @param l2Token Address of the L2 token to send back.
     * @param amountToReturn Amount of l2Token to send back.
     */
    function withdrawToken(
        address l1Token,
        address l2Token,
        uint256 amountToReturn
    ) public override {
        // If the l2TokenAddress is UDSC, we need to use the CCTP bridge.
        if (l2Token == address(usdcToken) && _isCCTPEnabled()) {
            _transferUsdc(TOKEN_RECIPIENT, amountToReturn);
        } else {
            if (l2Token == address(WRAPPED_NATIVE_TOKEN)) _wrapNativeToken();
            // Otherwise, we use the Arbitrum ERC20 Gateway router.
            ArbitrumL2ERC20GatewayLike tokenBridge = ArbitrumL2ERC20GatewayLike(L2_TOKEN_GATEWAY);
            // If the gateway router's expected L2 token address does not match then revert. This check does not actually
            // impact whether the bridge will succeed, since the ERC20 gateway router only requires the L1 token address, but
            // it is added here to potentially catch scenarios where there was a mistake in the calldata.
            if (tokenBridge.calculateL2TokenAddress(l1Token) != l2Token) revert InvalidTokenMapping();
            //slither-disable-next-line unused-return
            tokenBridge.outboundTransfer(
                l1Token, // _l1Token. Address of the L1 token to bridge over.
                TOKEN_RECIPIENT, // _to. Withdraw, over the bridge, to the recipient.
                amountToReturn, // _amount.
                "" // _data. We don't need to send any data for the bridging action.
            );
        }
    }

    function _requireAdminSender() internal view override {
        if (msg.sender != CrossDomainAddressUtils.applyL1ToL2Alias(crossDomainAdmin)) revert NotCrossDomainAdmin();
    }
}
