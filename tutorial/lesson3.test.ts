import { ethers } from "ethers";
import { bigNumberify } from "ethers/utils";
import {
  Channel,
  Outcome,
  State,
  getFixedPart,
  getVariablePart,
} from "@statechannels/nitro-protocol";

it("Lesson 3: Form a State with the correct format", async () => {
  const participants = [];
  for (let i = 0; i < 3; i++) {
    participants[i] = ethers.Wallet.createRandom().address;
  }
  const chainId = "0x1234";
  const channelNonce = bigNumberify(0).toHexString();
  const channel: Channel = { chainId, channelNonce, participants };

  const outcome: Outcome = [];

  const state: State = {
    turnNum: 0,
    isFinal: true, // FIXME
    channel,
    challengeDuration: 1,
    outcome,
    appDefinition: "0x0",
    appData: "0x0",
  };

  expect(state.isFinal).toBe(false);

  const fixedPart = getFixedPart(state);
  const variablePart = getVariablePart(state);

  expect(fixedPart).toBeTruthy;
  expect(variablePart).toBeTruthy;
});
