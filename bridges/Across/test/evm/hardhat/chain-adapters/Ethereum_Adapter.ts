import * as consts from "../constants";
import {
  ethers,
  expect,
  Contract,
  SignerWithAddress,
  randomAddress,
  getContractFactory,
  seedWallet,
} from "../../../../utils/utils";
import { hre } from "../../../../utils/utils.hre";
import { hubPoolFixture, enableTokensForLP } from "../fixtures/HubPool.Fixture";
import { constructSingleChainTree } from "../MerkleLib.utils";

let hubPool: Contract, ethAdapter: Contract, weth: Contract, dai: Contract, mockSpoke: Contract, timer: Contract;
let owner: SignerWithAddress,
  dataWorker: SignerWithAddress,
  liquidityProvider: SignerWithAddress,
  crossChainAdmin: SignerWithAddress;

let l1ChainId: number;

describe("Ethereum Chain Adapter", function () {
  beforeEach(async function () {
    [owner, dataWorker, liquidityProvider] = await ethers.getSigners();
    ({ weth, dai, hubPool, mockSpoke, timer, crossChainAdmin } = await hubPoolFixture());
    l1ChainId = Number(await hre.getChainId());
    await seedWallet(dataWorker, [dai], weth, consts.amountToLp);
    await seedWallet(liquidityProvider, [dai], weth, consts.amountToLp.mul(10));

    await enableTokensForLP(owner, hubPool, weth, [weth, dai]);
    await weth.connect(liquidityProvider).approve(hubPool.address, consts.amountToLp);
    await hubPool.connect(liquidityProvider).addLiquidity(weth.address, consts.amountToLp);
    await weth.connect(dataWorker).approve(hubPool.address, consts.bondAmount.mul(10));
    await dai.connect(liquidityProvider).approve(hubPool.address, consts.amountToLp);
    await hubPool.connect(liquidityProvider).addLiquidity(dai.address, consts.amountToLp);
    await dai.connect(dataWorker).approve(hubPool.address, consts.bondAmount.mul(10));

    ethAdapter = await (await getContractFactory("Ethereum_Adapter", owner)).deploy();

    await hubPool.setCrossChainContracts(l1ChainId, ethAdapter.address, mockSpoke.address);

    await hubPool.setPoolRebalanceRoute(l1ChainId, weth.address, weth.address);

    await hubPool.setPoolRebalanceRoute(l1ChainId, dai.address, dai.address);

    // HubPool must own MockSpoke to call it via the Ethereum_Adapter who's requireAdminSender has an onlyOwner
    // modifier.
    await mockSpoke.connect(owner).transferOwnership(hubPool.address);
  });

  it("relayMessage calls spoke pool functions", async function () {
    expect(await mockSpoke.crossDomainAdmin()).to.equal(crossChainAdmin.address);
    const newAdmin = randomAddress();
    const functionCallData = mockSpoke.interface.encodeFunctionData("setCrossDomainAdmin", [newAdmin]);
    expect(await hubPool.relaySpokePoolAdminFunction(l1ChainId, functionCallData))
      .to.emit(ethAdapter.attach(hubPool.address), "MessageRelayed")
      .withArgs(mockSpoke.address, functionCallData);

    expect(await mockSpoke.crossDomainAdmin()).to.equal(newAdmin);
  });
  it("Correctly transfers tokens when executing pool rebalance", async function () {
    const { leaves, tree, tokensSendToL2 } = await constructSingleChainTree(dai.address, 1, l1ChainId);
    await hubPool
      .connect(dataWorker)
      .proposeRootBundle([3117], 1, tree.getHexRoot(), consts.mockRelayerRefundRoot, consts.mockSlowRelayRoot);
    await timer.setCurrentTime(Number(await timer.getCurrentTime()) + consts.refundProposalLiveness + 1);
    expect(
      await hubPool.connect(dataWorker).executeRootBundle(...Object.values(leaves[0]), tree.getHexProof(leaves[0]))
    )
      .to.emit(ethAdapter.attach(hubPool.address), "TokensRelayed")
      .withArgs(dai.address, dai.address, tokensSendToL2, mockSpoke.address);
  });
});
