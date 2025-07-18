import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { L1_ADDRESS_MAP, WETH, WMATIC } from "./consts";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const spokeChainId = parseInt(await hre.getChainId());
  const hubChainId = parseInt(await hre.companionNetworks.l1.getChainId());
  const l1HubPool = await hre.companionNetworks.l1.deployments.get("HubPool");

  await hre.deployments.deploy("PolygonTokenBridger", {
    from: deployer,
    log: true,
    skipIfAlreadyDeployed: true,
    args: [
      l1HubPool.address,
      L1_ADDRESS_MAP[hubChainId].polygonRegistry,
      WETH[hubChainId],
      WMATIC[spokeChainId],
      hubChainId,
      spokeChainId,
    ],
    deterministicDeployment: "0x1234", // Salt for the create2 call.
  });
};

module.exports = func;
func.tags = ["PolygonTokenBridgerL2", "polygon"];
