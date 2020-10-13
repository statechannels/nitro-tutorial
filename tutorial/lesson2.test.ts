/* Import ethereum wallet utilities  */
import { ethers } from "ethers";

/* Import statechannels wallet utilities  */
import { Channel, State, getVariablePart } from "@statechannels/nitro-protocol";

/* Set up an ethereum provider connected to our local blockchain */
const provider = new ethers.providers.JsonRpcProvider(
  `http://localhost:${process.env.GANACHE_PORT}`
);

/* 
  The NitroAdjudicator contract has already been compiled and will be automatically deployed to a local blockchain.
  Import the compilation artifact so we can use the ABI to 'talk' to the deployed contract
*/
const {
  NitroAdjudicatorArtifact,
} = require("@statechannels/nitro-protocol").ContractArtifacts;
const NitroAdjudicator = new ethers.Contract(
  process.env.NITRO_ADJUDICATOR_ADDRESS,
  NitroAdjudicatorArtifact.abi,
  provider.getSigner(0)
);

it("Lesson 2: Conform to an on chain validTransition function", async () => {
  const channel: Channel = {
    participants: [
      ethers.Wallet.createRandom().address,
      ethers.Wallet.createRandom().address,
    ],
    chainId: "0x1234",
    channelNonce: 0,
  };

  /* Construct a state */
  const fromState: State = {
    channel,
    outcome: [],
    turnNum: 0,
    isFinal: false,
    challengeDuration: 0x0,
    appDefinition: process.env.TRIVIAL_APP_ADDRESS,
    appData: "0x00",
  };

  /* Construct another state */
  const toState: State = { ...fromState, turnNum: 1, appData: "0x1" }; // FIXME

  /* 
    Check validity of transition from one state to the other
    using on chain function
  */
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
