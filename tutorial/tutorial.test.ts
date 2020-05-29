// Import Ethereum utilities
import { Contract, Wallet, ethers } from "ethers";
import { bigNumberify, parseUnits, id } from "ethers/utils";
import {
  getTestProvider,
  setupContracts,
  randomChannelId,
  State,
  Outcome,
  getVariablePart,
  getFixedPart,
  validTransition,
  signState,
  hashOutcome,
  SignedState,
} from "@statechannels/nitro-protocol";
const getDepositedEvent = (events) =>
  events.find(({ event }) => event === "Deposited").args;

// The contract has already been compiled and will be automatically deployed to a local blockchain
// Import the compilation artifact so we can use the ABI to 'talk' to the deployed contract
const {
  NitroAdjudicatorArtifact,
  EthAssetHolderArtifact,
} = require("@statechannels/nitro-protocol").ContractArtifacts;
let ETHAssetHolder: Contract;
let NitroAdjudicator: Contract;

// Import state channels utilities
import { Channel, getChannelId } from "@statechannels/nitro-protocol";
import { signStates } from "@statechannels/nitro-protocol/lib/test/test-helpers";
import { HashZero, AddressZero } from "ethers/constants";

// TODO hoist these up to the module export in nitro-protocol
import { hashAppPart } from "@statechannels/nitro-protocol/lib/src/contract/state";
import { signChallengeMessage } from "@statechannels/nitro-protocol/lib/src/signatures";
import { channelDataToChannelStorageHash } from "@statechannels/nitro-protocol/src/contract/channel-storage";

// Set up an interface to the deployed Asset Holder Contract
beforeAll(async () => {
  const provider = getTestProvider();
  ETHAssetHolder = await setupContracts(
    provider,
    EthAssetHolderArtifact,
    process.env.ETH_ASSET_HOLDER_ADDRESS
  );
  NitroAdjudicator = await setupContracts(
    provider,
    NitroAdjudicatorArtifact,
    process.env.NITRO_ADJUDICATOR_ADDRESS
  );
});

