import { MerkleTree } from "@uma/common";
import {
  toBNWei,
  SignerWithAddress,
  seedWallet,
  expect,
  Contract,
  ethers,
  randomAddress,
  BigNumber,
} from "../../../utils/utils";
import * as consts from "./constants";
import { hubPoolFixture, enableTokensForLP } from "./fixtures/HubPool.Fixture";
import { buildPoolRebalanceLeafTree, buildPoolRebalanceLeaves, PoolRebalanceLeaf } from "./MerkleLib.utils";

let hubPool: Contract, mockAdapter: Contract, weth: Contract, dai: Contract, mockSpoke: Contract, timer: Contract;
let owner: SignerWithAddress, dataWorker: SignerWithAddress, liquidityProvider: SignerWithAddress;
let l2Weth: string, l2Dai: string;

// Construct the leaves that will go into the merkle tree. For this function create a simple set of leaves that will
// repay two token to one chain Id with simple lpFee, netSend and running balance amounts.
export async function constructSimpleTree(): Promise<{
  wethToSendToL2: BigNumber;
  daiToSend: BigNumber;
  leaves: PoolRebalanceLeaf[];
  tree: MerkleTree<PoolRebalanceLeaf>;
}> {
  const wethToSendToL2 = toBNWei(100);
  const daiToSend = toBNWei(1000);
  const leaves = buildPoolRebalanceLeaves(
    [consts.repaymentChainId, consts.repaymentChainId], // repayment chain.
    [[weth.address, dai.address], []], // l1Token. We will only be sending WETH and DAI to the associated repayment chain.
    [[toBNWei(1), toBNWei(10)], []], // bundleLpFees. Set to 1 ETH and 10 DAI respectively to attribute to the LPs.
    [[wethToSendToL2, daiToSend], []], // netSendAmounts. Set to 100 ETH and 1000 DAI as the amount to send from L1->L2.
    [[wethToSendToL2, daiToSend], []], // runningBalances. Set to 100 ETH and 1000 DAI.
    [0, 1] // groupIndex. Second leaf should not relay roots to spoke pool.
  );
  const tree = await buildPoolRebalanceLeafTree(leaves);

  return { wethToSendToL2, daiToSend, leaves, tree };
}

