// Import Ethereum utilities
import { ethers } from "ethers";
import {
  bigNumberify,
  parseUnits,
  id,
  hexlify,
  hexZeroPad,
} from "ethers/utils";
import {
  randomChannelId,
  State,
  Outcome,
  getVariablePart,
  getFixedPart,
  signState,
  hashOutcome,
  SignedState,
  encodeOutcome,
} from "@statechannels/nitro-protocol";
const getDepositedEvent = (events) =>
  events.find(({ event }) => event === "Deposited").args;

// Set up an ethereum provider connected to our local blockchain
const provider = new ethers.providers.JsonRpcProvider(
  `http://localhost:${process.env.GANACHE_PORT}`
);

// The contract has already been compiled and will be automatically deployed to a local blockchain
// Import the compilation artifact so we can use the ABI to 'talk' to the deployed contract
const {
  NitroAdjudicatorArtifact,
  EthAssetHolderArtifact,
} = require("@statechannels/nitro-protocol").ContractArtifacts;
const ETHAssetHolder = new ethers.Contract(
  process.env.ETH_ASSET_HOLDER_ADDRESS,
  EthAssetHolderArtifact.abi,
  provider.getSigner(0)
);

const NitroAdjudicator = new ethers.Contract(
  process.env.NITRO_ADJUDICATOR_ADDRESS,
  NitroAdjudicatorArtifact.abi,
  provider.getSigner(0)
);

// Import state channels utilities
import { Channel, getChannelId } from "@statechannels/nitro-protocol";
import {
  signStates,
  randomExternalDestination,
} from "@statechannels/nitro-protocol/lib/test/test-helpers";
import { HashZero, AddressZero } from "ethers/constants";

