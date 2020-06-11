/* Import ethereum wallet utilities  */
import { ethers } from "ethers";
import { bigNumberify, hexlify } from "ethers/utils";
import { HashZero } from "ethers/constants";

/* Import statechannels wallet utilities  */
import {
  Channel,
  getChannelId,
  State,
  getVariablePart,
  getFixedPart,
  signStates,
  SignedState,
  signState,
  signChallengeMessage,
} from "@statechannels/nitro-protocol";

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

it("Lesson 10: Scrape vital information from a ChallengeRegistered event", async () => {
  /* BEGIN TEST SETUP, prepare a forceMove transaction */
  let largestTurnNum = 8;
  const isFinalCount = 0;
  const participants = [];
  const wallets: ethers.Wallet[] = [];
  for (let i = 0; i < 3; i++) {
    wallets[i] = ethers.Wallet.createRandom();
    participants[i] = wallets[i].address;
  }
  const chainId = "0x1234";
  const challengeDuration = 1e12; // a long time in the future
  const channelNonce = bigNumberify(0).toHexString();
  const channel: Channel = { chainId, channelNonce, participants };
  const channelId = getChannelId(channel);
  let appDatas = [0, 1, 2];
  let whoSignedWhat = [0, 1, 2];
  let states: State[] = appDatas.map((data, idx) => ({
    turnNum: largestTurnNum - appDatas.length + 1 + idx,
    isFinal: idx > appDatas.length - isFinalCount,
    channel,
    challengeDuration,
    outcome: [],
    appDefinition: process.env.TRIVIAL_APP_ADDRESS,
    appData: HashZero,
  }));
  let variableParts = states.map((state) => getVariablePart(state));
  let fixedPart = getFixedPart(states[0]);
  const challenger = wallets[1];
  let signatures = await signStates(states, wallets, whoSignedWhat);
  const challengeSignedState: SignedState = signState(
    states[states.length - 1],
    challenger.privateKey
  );
  const challengeSignature = signChallengeMessage(
    [challengeSignedState],
    challenger.privateKey
  );

  /* END TEST SETUP */
  /* BEGIN Lesson 10 proper */

  /* Submit a forceMove transaction, and keep the receipt */
  const receipt = await (
    await NitroAdjudicator.forceMove(
      fixedPart,
      largestTurnNum,
      variableParts,
      isFinalCount,
      signatures,
      whoSignedWhat,
      challengeSignature
    )
  ).wait();

  /* Catch ForceMove event */
  const event = receipt.events.pop();
  const {
    channelId: eventChannelId,
    turnNumRecord: eventTurnNumRecord,
    finalizesAt: eventFinalizesAt,
    challenger: eventChallenger,
    isFinal: eventIsFinal,
    fixedPart: eventFixedPart,
    variableParts: eventVariableParts,
  } = event.args;

  // Check this information is enough to respond
  expect(eventChannelId).toEqual(channelId);
  expect(eventTurnNumRecord._hex).toEqual(hexlify(largestTurnNum));
  expect(eventChallenger).toEqual(challenger.address);
  expect(eventFixedPart[0]._hex).toEqual(hexlify(fixedPart.chainId));
  expect(eventFixedPart[1]).toEqual(fixedPart.participants);
  expect(eventFixedPart[2]._hex).toEqual(hexlify(fixedPart.channelNonce));
  expect(eventFixedPart[3]).toEqual(fixedPart.appDefinition);
  expect(eventFixedPart[4]._hex).toEqual(hexlify(fixedPart.challengeDuration));
  expect(eventIsFinal).toEqual(isFinalCount > 0);
  expect(eventVariableParts[eventVariableParts.length - 1][0]).toEqual(
    variableParts[variableParts.length - 1].outcome
  );
  expect(eventVariableParts[eventVariableParts.length - 1][1]).toEqual(
    variableParts[variableParts.length - 1].appData
  );
  expect(bigNumberify(eventFinalizesAt._hex).isZero()).toBe(true); // FIXME
  // expect(bigNumberify(eventFinalizesAt._hex).gt(0)).toBe(true);
});
