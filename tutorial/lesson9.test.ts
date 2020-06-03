import { ethers } from "ethers";
import { bigNumberify } from "ethers/utils";
import {
  Channel,
  getChannelId,
  State,
  getVariablePart,
  getFixedPart,
  signStates,
  signState,
  SignedState,
} from "@statechannels/nitro-protocol";
import { HashZero } from "ethers/constants";
import { signChallengeMessage } from "@statechannels/nitro-protocol/lib/src/signatures";
import { channelDataToChannelStorageHash } from "@statechannels/nitro-protocol/src/contract/channel-storage";

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

it("Lesson 9: Clear a challenge using respond", async () => {
  /* BEGIN TEST SETUP, to put the chain in a challenge mode */
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
  await (
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
  /* END TEST SETUP */
  /* BEGIN Lesson 9 proper */

  largestTurnNum += 1;
  const responseState: State = {
    turnNum: largestTurnNum,
    isFinal: false,
    channel,
    outcome: [],
    appDefinition: process.env.TRIVIAL_APP_ADDRESS,
    appData: HashZero,
    challengeDuration,
  };

  const responder = wallets[0];
  const responseSignature = await signState(responseState, responder.privateKey)
    .signature;
  const isFinalAB = [false, false];
  const variablePartAB = [
    getVariablePart(challengeSignedState.state),
    getVariablePart(responseState),
  ];

  const tx = NitroAdjudicator.respond(
    challenger.address,
    isFinalAB,
    fixedPart,
    variablePartAB,
    responseSignature
  );
  await (await tx).wait();

  const expectedChannelStorageHash = channelDataToChannelStorageHash({
    turnNumRecord: largestTurnNum,
    finalizesAt: 0x1, // FIXME
  });

  // Check channelStorageHash against the expected value
  expect(await NitroAdjudicator.channelStorageHashes(channelId)).toEqual(
    expectedChannelStorageHash
  );
});
