import { ethers } from "ethers";
import { Channel, State, getVariablePart } from "@statechannels/nitro-protocol";

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

it("Lesson 4: Conform to an on chain validTransition function", async () => {
  const channel: Channel = {
    participants: [
      ethers.Wallet.createRandom().address,
      ethers.Wallet.createRandom().address,
    ],
    chainId: "0x1",
    channelNonce: "0x1",
  };

  const fromState: State = {
    channel,
    outcome: [],
    turnNum: 0,
    isFinal: false,
    challengeDuration: 0x0,
    appDefinition: process.env.TRIVIAL_APP_ADDRESS,
    appData: "0x0",
  };
  const toState: State = { ...fromState, turnNum: 1, appData: "0x1" }; // FIXME

  expect(
    await NitroAdjudicator.validTransition(
      channel.participants.length,
      [fromState.isFinal, toState.isFinal],
      [getVariablePart(fromState), getVariablePart(toState)],
      toState.turnNum, // We only get to submit one turn number so cannot check validity
      // If incorrect, transactions will fail during a check on state signatures
      fromState.appDefinition
    )
  ).toBe(true);
});
