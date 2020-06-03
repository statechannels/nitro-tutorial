import { ethers } from "ethers";
import { bigNumberify } from "ethers/utils";
import {
  Channel,
  State,
  getFixedPart,
  hashOutcome,
  signStates,
} from "@statechannels/nitro-protocol";
import { AddressZero, HashZero } from "ethers/constants";
import { hashAppPart } from "@statechannels/nitro-protocol";

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

it("Lesson 6: Conclude a channel (happy)", async () => {
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
    isFinal: false, // FIXME
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
  const tx = NitroAdjudicator.conclude(
    largestTurnNum,
    fixedPart,
    appPartHash,
    outcomeHash,
    numStates,
    whoSignedWhat,
    sigs
  );
  await (await tx).wait();
});
