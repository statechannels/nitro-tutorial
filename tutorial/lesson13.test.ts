import { ethers } from "ethers";
import { bigNumberify } from "ethers/utils";
import {
  Channel,
  State,
  signStates,
  getFixedPart,
  hashOutcome,
  getChannelId,
  encodeOutcome,
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
} = require("@statechannels/nitro-protocol").ContractArtifacts;

const NitroAdjudicator = new ethers.Contract(
  process.env.NITRO_ADJUDICATOR_ADDRESS,
  NitroAdjudicatorArtifact.abi,
  provider.getSigner(0)
);

it("Lesson 13: Call pushOutcome", async () => {
  // BEGIN LESSON SETUP
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

  const state: State = {
    isFinal: true,
    channel,
    outcome: [],
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
  // END LESSON SETUP
  // BEGIN LESSON 13 proper

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

  const channelId = getChannelId(channel);
  const turnNumRecord = largestTurnNum; // FIXME
  // const turnNumRecord = 0; // Always 0 for a happy conclude
  const finalizesAt = (await provider.getBlock(receipt.blockNumber)).timestamp;
  const stateHash = HashZero; // Reset in a happy conclude
  const challengerAddress = AddressZero; // Reset in a happy conclude
  const outcomeBytes = encodeOutcome(state.outcome);

  const tx1 = NitroAdjudicator.pushOutcome(
    channelId,
    turnNumRecord,
    finalizesAt,
    stateHash,
    challengerAddress,
    outcomeBytes
  );

  await (await tx1).wait();
});
