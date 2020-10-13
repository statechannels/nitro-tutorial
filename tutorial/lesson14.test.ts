/* Import ethereum wallet utilities  */
import { BigNumber, ethers } from "ethers";
const { hexZeroPad } = ethers.utils;
const { AddressZero, HashZero } = ethers.constants;

/* Import statechannels wallet utilities  */
import {
  Channel,
  State,
  signStates,
  getFixedPart,
  hashOutcome,
  getChannelId,
  encodeOutcome,
  AllocationAssetOutcome,
  hashAppPart,
} from "@statechannels/nitro-protocol";

/* Set up an ethereum provider connected to our local blockchain */
const provider = new ethers.providers.JsonRpcProvider(
  `http://localhost:${process.env.GANACHE_PORT}`
);

/* 
  The NitroAdjudicator and EthAssetHolder contracts have already been compiled and will be automatically deployed to a local blockchain.
  Import the compilation artifact so we can use the ABI to 'talk' to the deployed contract
*/
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
  /* 
    Following earlier tutorials ...
    tx0 fund a channel
    tx1 conclude this channel with this outcome
    tx2 pushOutcome to the ETH_ASSET_HOLDER
    ...
  */
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
  const channelNonce = 0;
  const channel: Channel = { chainId, channelNonce, participants };
  const channelId = getChannelId(channel);
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
  const sigs = await signStates([state], wallets, whoSignedWhat);
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

  /* Submit a transferAll transaction */
  const tx3 = ETHAssetHolder.transferAll(
    channelId,
    HashZero // FIXME
    // encodeAllocation(assetOutcome.allocationItems)
  );

  /* 
    Check that an AssetTransferred event was emitted.
  */
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

  expect(
    BigNumber.from(await provider.getBalance(EOA)).eq(BigNumber.from(amount))
  );
});
