/* Import ethereum wallet utilities  */
import { ethers } from "ethers";
const { HashZero } = ethers.constants;

/* Import statechannels wallet utilities  */
import {
  Channel,
  State,
  getVariablePart,
  getFixedPart,
  signStates,
  SignedState,
  signState,
  signChallengeMessage,
} from "@statechannels/nitro-protocol";

/* Set up an ethereum provider connected to our local blockchain */ const provider = new ethers.providers.JsonRpcProvider(
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

it("Lesson 7: Register a challenge using forceMove", async () => {
  const participants = [];
  const wallets: ethers.Wallet[] = [];
  for (let i = 0; i < 3; i++) {
    wallets[i] = ethers.Wallet.createRandom();
    participants[i] = wallets[i].address;
  }
  const chainId = "0x1234";
  const channelNonce = 0;
  const channel: Channel = { chainId, channelNonce, participants };

  /* Choose a challenger */
  const challenger = ethers.Wallet.createRandom(); // FIXME
  // const challenger = wallets[0];

  /* Construct a progression of states */
  const largestTurnNum = 8;
  const isFinalCount = 0;
  const appDatas = [0, 1, 2];
  const states: State[] = appDatas.map((data, idx) => ({
    turnNum: largestTurnNum - appDatas.length + 1 + idx,
    isFinal: idx > appDatas.length - isFinalCount,
    channel,
    challengeDuration: 1,
    outcome: [],
    appDefinition: process.env.TRIVIAL_APP_ADDRESS,
    appData: HashZero,
  }));

  /* Construct a support proof */
  const whoSignedWhat = [0, 1, 2];
  const signatures = await signStates(states, wallets, whoSignedWhat);

  /* Form the challengeSignature */
  const challengeSignedState: SignedState = signState(
    states[states.length - 1],
    challenger.privateKey
  );
  const challengeSignature = signChallengeMessage(
    [challengeSignedState],
    challenger.privateKey
  );

  /* Submit the forceMove transaction */
  const variableParts = states.map((state) => getVariablePart(state));
  const fixedPart = getFixedPart(states[0]);

  const tx = NitroAdjudicator.forceMove(
    fixedPart,
    largestTurnNum,
    variableParts,
    isFinalCount,
    signatures,
    whoSignedWhat,
    challengeSignature
  );
  await (await tx).wait();
});
