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
  GuaranteeAssetOutcome,
  encodeAllocation,
  hashAppPart,
  encodeGuarantee,
} from "@statechannels/nitro-protocol";
import { AddressZero, HashZero } from "ethers/constants";

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

it("Lesson 15: Call claimAll", async () => {
  // BEGIN LESSON SETUP
  const amount = "0x03";
  const EOA1 = ethers.Wallet.createRandom().address;
  const EOA2 = ethers.Wallet.createRandom().address;
  const destination1 = hexZeroPad(EOA1, 32);
  const destination2 = hexZeroPad(EOA2, 32);

  const assetOutcomeForTheTargetChannel: AllocationAssetOutcome = {
    assetHolderAddress: process.env.ETH_ASSET_HOLDER_ADDRESS,
    allocationItems: [
      { destination: destination1, amount },
      { destination: destination2, amount },
    ],
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
  const targetChannel: Channel = { chainId, channelNonce, participants };
  const targetChannelId = getChannelId(targetChannel);

  // Finalise and pushOutcome for target channel
  const state: State = {
    isFinal: true,
    channel: targetChannel,
    outcome: [assetOutcomeForTheTargetChannel],
    appDefinition: AddressZero,
    appData: HashZero,
    challengeDuration: 1,
    turnNum: largestTurnNum,
  };
  let sigs = await signStates([state], wallets, whoSignedWhat);
  let numStates = 1;
  let fixedPart = getFixedPart(state);
  let appPartHash = hashAppPart(state);
  let outcomeHash = hashOutcome(state.outcome);

  const tx0 = NitroAdjudicator.conclude(
    largestTurnNum,
    fixedPart,
    appPartHash,
    outcomeHash,
    numStates,
    whoSignedWhat,
    sigs
  );
  const receipt = await (await tx0).wait();
  let turnNumRecord = 0; // Always 0 for a happy conclude
  let finalizesAt = (await provider.getBlock(receipt.blockNumber)).timestamp;
  let stateHash = HashZero; // Reset in a happy conclude
  let challengerAddress = AddressZero; // Reset in a happy conclude
  let outcomeBytes = encodeOutcome(state.outcome);
  const tx1 = NitroAdjudicator.pushOutcome(
    targetChannelId,
    turnNumRecord,
    finalizesAt,
    stateHash,
    challengerAddress,
    outcomeBytes
  );
  await (await tx1).wait();

  // Finalise and pushOutcome for the guarantor channel

  const assetOutcomeForTheGuarantorChannel: GuaranteeAssetOutcome = {
    assetHolderAddress: process.env.ETH_ASSET_HOLDER_ADDRESS,
    guarantee: {
      targetChannelId: targetChannelId,
      destinations: [
        destination2,
        destination1, // Note reversed order
      ],
    },
  };

  const guarantorChannel: Channel = {
    chainId,
    channelNonce: channelNonce + 1,
    participants,
  };
  const guarantorChannelId = getChannelId(guarantorChannel);
  const stateForGuarantorChannel: State = {
    isFinal: true,
    channel: guarantorChannel,
    outcome: [assetOutcomeForTheGuarantorChannel],
    appDefinition: AddressZero,
    appData: HashZero,
    challengeDuration: 1,
    turnNum: largestTurnNum,
  };
  sigs = await signStates([stateForGuarantorChannel], wallets, whoSignedWhat);
  numStates = 1;
  fixedPart = getFixedPart(stateForGuarantorChannel);
  appPartHash = hashAppPart(stateForGuarantorChannel);
  outcomeHash = hashOutcome(stateForGuarantorChannel.outcome);

  const tx2 = NitroAdjudicator.conclude(
    largestTurnNum,
    fixedPart,
    appPartHash,
    outcomeHash,
    numStates,
    whoSignedWhat,
    sigs
  );
  const receiptFortx2 = await (await tx2).wait();
  turnNumRecord = 0; // Always 0 for a happy conclude
  finalizesAt = (await provider.getBlock(receiptFortx2.blockNumber)).timestamp;
  stateHash = HashZero; // Reset in a happy conclude
  challengerAddress = AddressZero; // Reset in a happy conclude
  outcomeBytes = encodeOutcome(stateForGuarantorChannel.outcome);
  const tx3 = NitroAdjudicator.pushOutcome(
    guarantorChannelId,
    turnNumRecord,
    finalizesAt,
    stateHash,
    challengerAddress,
    outcomeBytes
  );
  await (await tx3).wait();

  const tx4 = ETHAssetHolder.deposit(guarantorChannelId, 0, amount, {
    value: amount,
  });

  await (await tx4).wait();

  // END LESSON SETUP

  // BEGIN LESSON 15 proper

  // FIXME
  const tx5 = ETHAssetHolder.claimAll(
    guarantorChannelId,
    encodeAllocation(assetOutcomeForTheTargetChannel.allocationItems),
    encodeGuarantee(assetOutcomeForTheGuarantorChannel.guarantee)
  );

  // const tx5 = ETHAssetHolder.claimAll(
  //   guarantorChannelId,
  //   encodeGuarantee(assetOutcomeForTheGuarantorChannel.guarantee),
  //   encodeAllocation(assetOutcomeForTheTargetChannel.allocationItems)
  // );

  const { events } = await (await tx5).wait();

  expect(events).toMatchObject([
    {
      event: "AssetTransferred",
      args: {
        channelId: guarantorChannelId,
        destination: destination2.toLowerCase(),
        amount: { _hex: amount },
      },
    },
  ]);

  expect(
    bigNumberify(await provider.getBalance(EOA2)).eq(bigNumberify(amount))
  );
});
