/* Import ethereum wallet utilities  */
import { ethers } from "ethers";
const { AddressZero, HashZero } = ethers.constants;

/* Import statechannels wallet utilities  */
import {
  Channel,
  Outcome,
  State,
  getFixedPart,
  getVariablePart,
  encodeOutcome,
} from "@statechannels/nitro-protocol";

it("Lesson 1: Form a State with the correct format", async () => {
  /* Form the participants array */
  const participants = [];
  for (let i = 0; i < 3; i++) {
    participants[i] = ethers.Wallet.createRandom().address;
  }

  /* Mock out a chainId: this could be '1' for mainnet or '3' for ropsten */
  const chainId = "0x1234";

  /* 
    Define the channelNonce 
    :~ how many times have these participants
    already run a channel on this chain?
  */
  const channelNonce = 0;

  /* 
    Define the challengeDuration 
    :~ how long should participants get to respond to challenges?
  */
  const challengeDuration = 1;

  /* 
    Mock out the appDefinition and appData.
    We will get to these later in the tutorial
  */
  const appDefinition = AddressZero;
  const appData = HashZero;

  /* Construct a Channel object */
  const channel: Channel = { chainId, channelNonce, participants };

  /* Mock out an outcome */
  const outcome: Outcome = [];

  /* Putting it all together */
  const state: State = {
    turnNum: 0,
    isFinal: true, // FIXME
    channel,
    challengeDuration,
    outcome,
    appDefinition,
    appData,
  };

  /* Final states are covered later in the tutorial */
  expect(state.isFinal).toBe(false);

  /* Extract fixed and variable parts */
  const fixedPart = getFixedPart(state);
  const variablePart = getVariablePart(state);

  expect(fixedPart).toEqual({
    appDefinition,
    chainId,
    challengeDuration,
    channelNonce,
    participants,
  });
  expect(variablePart).toEqual({
    appData,
    outcome: encodeOutcome(outcome),
  });
});
