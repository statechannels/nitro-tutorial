/* Import ethereum wallet utilities  */
import { ethers } from "ethers";
const { HashZero } = ethers.constants;

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
  channelDataToChannelStorageHash,
} from "@statechannels/nitro-protocol";
import { ChannelData } from "@statechannels/nitro-protocol/lib/src/contract/channel-storage";

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

it("Lesson 8: Clear a challenge using checkpoint", async () => {
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
  const channelNonce = 0;
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
  const challenger = wallets[0];
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
  /* BEGIN Lesson 8 proper */

  /* Form a progression of states */
  const numRounds = 2; // FIXME
  largestTurnNum = 3 * numRounds;
  appDatas = [largestTurnNum - 2, largestTurnNum - 1, largestTurnNum];
  states = appDatas.map((data, idx) => ({
    turnNum: largestTurnNum - appDatas.length + 1 + idx,
    isFinal: false,
    channel,
    challengeDuration,
    outcome: [],
    appDefinition: process.env.TRIVIAL_APP_ADDRESS,
    appData: HashZero,
  }));
  whoSignedWhat = [2, 0, 1];
  signatures = await signStates(states, wallets, whoSignedWhat);

  /* Submit a checkpoint transaction */
  const tx = NitroAdjudicator.checkpoint(
    fixedPart,
    largestTurnNum,
    variableParts,
    isFinalCount,
    signatures,
    whoSignedWhat
  );

  await (await tx).wait();

  /* 
    Form an expectation about the new state of the chain:
  */
  const channelData: ChannelData = {
    turnNumRecord: largestTurnNum,
    finalizesAt: 0x0,
  };
  const expectedChannelStorageHash = channelDataToChannelStorageHash(
    channelData
  );

  /* 
    Check channelStorageHash against the expected value (it is a public mapping)
  */
  expect(await NitroAdjudicator.channelStorageHashes(channelId)).toEqual(
    expectedChannelStorageHash
  );
});
