/* Import ethereum wallet utilities  */
import { ethers } from "ethers";
const { parseUnits } = ethers.utils;
const { AddressZero, HashZero } = ethers.constants;
/* Import statechannels wallet utilities  */
import {
  Channel,
  State,
  getChannelId,
  signState,
  convertAddressToBytes32,
} from "@statechannels/nitro-protocol";

/* Set up an ethereum provider connected to our local blockchain */
const provider = new ethers.providers.JsonRpcProvider(
  `http://localhost:${process.env.GANACHE_PORT}`
);

/* 
  The EthAssetHolder contract has already been compiled and will be automatically deployed to a local blockchain.
  Import the compilation artifact so we can use the ABI to 'talk' to the deployed contract
*/
const {
  EthAssetHolderArtifact,
} = require("@statechannels/nitro-protocol").ContractArtifacts;
const ETHAssetHolder = new ethers.Contract(
  process.env.ETH_ASSET_HOLDER_ADDRESS,
  EthAssetHolderArtifact.abi,
  provider.getSigner(0)
);

it("Lesson 16: Ledger funding", async () => {
  /*
   Construct a ledger channel with the hub
  */
  const mySigningKey =
    "0x7ab741b57e8d94dd7e1a29055646bafde7010f38a900f55bbd7647880faa6ee8";
  const hubSigningKey =
    "0x2030b463177db2da82908ef90fa55ddfcef56e8183caf60db464bc398e736e6f";
  const me = new ethers.Wallet(mySigningKey).address;
  const hub = new ethers.Wallet(hubSigningKey).address;
  const myDestination = convertAddressToBytes32(me);
  const hubDestination = convertAddressToBytes32(hub);
  const participants = [me, hub];
  const chainId = "0x1234";
  const ledgerChannel: Channel = {
    chainId,
    channelNonce: 0,
    participants,
  };
  const ledgerChannelId = getChannelId(ledgerChannel);

  /*
    Construct a state for that allocates 6 wei to each of us, and has turn numer n - 1
    This is called the "pre fund setup" state
  */

  const sixEachStatePreFS: State = {
    isFinal: false,
    channel: ledgerChannel,
    outcome: [
      {
        assetHolderAddress: process.env.ETH_ASSET_HOLDER_ADDRESS,
        allocationItems: [
          {
            destination: myDestination,
            amount: parseUnits("6", "wei").toHexString(),
          },
          {
            destination: hubDestination,
            amount: parseUnits("6", "wei").toHexString(),
          },
        ],
      },
    ],
    appDefinition: AddressZero,
    appData: HashZero,
    challengeDuration: 1,
    turnNum: 1,
  };

  /* 
    Collect a support proof by getting all participants to sign this state
  */
  let signatures;
  signatures = [
    signState(sixEachStatePreFS, hubSigningKey).signature, // FIXME
    signState(sixEachStatePreFS, hubSigningKey).signature,
  ];
  expect(JSON.stringify(signatures)).toEqual(
    // LOOK FOR FIXME ABOVE
    '[{"r":"0xd8ba8e03963a408bf00ea1f44b9f12604762fe3b3075e96d060b4282a355bf17","s":"0x7c53e0ae7241b676132f975a51d5fefdcbfb94c1a62b627cda3fce56b5a6310e","_vs":"0x7c53e0ae7241b676132f975a51d5fefdcbfb94c1a62b627cda3fce56b5a6310e","recoveryParam":0,"v":27},{"r":"0x316c53596fed74cc6ececb77fd164832517e2ab6591ba8f850d6bcc008041bbf","s":"0x22d6307912fa14a073fdab7ba38b52e199d3c2880d3699e4282c301dd0868821","_vs":"0xa2d6307912fa14a073fdab7ba38b52e199d3c2880d3699e4282c301dd0868821","recoveryParam":1,"v":28}]'
  );

  /*
    Desposit plenty of funds ON CHAIN
  */
  const amount = parseUnits("12", "wei");
  const destination = ledgerChannelId;
  const expectedHeld = 0;
  const tx0 = ETHAssetHolder.deposit(destination, expectedHeld, amount, {
    value: amount,
  });
  await (await tx0).wait();

  /*
    Construct a state that allocates 6 wei to each of us, but with turn number 2n - 1
    This is called the "post fund setup" state
  */

  const sixEachStatePostFS: State = { ...sixEachStatePreFS, turnNum: 3 };

  /* 
    Collect a support proof by getting all participants to sign this state
  */
  signatures = [
    signState(sixEachStatePostFS, mySigningKey).signature,
    signState(sixEachStatePostFS, hubSigningKey).signature,
  ];
  expect(JSON.stringify(signatures)).toEqual(
    '[{"r":"0xf499f7f27b5d996c1f6ed59310e50802724d1cc2e60f7431f7360a133f62eba7","s":"0x2bef066cadf27e26209041f4b9d78f167aab3f2d41a49f356b643c7b362bbd57","_vs":"0xabef066cadf27e26209041f4b9d78f167aab3f2d41a49f356b643c7b362bbd57","recoveryParam":1,"v":28},{"r":"0x0dfdc37080e406298183ef8cf97051f47e620eb0d9bc918f8a801078812a34da","s":"0x309fb2945ba3e4802fa95df3f8b22fe3e5350ebc01986b7fba777860f6e4f2af","_vs":"0x309fb2945ba3e4802fa95df3f8b22fe3e5350ebc01986b7fba777860f6e4f2af","recoveryParam":0,"v":27}]'
  );

  /*
    Construct an application channel with the hub
  */
  const applicationChannel1: Channel = {
    chainId,
    channelNonce: 1,
    participants,
  };
  const applicationChannel1Id = getChannelId(applicationChannel1);

  /*
    Construct a state that allocates 3 wei to each of us, and has turn numer n - 1
    This is the "pre fund setup" state for the our first application channel
  */

  const threeEachStatePreFS: State = {
    isFinal: false,
    channel: applicationChannel1,
    outcome: [
      {
        assetHolderAddress: process.env.ETH_ASSET_HOLDER_ADDRESS,
        allocationItems: [
          {
            destination: myDestination,
            amount: parseUnits("3", "wei").toHexString(),
          },
          {
            destination: hubDestination,
            amount: parseUnits("3", "wei").toHexString(),
          },
        ],
      },
    ],
    appDefinition: process.env.TRIVIAL_APP_ADDRESS,
    appData: HashZero,
    challengeDuration: 1,
    turnNum: 1,
  };

  /* 
    Collect a support proof by getting all participants to sign this state
  */
  signatures = [
    signState(threeEachStatePreFS, mySigningKey).signature,
    signState(threeEachStatePreFS, hubSigningKey).signature,
  ];
  expect(JSON.stringify(signatures)).toEqual(
    '[{"r":"0x5536f40f6b109699522d27d923c29dd13fb4d5cef94226235dbf31708d82c36a","s":"0x251b74764f33eaefabb70eedab732e21c9134956acaf4de61246c16e0643d45f","_vs":"0x251b74764f33eaefabb70eedab732e21c9134956acaf4de61246c16e0643d45f","recoveryParam":0,"v":27},{"r":"0x02b67dd4ab582a34cfb9a85fe5f4964bea64c2a6ad7a1f64de6942d76e9958ab","s":"0x096fb2c9e362d278c288fb0a22f1ac6fa6abdf6f208fd162d48d97cb23ced225","_vs":"0x896fb2c9e362d278c288fb0a22f1ac6fa6abdf6f208fd162d48d97cb23ced225","recoveryParam":1,"v":28}]'
  );

  /*
    Fund our first application channel OFF CHAIN
    simply by collecting a support proof for a state such as this:
  */

  const threeEachAndSixForTheApp: State = {
    isFinal: false,
    channel: ledgerChannel,
    outcome: [
      {
        assetHolderAddress: process.env.ETH_ASSET_HOLDER_ADDRESS,
        allocationItems: [
          {
            destination: myDestination,
            amount: parseUnits("3", "wei").toHexString(),
          },
          {
            destination: hubDestination,
            amount: parseUnits("3", "wei").toHexString(),
          },
          {
            destination: applicationChannel1Id,
            amount: parseUnits("6", "wei").toHexString(),
          },
        ],
      },
    ],
    appDefinition: AddressZero,
    appData: HashZero,
    challengeDuration: 1,
    turnNum: 4,
  };

  /* 
    Collect a support proof by getting all participants to sign this state
  */
  signatures = [
    signState(threeEachAndSixForTheApp, mySigningKey).signature,
    signState(threeEachAndSixForTheApp, hubSigningKey).signature,
  ];
  expect(JSON.stringify(signatures)).toEqual(
    '[{"r":"0x526a52bf285e6bbf35a76bb0d0892bd2dc057e5de959545ea34b48979afeb636","s":"0x6732cd33ffe5dd1518ed56a02510c9c7b82083bbb7036ac83e548865d68b6901","_vs":"0xe732cd33ffe5dd1518ed56a02510c9c7b82083bbb7036ac83e548865d68b6901","recoveryParam":1,"v":28},{"r":"0x850a0e4d52a8cbdf81c97b1ecd11789766ac9788bde9f28dae87d63ed8694aa4","s":"0x6cf6a0c8acd2b2875c0ebaf8ebd13fe1c5d593012eadd2fd1343bc405b26b3aa","_vs":"0x6cf6a0c8acd2b2875c0ebaf8ebd13fe1c5d593012eadd2fd1343bc405b26b3aa","recoveryParam":0,"v":27}]'
  );

  /*
    Construct the "post fund setup" state for the application channel
  */

  const threeEachStatePostFS: State = {
    ...threeEachStatePreFS,
    turnNum: 3,
  };

  /* 
    Collect a support proof by getting all participants to sign this state
  */
  signatures = [
    signState(threeEachStatePostFS, mySigningKey).signature,
    signState(threeEachStatePostFS, hubSigningKey).signature,
  ];
  expect(JSON.stringify(signatures)).toEqual(
    '[{"r":"0x7187e0a0cf357296f655939542891bc3a8daaaf8d0cdce96aedcd81c4883519b","s":"0x0f1b6400f3ac56bc35398b080cbe1acd4ba532e6a1ef38fdc07161418b9035ef","_vs":"0x8f1b6400f3ac56bc35398b080cbe1acd4ba532e6a1ef38fdc07161418b9035ef","recoveryParam":1,"v":28},{"r":"0xab8b6a785b62bb7ca8fd959185d3a0b26d89e43b747cafadf09e2dbe6aa5185a","s":"0x4a0af2c60f0d524b68adfa396f369d15268f30bc1ccb193ac90126a4aebd4ea3","_vs":"0xca0af2c60f0d524b68adfa396f369d15268f30bc1ccb193ac90126a4aebd4ea3","recoveryParam":1,"v":28}]'
  );
});
