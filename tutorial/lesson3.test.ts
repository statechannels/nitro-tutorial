import { ethers } from "ethers";
import { bigNumberify } from "ethers/utils";
import {
  Channel,
  State,
  signStates,
  getFixedPart,
  getVariablePart,
} from "@statechannels/nitro-protocol";
// Set up an ethereum provider connected to our local blockchain
const provider = new ethers.providers.JsonRpcProvider(
  `http://localhost:${process.env.GANACHE_PORT}`
);

import { AddressZero, HashZero } from "ethers/constants";
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

it("Lesson 3: Support a state with signatures", async () => {
  const numStates = 3;
  const whoSignedWhat = [0, 1, 2];
  const largestTurnNum = 2;
  const participants = [];
  const wallets: ethers.Wallet[] = [];
  for (let i = 0; i < 3; i++) {
    wallets[i] = ethers.Wallet.createRandom();
    participants[i] = wallets[i].address;
  }
  const chainId = "0x1234";
  const channelNonce = bigNumberify(0).toHexString();
  const channel: Channel = { chainId, channelNonce, participants };

  const states: State[] = [];
  for (let i = 1; i <= numStates; i++) {
    states.push({
      isFinal: false,
      channel,
      outcome: [],
      appDefinition: AddressZero,
      appData: HashZero,
      challengeDuration: 1,
      turnNum: largestTurnNum + i - numStates,
    });
  }

  // Sign the states
  const sigs = await signStates(states, wallets, whoSignedWhat);

  sigs.reverse(); // FIXME

  /*
   * Use the checkpoint method to test our signatures
   * Tx will revert if they are incorrect
   */
  const fixedPart = getFixedPart(states[0]);
  const variableParts = states.map((s) => getVariablePart(s));
  const isFinalCount = states.filter((s) => s.isFinal).length;

  const tx = NitroAdjudicator.checkpoint(
    fixedPart,
    largestTurnNum,
    variableParts,
    isFinalCount,
    sigs,
    whoSignedWhat
  );
  await (await tx).wait();
});
