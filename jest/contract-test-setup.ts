import { GanacheServer, configureEnvVariables } from "@statechannels/devtools";
import { deploy } from "../deployment/deploy";

export default async function setup() {
  configureEnvVariables();
  const ganacheServer = new GanacheServer(
    Number(process.env.GANACHE_PORT),
    Number(process.env.CHAIN_NETWORK_ID)
  );
  await ganacheServer.ready();

  const deployedArtifacts = await deploy();

  process.env = { ...process.env, ...deployedArtifacts };

  if (
    process.env.ETH_ASSET_HOLDER_ADDRESS !==
    "0x9eD274314f0fB37837346C425D3cF28d89ca9599"
  ) {
    throw new Error(
      `ETH_ASSET_HOLDER not at expected address (instead at ${process.env.ETH_ASSET_HOLDER_ADDRESS}`
    );
  }

  if (
    process.env.NITRO_ADJUDICATOR_ADDRESS !==
    "0xc9707E1e496C12f1Fa83AFbbA8735DA697cdBf64"
  ) {
    throw new Error(
      `NITRO_ADJUDICATOR not at expected address (instead at ${process.env.NITRO_ADJUDICATOR_ADDRESS})`
    );
  }

  (global as any).__GANACHE_SERVER__ = ganacheServer;
}
