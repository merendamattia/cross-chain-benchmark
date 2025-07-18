import { getContractFactory, ethers } from "../utils/utils";
import { readFileSync } from "fs";
import path from "path";
import { getNodeUrl } from "@uma/common";
import { hre } from "../utils/utils.hre";

const RECIPIENTS_CHUNK_SIZE = 100; // TODO: Still need to figure out which size is optimal

/**
 * Script to airdrop ERC1155 tokens to a list of recipients. The list of recipients need to be passed via a JSON file.
 * ```
 * TOKEN_ID=<TOKEN_ID> \
 * RECIPIENTS=<PATH> \
 * SKIP=<NUMBER> \
 * yarn hardhat run ./scripts/mintERC1155.ts --network polygon-mumbai
 * ```
 */
async function main() {
  const tokenId = parseInt(process.env.TOKEN_ID || "0");
  const skip = parseInt(process.env.SKIP || "0");
  const validRecipients = await parseAndValidateRecipients();

  const [signer] = await ethers.getSigners();

  const erc1155Deployment = await hre.deployments.get("MintableERC1155");
  const erc1155 = (await getContractFactory("MintableERC1155", { signer })).attach(erc1155Deployment.address);

  for (let i = skip; i < validRecipients.length; i = i + RECIPIENTS_CHUNK_SIZE) {
    const recipientsChunk = validRecipients.slice(i, i + RECIPIENTS_CHUNK_SIZE);
    console.log(`\nProcessing recipients in index range ${i} - ${i + RECIPIENTS_CHUNK_SIZE - 1}:`, {
      first: recipientsChunk[0],
      last: recipientsChunk[recipientsChunk.length - 1],
      numRecipients: recipientsChunk.length,
    });

    const balanceOfBatch = await erc1155.balanceOfBatch(recipientsChunk, Array(recipientsChunk.length).fill(tokenId));

    const alreadyMintedRecipients = recipientsChunk.filter((_, i) => balanceOfBatch[i].gt(0));
    const recipientsToMint = recipientsChunk.filter((_, i) => balanceOfBatch[i].eq(0));

    if (alreadyMintedRecipients.length > 0) {
      console.log(`Skipping ${alreadyMintedRecipients.length} already minted recipients...`);
    }

    if (recipientsToMint.length === 0) {
      console.log(`No recipients to mint for. Skipping chunk...`);
      continue;
    }

    console.log(`Minting token with id ${tokenId} to ${recipientsToMint.length} recipients...`);
    const airdropTx = await erc1155.airdrop(tokenId, recipientsToMint, 1);
    console.log("Tx hash:", airdropTx.hash);
    await airdropTx.wait();
    console.log(`Successfully minted token to ${recipientsToMint.length} recipients in chunk`);
  }
}

async function parseAndValidateRecipients() {
  const provider = new ethers.providers.JsonRpcProvider(getNodeUrl("mainnet", true, 1));

  if (!process.env.RECIPIENTS) {
    throw new Error("Missing path to a JSON file with the list of recipients. Pass it via env var RECIPIENTS=<PATH>");
  }
  const recipientsFilePath = path.join(__dirname, "..", process.env.RECIPIENTS);
  const recipientsFromFile: string[] = JSON.parse(readFileSync(recipientsFilePath, "utf8"));

  const resolvedRecipients = await Promise.all(
    recipientsFromFile.map(async (r) => {
      if (r.toLocaleLowerCase().endsWith(".eth")) {
        try {
          const resolvedAddress = await provider.resolveName(r);
          if (!resolvedAddress) {
            throw new Error(`Could not resolve ENS name: ${r}`);
          }
          return resolvedAddress;
        } catch (error) {
          console.error(error);
          throw new Error(`Could not resolve ENS name: ${r}`);
        }
      }
      return Promise.resolve(r);
    })
  );

  const invalidRecipients = resolvedRecipients.filter((r) => !ethers.utils.isAddress(r));

  if (invalidRecipients.length > 0) {
    throw new Error(`Invalid recipients: ${invalidRecipients}`);
  }

  const duplicateAddresses = getDuplicateAddresses(resolvedRecipients);
  if (duplicateAddresses.length > 0) {
    throw new Error(`Recipients list contains duplicates ${Array.from(duplicateAddresses)}`);
  }

  return resolvedRecipients.map((r) => ethers.utils.getAddress(r));
}

function getDuplicateAddresses(addresses: string[]) {
  const checksummedAddresses = addresses.map((address) => ethers.utils.getAddress(address));
  return checksummedAddresses.filter((item, index) => checksummedAddresses.indexOf(item) !== index);
}

main().then(
  () => console.log("\nDone"),
  (error) => {
    console.log(error);
    process.exitCode = 1;
  }
);