// TODO hoist these up to the module export in nitro-protocol
import {
  hashAppPart,
  hashState,
} from "@statechannels/nitro-protocol/lib/src/contract/state";
import { signChallengeMessage } from "@statechannels/nitro-protocol/lib/src/signatures";
import { channelDataToChannelStorageHash } from "@statechannels/nitro-protocol/src/contract/channel-storage";
import {
  decodeOutcome,
  AssetOutcome,
  AllocationAssetOutcome,
  GuaranteeAssetOutcome,
  encodeAllocation,
  encodeGuarantee,
} from "@statechannels/nitro-protocol/lib/src/contract/outcome";

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
      participants[i] = ethers.Wallet.createRandom().address;
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

    const channelId = "fixme"; // FIX ME

    /* 
      Uncomment the lines below to use the imported helper function to compute the channel id.
      Feel free to take a look at the implementation of that helper 
    */

    const channel: Channel = { chainId, channelNonce, participants };
    // const channelId = getChannelId(channel);

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

  it("Lesson 5: Support a state with signatures", async () => {
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

  it("Lesson 6: Conclude a channel (happy)", async () => {
    const whoSignedWhat = [0, 0, 0];
    const largestTurnNum = 4;
    const participants = [];
    const wallets: ethers.Wallet[] = [];
    for (let i = 0; i < 3; i++) {
      wallets[i] = ethers.Wallet.createRandom();
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
    const wallets: ethers.Wallet[] = [];
    for (let i = 0; i < 3; i++) {
      wallets[i] = ethers.Wallet.createRandom();
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

    const challenger = ethers.Wallet.createRandom(); // FIXME
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
      finalizesAt: 0x1, // FIXME
    });

    // Check channelStorageHash against the expected value
    expect(await NitroAdjudicator.channelStorageHashes(channelId)).toEqual(
      expectedChannelStorageHash
    );
  });

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

    const event = receipt.events.pop();

    // Catch ForceMove event
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
    expect(eventFixedPart[4]._hex).toEqual(
      hexlify(fixedPart.challengeDuration)
    );
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

  it("Lesson 11: Construct an allocation Outcome", async () => {
    // An outcome allocation 3 wei to the zero address
    // Recall that earlier in the tutorial we depositied into the ETH_ASSET_HOLDER
    // whose address is stored in process.env

    const assetOutcome: AllocationAssetOutcome = {
      assetHolderAddress: AddressZero, // FIXME
      allocationItems: [
        { destination: hexZeroPad(AddressZero, 32), amount: "0x03" },
        // other payouts go here
      ],
    };

    const outcome: Outcome = [assetOutcome]; // Additional assetOutcomes could be pushed into this array
    expect(encodeOutcome(outcome)).toEqual(
      "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000009ed274314f0fb37837346c425d3cf28d89ca95990000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000010000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000003"
    );
    expect(decodeOutcome(encodeOutcome(outcome))).toEqual(outcome);
  });

  it("Lesson 12: Construct a guarantee Outcome", async () => {
    // Construct a guarantee outcome that gives preference to player b over player a
    const assetOutcome: GuaranteeAssetOutcome = {
      assetHolderAddress: process.env.ETH_ASSET_HOLDER_ADDRESS,
      guarantee: {
        targetChannelId: HashZero,
        destinations: [
          "0x000000000000000000000000000000000000000000000000000000000000000a", // FIXME
          "0x000000000000000000000000000000000000000000000000000000000000000b", // FIXME
        ],
      },
    };

    const outcome: Outcome = [assetOutcome]; // Additional assetOutcomes could be pushed into this array
    expect(encodeOutcome(outcome)).toEqual(
      "0x0000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000200000000000000000000000009ed274314f0fb37837346c425d3cf28d89ca95990000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000014000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000001000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000c00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000b000000000000000000000000000000000000000000000000000000000000000a"
    );
    expect(decodeOutcome(encodeOutcome(outcome))).toEqual(outcome);
  });

  it("Lesson 13: Call pushOutcome", async () => {
    // BEGIN LESSON SETUP
    const whoSignedWhat = [0, 0, 0];
    const largestTurnNum = 4;
    const participants = [];
    const wallets: ethers.Wallet[] = [];
    for (let i = 0; i < 3; i++) {
      wallets[i] = ethers.Wallet.createRandom();
      participants[i] = wallets[i].address;
    }
    const chainId = "0x1234";
    const channelNonce = bigNumberify(0).toHexString();
    const channel: Channel = { chainId, channelNonce, participants };

    const state: State = {
      isFinal: true,
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
    // END LESSON SETUP
    // BEGIN LESSON 13 proper

    const tx0 = NitroAdjudicator.conclude(
      largestTurnNum,
      fixedPart,
      appPartHash,
      outcomeHash,
      numStates,
      whoSignedWhat,
      sigs
    );
    const receipt = await (await tx0).wait();

    const channelId = getChannelId(channel);
    const turnNumRecord = largestTurnNum; // FIXME
    // const turnNumRecord = 0; // Always 0 for a happy conclude
    const finalizesAt = (await provider.getBlock(receipt.blockNumber))
      .timestamp;
    const stateHash = HashZero; // Reset in a happy conclude
    const challengerAddress = AddressZero; // Reset in a happy conclude
    const outcomeBytes = encodeOutcome(state.outcome);

    const tx1 = NitroAdjudicator.pushOutcome(
      channelId,
      turnNumRecord,
      finalizesAt,
      stateHash,
      challengerAddress,
      outcomeBytes
    );

    await (await tx1).wait();
  });

  it("Lesson 14: Call transferAll", async () => {
    // BEGIN LESSON SETUP
    const amount = "0x03";

    const EOA = ethers.Wallet.createRandom().address;
    const destination = hexZeroPad(EOA, 32);

    const assetOutcome: AllocationAssetOutcome = {
      assetHolderAddress: process.env.ETH_ASSET_HOLDER_ADDRESS,
      allocationItems: [{ destination, amount }],
    };

    const whoSignedWhat = [0, 0, 0];
    const largestTurnNum = 4;
    const participants = [];
    const wallets: ethers.Wallet[] = [];
    for (let i = 0; i < 3; i++) {
      wallets[i] = ethers.Wallet.createRandom();
      participants[i] = wallets[i].address;
    }
    const chainId = "0x1234";
    const channelNonce = bigNumberify(0).toHexString();
    const channel: Channel = { chainId, channelNonce, participants };
    const channelId = getChannelId(channel);

    /*
      Attempt to deposit 1 wei against the channel id we created.
      Inspect the error message in the console for a hint about the bug on the next line 
    */
    const tx0 = ETHAssetHolder.deposit(channelId, 0, amount, {
      value: amount,
    });

    await (await tx0).wait();

    const state: State = {
      isFinal: true,
      channel,
      outcome: [assetOutcome],
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

    const tx1 = NitroAdjudicator.conclude(
      largestTurnNum,
      fixedPart,
      appPartHash,
      outcomeHash,
      numStates,
      whoSignedWhat,
      sigs
    );
    const receipt = await (await tx1).wait();

    const turnNumRecord = 0; // Always 0 for a happy conclude
    const finalizesAt = (await provider.getBlock(receipt.blockNumber))
      .timestamp;
    const stateHash = HashZero; // Reset in a happy conclude
    const challengerAddress = AddressZero; // Reset in a happy conclude
    const outcomeBytes = encodeOutcome(state.outcome);

    const tx2 = NitroAdjudicator.pushOutcome(
      channelId,
      turnNumRecord,
      finalizesAt,
      stateHash,
      challengerAddress,
      outcomeBytes
    );

    await (await tx2).wait();

    // END LESSON SETUP

    // BEGIN LESSON 14 proper

    const tx3 = ETHAssetHolder.transferAll(
      channelId,
      HashZero // FIXME
      // encodeAllocation(assetOutcome.allocationItems)
    );

    const { events } = await (await tx3).wait();

    expect(events).toMatchObject([
      {
        event: "AssetTransferred",
        args: {
          channelId,
          destination: destination.toLowerCase(),
          amount: { _hex: amount },
        },
      },
    ]);

    expect(
      bigNumberify(await provider.getBalance(EOA)).eq(bigNumberify(amount))
    );
  });

  it("Lesson 15: Call claimAll", async () => {
    // BEGIN LESSON SETUP
    const amount = "0x03";
    const EOA1 = ethers.Wallet.createRandom().address;
    const EOA2 = ethers.Wallet.createRandom().address;
    const destination1 = hexZeroPad(EOA1, 32);
    const destination2 = hexZeroPad(EOA2, 32);

    const assetOutcomeForTheTargetChannel: AllocationAssetOutcome = {
      assetHolderAddress: process.env.ETH_ASSET_HOLDER_ADDRESS,
      allocationItems: [
        { destination: destination1, amount },
        { destination: destination2, amount },
      ],
    };

    const whoSignedWhat = [0, 0, 0];
    const largestTurnNum = 4;
    const participants = [];
    const wallets: ethers.Wallet[] = [];
    for (let i = 0; i < 3; i++) {
      wallets[i] = ethers.Wallet.createRandom();
      participants[i] = wallets[i].address;
    }
    const chainId = "0x1234";
    const channelNonce = bigNumberify(0).toHexString();
    const targetChannel: Channel = { chainId, channelNonce, participants };
    const targetChannelId = getChannelId(targetChannel);

    // Finalise and pushOutcome for target channel
    const state: State = {
      isFinal: true,
      channel: targetChannel,
      outcome: [assetOutcomeForTheTargetChannel],
      appDefinition: AddressZero,
      appData: HashZero,
      challengeDuration: 1,
      turnNum: largestTurnNum,
    };
    let sigs = await signStates([state], wallets, whoSignedWhat);
    let numStates = 1;
    let fixedPart = getFixedPart(state);
    let appPartHash = hashAppPart(state);
    let outcomeHash = hashOutcome(state.outcome);

    const tx0 = NitroAdjudicator.conclude(
      largestTurnNum,
      fixedPart,
      appPartHash,
      outcomeHash,
      numStates,
      whoSignedWhat,
      sigs
    );
    const receipt = await (await tx0).wait();
    let turnNumRecord = 0; // Always 0 for a happy conclude
    let finalizesAt = (await provider.getBlock(receipt.blockNumber)).timestamp;
    let stateHash = HashZero; // Reset in a happy conclude
    let challengerAddress = AddressZero; // Reset in a happy conclude
    let outcomeBytes = encodeOutcome(state.outcome);
    const tx1 = NitroAdjudicator.pushOutcome(
      targetChannelId,
      turnNumRecord,
      finalizesAt,
      stateHash,
      challengerAddress,
      outcomeBytes
    );
    await (await tx1).wait();

    // Finalise and pushOutcome for the guarantor channel

    const assetOutcomeForTheGuarantorChannel: GuaranteeAssetOutcome = {
      assetHolderAddress: process.env.ETH_ASSET_HOLDER_ADDRESS,
      guarantee: {
        targetChannelId: targetChannelId,
        destinations: [
          destination2,
          destination1, // Note reversed order
        ],
      },
    };

    const guarantorChannel: Channel = {
      chainId,
      channelNonce: channelNonce + 1,
      participants,
    };
    const guarantorChannelId = getChannelId(guarantorChannel);
    const stateForGuarantorChannel: State = {
      isFinal: true,
      channel: guarantorChannel,
      outcome: [assetOutcomeForTheGuarantorChannel],
      appDefinition: AddressZero,
      appData: HashZero,
      challengeDuration: 1,
      turnNum: largestTurnNum,
    };
    sigs = await signStates([stateForGuarantorChannel], wallets, whoSignedWhat);
    numStates = 1;
    fixedPart = getFixedPart(stateForGuarantorChannel);
    appPartHash = hashAppPart(stateForGuarantorChannel);
    outcomeHash = hashOutcome(stateForGuarantorChannel.outcome);

    const tx2 = NitroAdjudicator.conclude(
      largestTurnNum,
      fixedPart,
      appPartHash,
      outcomeHash,
      numStates,
      whoSignedWhat,
      sigs
    );
    const receiptFortx2 = await (await tx2).wait();
    turnNumRecord = 0; // Always 0 for a happy conclude
    finalizesAt = (await provider.getBlock(receiptFortx2.blockNumber))
      .timestamp;
    stateHash = HashZero; // Reset in a happy conclude
    challengerAddress = AddressZero; // Reset in a happy conclude
    outcomeBytes = encodeOutcome(stateForGuarantorChannel.outcome);
    const tx3 = NitroAdjudicator.pushOutcome(
      guarantorChannelId,
      turnNumRecord,
      finalizesAt,
      stateHash,
      challengerAddress,
      outcomeBytes
    );
    await (await tx3).wait();

    const tx4 = ETHAssetHolder.deposit(guarantorChannelId, 0, amount, {
      value: amount,
    });

    await (await tx4).wait();

    // END LESSON SETUP

    // BEGIN LESSON 15 proper

    // FIXME
    const tx5 = ETHAssetHolder.claimAll(
      guarantorChannelId,
      encodeAllocation(assetOutcomeForTheTargetChannel.allocationItems),
      encodeGuarantee(assetOutcomeForTheGuarantorChannel.guarantee)
    );

    // const tx5 = ETHAssetHolder.claimAll(
    //   guarantorChannelId,
    //   encodeGuarantee(assetOutcomeForTheGuarantorChannel.guarantee),
    //   encodeAllocation(assetOutcomeForTheTargetChannel.allocationItems)
    // );

    const { events } = await (await tx5).wait();

    expect(events).toMatchObject([
      {
        event: "AssetTransferred",
        args: {
          channelId: guarantorChannelId,
          destination: destination2.toLowerCase(),
          amount: { _hex: amount },
        },
      },
    ]);

    expect(
      bigNumberify(await provider.getBalance(EOA2)).eq(bigNumberify(amount))
    );
  });
});
