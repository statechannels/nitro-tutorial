import { ethers } from "ethers";
import { bigNumberify, hexZeroPad } from "ethers/utils";
import {
  Channel,
  State,
  signStates,
  getFixedPart,
  hashOutcome,
  getChannelId,
  encodeOutcome,
  AllocationAssetOutcome,
} from "@statechannels/nitro-protocol";
import { AddressZero, HashZero } from "ethers/constants";
import { hashAppPart } from "@statechannels/nitro-protocol/lib/src/contract/state";

// Set up an ethereum provider connected to our local blockchain
const provider = new ethers.providers.JsonRpcProvider(
  `http://localhost:${process.env.GANACHE_PORT}`
);

// The contract has already been compiled and will be automatically deployed to a local blockchain
// Import the compilation artifact so we can use the ABI to 'talk' to the deployed contract
const {
  NitroAdjudicatorArtifact,
  EthAssetHolderArtifact,
} = require("@statechannels/nitro-protocol").ContractArtifacts;
const ETHAssetHolder = new ethers.Contract(
  process.env.ETH_ASSET_HOLDER_ADDRESS,
  EthAssetHolderArtifact.abi,
  provider.getSigner(0)
);

const NitroAdjudicator = new ethers.Contract(
  process.env.NITRO_ADJUDICATOR_ADDRESS,
  NitroAdjudicatorArtifact.abi,
  provider.getSigner(0)
);

it("Lesson 14: Call transferAll", async () => {
  // BEGIN LESSON SETUP
  const amount = "0x03";

  const EOA = ethers.Wallet.createRandom().address;
  const destination = hexZeroPad(EOA, 32);

  const assetOutcome: AllocationAssetOutcome = {
    assetHolderAddress: process.env.ETH_ASSET_HOLDER_ADDRESS,
    allocationItems: [{ destination, amount }],
  };

  const whoSignedWhat = [0, 0, 0];
  const largestTurnNum = 4;
  const participants = [];
  const wallets: ethers.Wallet[] = [];
  for (let i = 0; i < 3; i++) {
    wallets[i] = ethers.Wallet.createRandom();
    participants[i] = wallets[i].address;
  }
  const chainId = "0x1234";
  const channelNonce = bigNumberify(0).toHexString();
  const channel: Channel = { chainId, channelNonce, participants };
  const channelId = getChannelId(channel);

  /*
      Attempt to deposit 1 wei against the channel id we created.
      Inspect the error message in the console for a hint about the bug on the next line 
    */
  const tx0 = ETHAssetHolder.deposit(channelId, 0, amount, {
    value: amount,
  });

  await (await tx0).wait();

  const state: State = {
    isFinal: true,
    channel,
    outcome: [assetOutcome],
    appDefinition: AddressZero,
    appData: HashZero,
    challengeDuration: 1,
    turnNum: largestTurnNum,
  };

  // Sign the states
  const sigs = await signStates([state], wallets, whoSignedWhat);

  /*
   * Conclude
   */
  const numStates = 1;
  const fixedPart = getFixedPart(state);
  const appPartHash = hashAppPart(state);
  const outcomeHash = hashOutcome(state.outcome);

  const tx1 = NitroAdjudicator.conclude(
    largestTurnNum,
    fixedPart,
    appPartHash,
    outcomeHash,
    numStates,
    whoSignedWhat,
    sigs
  );
  const receipt = await (await tx1).wait();

  const turnNumRecord = 0; // Always 0 for a happy conclude
  const finalizesAt = (await provider.getBlock(receipt.blockNumber)).timestamp;
  const stateHash = HashZero; // Reset in a happy conclude
  const challengerAddress = AddressZero; // Reset in a happy conclude
  const outcomeBytes = encodeOutcome(state.outcome);

  const tx2 = NitroAdjudicator.pushOutcome(
    channelId,
    turnNumRecord,
    finalizesAt,
    stateHash,
    challengerAddress,
    outcomeBytes
  );

  await (await tx2).wait();

  // END LESSON SETUP

  // BEGIN LESSON 14 proper

  const tx3 = ETHAssetHolder.transferAll(
    channelId,
    HashZero // FIXME
    // encodeAllocation(assetOutcome.allocationItems)
  );

  const { events } = await (await tx3).wait();

  expect(events).toMatchObject([
    {
      event: "AssetTransferred",
      args: {
        channelId,
        destination: destination.toLowerCase(),
        amount: { _hex: amount },
      },
    },
  ]);

  expect(bigNumberify(await provider.getBalance(EOA)).eq(bigNumberify(amount)));
});
