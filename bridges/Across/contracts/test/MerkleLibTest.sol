// SPDX-License-Identifier: BUSL-1.1
pragma solidity ^0.8.0;

import "../MerkleLib.sol";
import "../interfaces/HubPoolInterface.sol";
import "../interfaces/SpokePoolInterface.sol";
import "./interfaces/MockV2SpokePoolInterface.sol";
import "./V2MerkleLib.sol";

/**
 * @notice Contract to test the MerkleLib.
 */
contract MerkleLibTest {
    mapping(uint256 => uint256) public claimedBitMap;

    uint256 public claimedBitMap1D;

    function verifyPoolRebalance(
        bytes32 root,
        HubPoolInterface.PoolRebalanceLeaf memory rebalance,
        bytes32[] memory proof
    ) public pure returns (bool) {
        return MerkleLib.verifyPoolRebalance(root, rebalance, proof);
    }

    function verifyRelayerRefund(
        bytes32 root,
        SpokePoolInterface.RelayerRefundLeaf memory refund,
        bytes32[] memory proof
    ) public pure returns (bool) {
        return MerkleLib.verifyRelayerRefund(root, refund, proof);
    }

    function verifySlowRelayFulfillment(
        bytes32 root,
        MockV2SpokePoolInterface.SlowFill memory slowFill,
        bytes32[] memory proof
    ) public pure returns (bool) {
        return V2MerkleLib.verifySlowRelayFulfillment(root, slowFill, proof);
    }

    function verifyV3SlowRelayFulfillment(
        bytes32 root,
        V3SpokePoolInterface.V3SlowFill memory slowFill,
        bytes32[] memory proof
    ) public pure returns (bool) {
        return MerkleLib.verifyV3SlowRelayFulfillment(root, slowFill, proof);
    }

    function isClaimed(uint256 index) public view returns (bool) {
        return MerkleLib.isClaimed(claimedBitMap, index);
    }

    function setClaimed(uint256 index) public {
        MerkleLib.setClaimed(claimedBitMap, index);
    }

    function isClaimed1D(uint8 index) public view returns (bool) {
        return MerkleLib.isClaimed1D(claimedBitMap1D, index);
    }

    function setClaimed1D(uint8 index) public {
        claimedBitMap1D = MerkleLib.setClaimed1D(claimedBitMap1D, index);
    }
}