describe("Tutorial", () => {
  /*
    YOUR TUTORIAL STARTS HERE
    The code above is mostly boilerplate to setup an environment to interact with
    some contracts that were automatically deployed to a local blockchain for you.
  */

  it("Lesson 1: construct a Channel and compute its id", async () => {
    /*
      Construct an array of three participants, using standard ethereum accounts
    */
    const participants = [];
    for (let i = 0; i < 3; i++) {
      participants[i] = Wallet.createRandom().address;
    }

    /*
      As this is only a tutorial, we will target a made-up chain
    */
    const chainId = "0x1234";

    /* 
      The channel nonce prevents replay attacks from previous channels
      It should be unique for a fixed set of participants and chainId
      It should be formatted as a hex string 
    */
    const channelNonce = bigNumberify(0).toHexString();

    // const channelId = "fixme"; // FIX ME

    /* 
      Uncomment the lines below to use the imported helper function to compute the channel id.
      Feel free to take a look at the implementation of that helper 
    */

    const channel: Channel = { chainId, channelNonce, participants };
    const channelId = getChannelId(channel);

    /* 
      Expectations around the format of the channel Id:
    */
    expect(channelId.slice(0, 2)).toEqual("0x");
    expect(channelId).toHaveLength(66);
  });

  it("Lesson 2: depositing into the ETH asset holder", async () => {
    /*
      Get an appropriate representation of 1 wei, and
      use one of our helpers to quickly create a random channel id
    */
    const held = parseUnits("1", "wei");
    const channelId = randomChannelId();

    /*
      Attempt to deposit 1 wei against the channel id we created.
      Inspect the error message in the console for a hint about the bug on the next line 
    */
    const tx0 = ETHAssetHolder.deposit(channelId, 0, held, {
      value: held,
    }); // FIXME

    /* 
      Expectations around the event that should be emitted on a successfull deposit, and 
      the new value of the public 'holdings' storage on chain:
    */
    const { events } = await (await tx0).wait();
    const depositedEvent = getDepositedEvent(events);

    expect(await ETHAssetHolder.holdings(channelId)).toEqual(held);
    expect(depositedEvent).toMatchObject({
      channelId,
      amountDeposited: held,
      destinationHoldings: held,
    });
  });

  it("Lesson 3: Form a State with the correct format", async () => {
    const participants = [];
    for (let i = 0; i < 3; i++) {
      participants[i] = Wallet.createRandom().address;
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

    expect(state.isFinal).toBeFalsy;

    const fixedPart = getFixedPart(state);
    const variablePart = getVariablePart(state);

    expect(fixedPart).toBeTruthy;
    expect(variablePart).toBeTruthy;
  });

  it("Lesson 4: Conform to an on chain validTransition function", async () => {
    const channel: Channel = {
      participants: [
        Wallet.createRandom().address,
        Wallet.createRandom().address,
      ],
      chainId: "0x1",
      channelNonce: "0x1",
    };

    const fromState: State = {
      channel,
      outcome: [],
      turnNum: 1,
      isFinal: false,
      challengeDuration: 0x0,
      appDefinition: process.env.TRIVIAL_APP_ADDRESS,
      appData: "0x0",
    };
    const toState: State = { ...fromState, turnNum: 3 }; // FIXME

    expect(
      await NitroAdjudicator.validTransition(
        channel.participants.length,
        [fromState.isFinal, toState.isFinal],
        [getVariablePart(fromState), getVariablePart(toState)],
        toState.turnNum,
        fromState.appDefinition
      )
    ).toBe(true);
  });

  it("Lesson 5: Support a state with signatures", async () => {
    const numStates = 3;
    const whoSignedWhat = [0, 1, 2];
    const largestTurnNum = 2;
    const participants = [];
    const wallets: Wallet[] = [];
    for (let i = 0; i < 3; i++) {
      wallets[i] = Wallet.createRandom();
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
     * Use the checpoint method to test our signatures
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

  it("Lesson 6: Conclude a channel (happy)", async () => {
    const whoSignedWhat = [0, 0, 0];
    const largestTurnNum = 4;
    const participants = [];
    const wallets: Wallet[] = [];
    for (let i = 0; i < 3; i++) {
      wallets[i] = Wallet.createRandom();
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

  it("Lesson 7: Register a challenge using forceMove", async () => {
    const largestTurnNum = 8;
    const isFinalCount = 0;
    const participants = [];
    const wallets: Wallet[] = [];
    for (let i = 0; i < 3; i++) {
      wallets[i] = Wallet.createRandom();
      participants[i] = wallets[i].address;
    }
    const chainId = "0x1234";
    const channelNonce = bigNumberify(0).toHexString();
    const channel: Channel = { chainId, channelNonce, participants };

    const appDatas = [0, 1, 2];
    const whoSignedWhat = [0, 1, 2];

    const states: State[] = appDatas.map((data, idx) => ({
      turnNum: largestTurnNum - appDatas.length + 1 + idx,
      isFinal: idx > appDatas.length - isFinalCount,
      channel,
      challengeDuration: 1,
      outcome: [],
      appDefinition: process.env.TRIVIAL_APP_ADDRESS,
      appData: HashZero,
    }));
    const variableParts = states.map((state) => getVariablePart(state));
    const fixedPart = getFixedPart(states[0]);

    const challenger = Wallet.createRandom(); // FIXME
    // const challenger = wallets[0];

    // Sign the states
    const signatures = await signStates(states, wallets, whoSignedWhat);
    const challengeSignedState: SignedState = signState(
      states[states.length - 1],
      challenger.privateKey
    );

    const challengeSignature = signChallengeMessage(
      [challengeSignedState],
      challenger.privateKey
    );

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

  it("Lesson 8: Clear a challenge using checkpoint", async () => {
    /* BEGIN TEST SETUP, to put the chain in a challenge mode */
    let largestTurnNum = 8;
    const isFinalCount = 0;
    const participants = [];
    const wallets: Wallet[] = [];
    for (let i = 0; i < 3; i++) {
      wallets[i] = Wallet.createRandom();
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

    const tx = NitroAdjudicator.checkpoint(
      fixedPart,
      largestTurnNum,
      variableParts,
      isFinalCount,
      signatures,
      whoSignedWhat
    );

    await (await tx).wait();

    const expectedChannelStorageHash = channelDataToChannelStorageHash({
      turnNumRecord: largestTurnNum,
      finalizesAt: 0x0,
    });

    // Check channelStorageHash against the expected value
    expect(await NitroAdjudicator.channelStorageHashes(channelId)).toEqual(
      expectedChannelStorageHash
    );
  });

  it.only("Lesson 9: Clear a challenge using respond", async () => {
    /* BEGIN TEST SETUP, to put the chain in a challenge mode */
    let largestTurnNum = 8;
    const isFinalCount = 0;
    const participants = [];
    const wallets: Wallet[] = [];
    for (let i = 0; i < 3; i++) {
      wallets[i] = Wallet.createRandom();
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
    const responseSignature = await signState(
      responseState,
      responder.privateKey
    ).signature;
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
      finalizesAt: 0x0,
    });

    // Check channelStorageHash against the expected value
    expect(await NitroAdjudicator.channelStorageHashes(channelId)).toEqual(
      expectedChannelStorageHash
    );
  });
});
