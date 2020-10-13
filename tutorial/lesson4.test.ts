import { ethers } from "ethers";
import { Channel } from "@statechannels/nitro-protocol";

it("Lesson 4: construct a Channel and compute its id", async () => {
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
  const channelNonce = 0;

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
