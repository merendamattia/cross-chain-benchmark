/* eslint-disable camelcase */
import { task } from "hardhat/config";
import { Contract, Signer, ethers } from "ethers";
import { L1_ADDRESS_MAP } from "../deploy/consts";

require("dotenv").config();

const relayMessengerAbi = [
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: "address",
        name: "sender",
        type: "address",
      },
      {
        indexed: true,
        internalType: "address",
        name: "target",
        type: "address",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "value",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "messageNonce",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "uint256",
        name: "gasLimit",
        type: "uint256",
      },
      {
        indexed: false,
        internalType: "bytes",
        name: "message",
        type: "bytes",
      },
    ],
    name: "SentMessage",
    type: "event",
  },
  {
    inputs: [
      {
        internalType: "address",
        name: "_from",
        type: "address",
      },
      {
        internalType: "address",
        name: "_to",
        type: "address",
      },
      {
        internalType: "uint256",
        name: "_value",
        type: "uint256",
      },
      {
        internalType: "uint256",
        name: "_messageNonce",
        type: "uint256",
      },
      {
        internalType: "bytes",
        name: "_message",
        type: "bytes",
      },
      {
        internalType: "uint32",
        name: "_newGasLimit",
        type: "uint32",
      },
      {
        internalType: "address",
        name: "_refundAddress",
        type: "address",
      },
    ],
    name: "replayMessage",
    outputs: [],
    stateMutability: "payable",
    type: "function",
  },
];

task("rescue-stuck-scroll-txn", "Rescue a failed Scroll transaction")
  .addParam("l1Hash", "Txn of the L1 message to rescue")
  .addParam("gasLimit", "Gas limit to use for the rescue transaction")
  .setAction(async function (taskArguments, hre_: any) {
    const chainId = await hre_.getChainId();
    if (!["1", "11155111"].includes(String(chainId))) {
      throw new Error("This script can only be run on Sepolia or Ethereum mainnet");
    }
    const signer = (await hre_.ethers.getSigners())[0] as unknown as Signer;
    const messengerContract = new Contract(L1_ADDRESS_MAP[chainId].scrollMessengerRelay, relayMessengerAbi, signer);

    const txn = await signer.provider?.getTransactionReceipt(taskArguments.l1Hash);
    const relevantEvent = txn?.logs?.find(
      (log) => log.topics[0] === messengerContract.interface.getEventTopic("SentMessage")
    );
    if (!relevantEvent) {
      throw new Error("No relevant event found. Is this a Scroll bridge transaction?");
    }
    const decodedEvent = messengerContract.interface.parseLog(relevantEvent);
    const { sender, target, value, messageNonce, message } = decodedEvent.args;
    const refundAddress = await signer.getAddress();

    console.debug("Log found. Event Decoded.");
    console.debug("Will replay with these parameters:", {
      _from: sender,
      _to: target,
      _value: value.toString(),
      _messageNonce: messageNonce.toString(),
      _message: message.toString(),
      _newGasLimit: taskArguments.gasLimit,
      _refundAddress: refundAddress,
    });
    console.debug("Replaying message (sending with 0.001ETH )...");
    const resultingTxn = await messengerContract.replayMessage(
      sender, // _from
      target, // _to
      value, // _value
      messageNonce, // _messageNonce
      message, // _message
      ethers.BigNumber.from(taskArguments.gasLimit), // _newGasLimit
      refundAddress, // _refundAddress
      {
        // 0.001 ETH to be sent to the Scroll relayer (to cover L1 gas costs)
        // Using recommended value default as described here: https://docs.scroll.io/en/developers/l1-and-l2-bridging/eth-and-erc20-token-bridge/
        // *Any* leftover ETH will be immediately refunded to the signer - this is just the L1 gas cost for submitting the transaction
        value: ethers.utils.parseEther("0.001"),
      }
    );
    console.log("Replay transaction hash:", resultingTxn.hash);
  });
