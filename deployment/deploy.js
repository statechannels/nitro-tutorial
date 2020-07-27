const {
  NitroAdjudicatorArtifact,
  EthAssetHolderArtifact,
  TrivialAppArtifact,
} = require("@statechannels/nitro-protocol").ContractArtifacts;

const {
  GanacheDeployer,
  ETHERLIME_ACCOUNTS,
} = require("@statechannels/devtools");

const deploy = async () => {
  const deployer = new GanacheDeployer(
    Number(process.env.GANACHE_PORT),
    ETHERLIME_ACCOUNTS[0].privateKey
  );

  const txCount = await deployer.etherlimeDeployer.signer.getTransactionCount();
  if (txCount > 0) {
    throw new Error(
      `The tutorial requires a fresh blockchain in order for test assertions to be accurate. Try killing anything running on port ${process.env.GANACHE_PORT} and trying again`
    );
  }

  const NITRO_ADJUDICATOR_ADDRESS = await deployer.deploy(
    NitroAdjudicatorArtifact
  );

  const ETH_ASSET_HOLDER_ADDRESS = await deployer.deploy(
    EthAssetHolderArtifact,
    {},
    NITRO_ADJUDICATOR_ADDRESS
  );

  const TRIVIAL_APP_ADDRESS = await deployer.deploy(TrivialAppArtifact);

  return {
    NITRO_ADJUDICATOR_ADDRESS,
    ETH_ASSET_HOLDER_ADDRESS,
    TRIVIAL_APP_ADDRESS,
  };
};

module.exports = {
  deploy,
};