describe("HubPool Root Bundle Execution", function () {
  beforeEach(async function () {
    [owner, dataWorker, liquidityProvider] = await ethers.getSigners();
    ({ weth, dai, hubPool, mockAdapter, mockSpoke, timer, l2Weth, l2Dai } = await hubPoolFixture());
    await seedWallet(dataWorker, [dai], weth, consts.bondAmount.add(consts.finalFee).mul(2));
    await seedWallet(liquidityProvider, [dai], weth, consts.amountToLp.mul(10));

    await enableTokensForLP(owner, hubPool, weth, [weth, dai]);
    await weth.connect(liquidityProvider).approve(hubPool.address, consts.amountToLp);
    await hubPool.connect(liquidityProvider).addLiquidity(weth.address, consts.amountToLp);
    await dai.connect(liquidityProvider).approve(hubPool.address, consts.amountToLp.mul(10)); // LP with 10000 DAI.
    await hubPool.connect(liquidityProvider).addLiquidity(dai.address, consts.amountToLp.mul(10));

    await weth.connect(dataWorker).approve(hubPool.address, consts.bondAmount.mul(10));
  });

  it("Executing root bundle correctly produces the relay bundle call and sends repayment actions", async function () {
    const { wethToSendToL2, daiToSend, leaves, tree } = await constructSimpleTree();

    await hubPool.connect(dataWorker).proposeRootBundle(
      [3117, 3118], // bundleEvaluationBlockNumbers used by bots to construct bundles. Length must equal the number of leaves.
      2, // poolRebalanceLeafCount.
      tree.getHexRoot(), // poolRebalanceRoot. Generated from the merkle tree constructed before.
      consts.mockRelayerRefundRoot, // Not relevant for this test.
      consts.mockSlowRelayRoot // Not relevant for this test.
    );

    // Advance time so the request can be executed and execute first leaf.
    await timer.setCurrentTime(Number(await timer.getCurrentTime()) + consts.refundProposalLiveness + 1);
    expect(
      await hubPool.connect(dataWorker).executeRootBundle(...Object.values(leaves[0]), tree.getHexProof(leaves[0]))
    ).to.emit(hubPool, "RootBundleExecuted");

    // Balances should have updated as expected. Note that pool should still have bond remaining since a leaf
    // is unexecuted.
    expect(await weth.balanceOf(hubPool.address)).to.equal(
      consts.amountToLp.sub(wethToSendToL2).add(consts.bondAmount.add(consts.finalFee))
    );
    expect(await weth.balanceOf(await mockAdapter.bridge())).to.equal(wethToSendToL2);
    expect(await dai.balanceOf(hubPool.address)).to.equal(consts.amountToLp.mul(10).sub(daiToSend));
    expect(await dai.balanceOf(await mockAdapter.bridge())).to.equal(daiToSend);

    // Since the mock adapter is delegatecalled, when querying, its address should be the hubPool address.
    const mockAdapterAtHubPool = mockAdapter.attach(hubPool.address);

    // Check the mockAdapter was called with the correct arguments for each method.
    const relayMessageEvents = await mockAdapterAtHubPool.queryFilter(
      mockAdapterAtHubPool.filters.RelayMessageCalled()
    );
    expect(relayMessageEvents.length).to.equal(1); // Exactly one message sent from L1->L2.
    expect(relayMessageEvents[relayMessageEvents.length - 1].args?.target).to.equal(mockSpoke.address);
    expect(relayMessageEvents[relayMessageEvents.length - 1].args?.message).to.equal(
      mockSpoke.interface.encodeFunctionData("relayRootBundle", [
        consts.mockRelayerRefundRoot,
        consts.mockSlowRelayRoot,
      ])
    );

    const relayTokensEvents = await mockAdapterAtHubPool.queryFilter(mockAdapterAtHubPool.filters.RelayTokensCalled());
    expect(relayTokensEvents.length).to.equal(2); // Exactly two token transfers from L1->L2.
    expect(relayTokensEvents[0].args?.l1Token).to.equal(weth.address);
    expect(relayTokensEvents[0].args?.l2Token).to.equal(l2Weth);
    expect(relayTokensEvents[0].args?.amount).to.equal(wethToSendToL2);
    expect(relayTokensEvents[0].args?.to).to.equal(mockSpoke.address);
    expect(relayTokensEvents[1].args?.l1Token).to.equal(dai.address);
    expect(relayTokensEvents[1].args?.l2Token).to.equal(l2Dai);
    expect(relayTokensEvents[1].args?.amount).to.equal(daiToSend);
    expect(relayTokensEvents[1].args?.to).to.equal(mockSpoke.address);

    // Check the leaf count was decremented correctly.
    expect((await hubPool.rootBundleProposal()).unclaimedPoolRebalanceLeafCount).to.equal(1);
  });

  it("Executing two leaves with the same chain ID does not relay root bundle to spoke pool twice", async function () {
    const { leaves, tree } = await constructSimpleTree();

    await hubPool
      .connect(dataWorker)
      .proposeRootBundle([3117, 3118], 2, tree.getHexRoot(), consts.mockRelayerRefundRoot, consts.mockSlowRelayRoot);

    // Advance time so the request can be executed and execute two leaves with same chain ID.
    await timer.setCurrentTime(Number(await timer.getCurrentTime()) + consts.refundProposalLiveness + 1);
    await hubPool.connect(dataWorker).executeRootBundle(...Object.values(leaves[0]), tree.getHexProof(leaves[0]));
    await hubPool.connect(dataWorker).executeRootBundle(...Object.values(leaves[1]), tree.getHexProof(leaves[1]));

    // Since the mock adapter is delegatecalled, when querying, its address should be the hubPool address.
    const mockAdapterAtHubPool = mockAdapter.attach(hubPool.address);

    // Check the mockAdapter was called with the correct arguments for each method. The event counts should be identical
    // to the above test.
    const relayMessageEvents = await mockAdapterAtHubPool.queryFilter(
      mockAdapterAtHubPool.filters.RelayMessageCalled()
    );
    expect(relayMessageEvents.length).to.equal(1); // Exactly one message sent from L1->L2.
    // and 1 for the initiateRelayerRefund.
    expect(relayMessageEvents[relayMessageEvents.length - 1].args?.target).to.equal(mockSpoke.address);
    expect(relayMessageEvents[relayMessageEvents.length - 1].args?.message).to.equal(
      mockSpoke.interface.encodeFunctionData("relayRootBundle", [
        consts.mockRelayerRefundRoot,
        consts.mockSlowRelayRoot,
      ])
    );
  });

  it("Executing all leaves returns bond to proposer", async function () {
    const { leaves, tree } = await constructSimpleTree();

    await hubPool
      .connect(dataWorker)
      .proposeRootBundle([3117, 3118], 2, tree.getHexRoot(), consts.mockRelayerRefundRoot, consts.mockSlowRelayRoot);

    // Advance time so the request can be executed and execute both leaves.
    await timer.setCurrentTime(Number(await timer.getCurrentTime()) + consts.refundProposalLiveness + 1);
    await hubPool.connect(dataWorker).executeRootBundle(...Object.values(leaves[0]), tree.getHexProof(leaves[0]));

    // Second execution sends bond back to data worker.
    const bondAmount = consts.bondAmount.add(consts.finalFee);
    expect(
      await hubPool.connect(dataWorker).executeRootBundle(...Object.values(leaves[1]), tree.getHexProof(leaves[1]))
    ).to.changeTokenBalances(weth, [dataWorker, hubPool], [bondAmount, bondAmount.mul(-1)]);
  });

  it("Reverts if spoke pool not set for chain ID", async function () {
    const { leaves, tree } = await constructSimpleTree();

    await hubPool
      .connect(dataWorker)
      .proposeRootBundle([3117, 3118], 2, tree.getHexRoot(), consts.mockRelayerRefundRoot, consts.mockSlowRelayRoot);

    // Set spoke pool to address 0x0
    await hubPool.setCrossChainContracts(consts.repaymentChainId, mockAdapter.address, consts.zeroAddress);

    // Advance time so the request can be executed and check that executing the request reverts.
    await timer.setCurrentTime(Number(await timer.getCurrentTime()) + consts.refundProposalLiveness + 1);
    await expect(
      hubPool.connect(dataWorker).executeRootBundle(...Object.values(leaves[0]), tree.getHexProof(leaves[0]))
    ).to.be.revertedWith("SpokePool not initialized");
  });

  it("Reverts if adapter not set for chain ID", async function () {
    const { leaves, tree } = await constructSimpleTree();

    await hubPool
      .connect(dataWorker)
      .proposeRootBundle([3117, 3118], 2, tree.getHexRoot(), consts.mockRelayerRefundRoot, consts.mockSlowRelayRoot);

    // Set adapter to random address.
    await hubPool.setCrossChainContracts(consts.repaymentChainId, randomAddress(), mockSpoke.address);

    // Advance time so the request can be executed and check that executing the request reverts.
    await timer.setCurrentTime(Number(await timer.getCurrentTime()) + consts.refundProposalLiveness + 1);
    await expect(
      hubPool.connect(dataWorker).executeRootBundle(...Object.values(leaves[0]), tree.getHexProof(leaves[0]))
    ).to.be.revertedWith("Adapter not initialized");
  });

  it("Reverts if destination token is zero address for a pool rebalance route", async function () {
    const { leaves, tree } = await constructSimpleTree();

    await hubPool.connect(dataWorker).proposeRootBundle(
      [3117], // bundleEvaluationBlockNumbers used by bots to construct bundles. Length must equal the number of leaves.
      1, // poolRebalanceLeafCount. There is exactly one leaf in the bundle (just sending WETH to one address).
      tree.getHexRoot(), // poolRebalanceRoot. Generated from the merkle tree constructed before.
      consts.mockRelayerRefundRoot, // Not relevant for this test.
      consts.mockSlowRelayRoot // Not relevant for this test.
    );

    // Let's set weth pool rebalance route to zero address.
    await hubPool.setPoolRebalanceRoute(consts.repaymentChainId, weth.address, consts.zeroAddress);

    // Advance time so the request can be executed and check that executing the request reverts.
    await timer.setCurrentTime(Number(await timer.getCurrentTime()) + consts.refundProposalLiveness + 1);
    await expect(
      hubPool.connect(dataWorker).executeRootBundle(...Object.values(leaves[0]), tree.getHexProof(leaves[0]))
    ).to.be.revertedWith("Route not whitelisted");
  });

  it("Execution rejects leaf claim before liveness passed", async function () {
    const { leaves, tree } = await constructSimpleTree();
    await hubPool
      .connect(dataWorker)
      .proposeRootBundle([3117, 3118], 2, tree.getHexRoot(), consts.mockRelayerRefundRoot, consts.mockSlowRelayRoot);

    // Set time 10 seconds before expiration. Should revert.
    await timer.setCurrentTime(Number(await timer.getCurrentTime()) + consts.refundProposalLiveness - 10);

    await expect(
      hubPool.connect(dataWorker).executeRootBundle(...Object.values(leaves[0]), tree.getHexProof(leaves[0]))
    ).to.be.revertedWith("Not passed liveness");

    // Set time after expiration. Should no longer revert.
    await timer.setCurrentTime(Number(await timer.getCurrentTime()) + 11);
    await hubPool.connect(dataWorker).executeRootBundle(...Object.values(leaves[0]), tree.getHexProof(leaves[0]));
  });

  it("Execution rejects invalid leaves", async function () {
    const { leaves, tree } = await constructSimpleTree();
    await hubPool
      .connect(dataWorker)
      .proposeRootBundle([3117, 3118], 2, tree.getHexRoot(), consts.mockRelayerRefundRoot, consts.mockSlowRelayRoot);
    await timer.setCurrentTime(Number(await timer.getCurrentTime()) + consts.refundProposalLiveness + 1);

    // Take the valid root but change some element within it, such as the chainId. This will change the hash of the leaf
    // and as such the contract should reject it for not being included within the merkle tree for the valid proof.
    const badLeaf = { ...leaves[0], chainId: 13371 };
    await expect(
      hubPool.connect(dataWorker).executeRootBundle(...Object.values(badLeaf), tree.getHexProof(leaves[0]))
    ).to.be.revertedWith("Bad Proof");
  });

  it("Execution rejects double claimed leaves", async function () {
    const { leaves, tree } = await constructSimpleTree();
    await hubPool
      .connect(dataWorker)
      .proposeRootBundle([3117, 3118], 2, tree.getHexRoot(), consts.mockRelayerRefundRoot, consts.mockSlowRelayRoot);
    await timer.setCurrentTime(Number(await timer.getCurrentTime()) + consts.refundProposalLiveness + 1);

    // First claim should be fine. Second claim should be reverted as you cant double claim a leaf.
    await hubPool.connect(dataWorker).executeRootBundle(...Object.values(leaves[0]), tree.getHexProof(leaves[0]));
    await expect(
      hubPool.connect(dataWorker).executeRootBundle(...Object.values(leaves[0]), tree.getHexProof(leaves[0]))
    ).to.be.revertedWith("Already claimed");
  });

  it("Cannot execute while paused", async function () {
    const { leaves, tree } = await constructSimpleTree();

    await hubPool
      .connect(dataWorker)
      .proposeRootBundle([3117, 3118], 2, tree.getHexRoot(), consts.mockRelayerRefundRoot, consts.mockSlowRelayRoot);

    // Advance time so the request can be executed and execute the request.
    await timer.setCurrentTime(Number(await timer.getCurrentTime()) + consts.refundProposalLiveness + 1);

    // Should revert while paused.
    await hubPool.setPaused(true);
    await expect(
      hubPool.connect(dataWorker).executeRootBundle(...Object.values(leaves[0]), tree.getHexProof(leaves[0]))
    ).to.be.reverted;

    // Should not revert after unpaused.
    await hubPool.setPaused(false);
    await expect(
      hubPool.connect(dataWorker).executeRootBundle(...Object.values(leaves[0]), tree.getHexProof(leaves[0]))
    ).to.not.be.reverted;
  });
});
