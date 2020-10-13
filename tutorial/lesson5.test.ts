/* Import ethereum wallet utilities  */
import { ethers } from "ethers";
const { parseUnits } = ethers.utils;

/* Import statechannels wallet utilities  */
import {
  getDepositedEvent,
  randomChannelId,
} from "@statechannels/nitro-protocol";

/* Set up an ethereum provider connected to our local blockchain */
const provider = new ethers.providers.JsonRpcProvider(
  `http://localhost:${process.env.GANACHE_PORT}`
);

/* 
  The ETHAssetHolder contract has already been compiled and will be automatically deployed to a local blockchain.
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

it("Lesson 5: depositing into the ETH asset holder", async () => {
  /*
      Get an appropriate representation of 1 wei, and
      use a random channelId.
      WARNING: don't do this in the wild: you won't be able to recover these funds.
  */
  const amount = parseUnits("1", "wei");
  const destination = randomChannelId();

  /*
      Attempt to deposit 1 wei against the channel id we created.
      Inspect the error message in the console for a hint about the bug on the next line 
  */
  const expectedHeld = 1; // FIXME
  const tx0 = ETHAssetHolder.deposit(destination, expectedHeld, amount, {
    value: amount,
  });

  /* 
      Expectations around the event that should be emitted on a successfull deposit, and 
      the new value of the public 'holdings' storage on chain:
  */
  const { events } = await (await tx0).wait();
  const depositedEvent = getDepositedEvent(events);

  expect(await ETHAssetHolder.holdings(destination)).toEqual(amount);
  expect(depositedEvent).toMatchObject({
    destination,
    amountDeposited: amount,
    destinationHoldings: amount,
  });
});
