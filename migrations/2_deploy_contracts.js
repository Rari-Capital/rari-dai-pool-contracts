// SPDX-License-Identifier: UNLICENSED
const { deployProxy, upgradeProxy, admin } = require('@openzeppelin/truffle-upgrades');
require('dotenv').config();

var DydxPoolController = artifacts.require("./lib/pools/DydxPoolController.sol");
var CompoundPoolController = artifacts.require("./lib/pools/CompoundPoolController.sol");
var AavePoolController = artifacts.require("./lib/pools/AavePoolController.sol");
var MStablePoolController = artifacts.require("./lib/pools/MStablePoolController.sol");
var ZeroExExchangeController = artifacts.require("./lib/exchanges/ZeroExExchangeController.sol");
var MStableExchangeController = artifacts.require("./lib/exchanges/MStableExchangeController.sol");
var RariFundController = artifacts.require("./RariFundController.sol");
var RariFundManager = artifacts.require("./RariFundManager.sol");
var RariFundToken = artifacts.require("./RariFundToken.sol");
var RariFundPriceConsumer = artifacts.require("./RariFundPriceConsumer.sol");
var RariFundProxy = artifacts.require("./RariFundProxy.sol");

module.exports = async function(deployer, network, accounts) {
  if (["live", "live-fork"].indexOf(network) >= 0) {
    if (!process.env.LIVE_GAS_PRICE) return console.error("LIVE_GAS_PRICE is missing for live deployment");
    if (!process.env.LIVE_FUND_OWNER) return console.error("LIVE_FUND_OWNER is missing for live deployment");
    if (!process.env.LIVE_FUND_REBALANCER) return console.error("LIVE_FUND_REBALANCER is missing for live deployment");
    if (!process.env.LIVE_FUND_INTEREST_FEE_MASTER_BENEFICIARY) return console.error("LIVE_FUND_INTEREST_FEE_MASTER_BENEFICIARY is missing for live deployment");
    if (!process.env.LIVE_FUND_WITHDRAWAL_FEE_MASTER_BENEFICIARY) return console.error("LIVE_FUND_WITHDRAWAL_FEE_MASTER_BENEFICIARY is missing for live deployment");
  }

  // Normal deployment!
  // Deploy liquidity pool and currency exchange libraries
  await deployer.deploy(DydxPoolController);
  await deployer.deploy(CompoundPoolController);
  await deployer.deploy(AavePoolController);
  await deployer.deploy(MStablePoolController);
  await deployer.deploy(ZeroExExchangeController);
  await deployer.deploy(MStableExchangeController);

  // Link libraries to RariFundController
  await deployer.link(DydxPoolController, RariFundController);
  await deployer.link(CompoundPoolController, RariFundController);
  await deployer.link(AavePoolController, RariFundController);
  await deployer.link(MStablePoolController, RariFundController);
  await deployer.link(ZeroExExchangeController, RariFundController);
  await deployer.link(MStableExchangeController, RariFundController);

  // Deploy RariFundController and RariFundManager
  var rariFundController = await deployer.deploy(RariFundController);
  var rariFundManager = await deployProxy(RariFundManager, [], { deployer, unsafeAllowCustomTypes: true });

  // Connect RariFundController and RariFundManager
  await rariFundController.setFundManager(RariFundManager.address);
  await rariFundManager.setFundController(RariFundController.address);

  // Set Aave referral code
  await rariFundController.setAaveReferralCode(86);
  
  // Deploy RariFundToken
  var rariFundToken = await deployProxy(RariFundToken, [], { deployer });
  
  // Add RariFundManager as as RariFundToken minter
  await rariFundToken.addMinter(RariFundManager.address);

  // Connect RariFundToken to RariFundManager
  await rariFundManager.setFundToken(RariFundToken.address);

  // Deploy RariFundPriceConsumer, pegging all currencies to $1 USD
  var rariFundPriceConsumer = await deployProxy(RariFundPriceConsumer, [true], { deployer });

  // Connect RariFundPriceConsumer to RariFundManager
  await rariFundManager.setFundPriceConsumer(RariFundPriceConsumer.address);

  // Set daily loss rate limit for currency exchanges
  await rariFundController.setDailyLossRateLimit(["live", "live-fork"].indexOf(network) >= 0 ? web3.utils.toBN(0.02e18) : web3.utils.toBN(0.9e18));

  // Set fund rebalancer on controller and manager
  await rariFundController.setFundRebalancer(["live", "live-fork"].indexOf(network) >= 0 ? process.env.LIVE_FUND_REBALANCER : process.env.DEVELOPMENT_ADDRESS);
  await rariFundManager.setFundRebalancer(["live", "live-fork"].indexOf(network) >= 0 ? process.env.LIVE_FUND_REBALANCER : process.env.DEVELOPMENT_ADDRESS);

  // Set interest fee master beneficiary
  await rariFundManager.setInterestFeeMasterBeneficiary(["live", "live-fork"].indexOf(network) >= 0 ? process.env.LIVE_FUND_INTEREST_FEE_MASTER_BENEFICIARY : process.env.DEVELOPMENT_ADDRESS);

  // Set interest fee rate to 9.5%
  await rariFundManager.setInterestFeeRate(web3.utils.toBN(0.095e18));

  // Set withdrawal fee master beneficiary
  await rariFundManager.setWithdrawalFeeMasterBeneficiary(["live", "live-fork"].indexOf(network) >= 0 ? process.env.LIVE_FUND_WITHDRAWAL_FEE_MASTER_BENEFICIARY : process.env.DEVELOPMENT_ADDRESS);

  // Set withdrawal fee rate to 0.5%
  await rariFundManager.setWithdrawalFeeRate(web3.utils.toBN(0.005e18));

  // Link libraries to RariFundProxy
  await deployer.link(ZeroExExchangeController, RariFundProxy);
  await deployer.link(MStableExchangeController, RariFundProxy);

  // Deploy RariFundProxy
  var rariFundProxy = await deployer.deploy(RariFundProxy);

  // Connect RariFundManager and RariFundProxy
  await rariFundManager.setFundProxy(RariFundProxy.address);
  await rariFundProxy.setFundManager(RariFundManager.address);

  // Set GSN trusted signer
  await rariFundProxy.setGsnTrustedSigner(["live", "live-fork"].indexOf(network) >= 0 ? process.env.LIVE_FUND_GSN_TRUSTED_SIGNER : process.env.DEVELOPMENT_ADDRESS);

  if (["live", "live-fork"].indexOf(network) >= 0) {
    // Live network: transfer ownership of deployed contracts from the deployer to the owner
    await rariFundController.transferOwnership(process.env.LIVE_FUND_OWNER);
    await rariFundManager.transferOwnership(process.env.LIVE_FUND_OWNER);
    await rariFundToken.addMinter(process.env.LIVE_FUND_OWNER);
    await rariFundToken.renounceMinter();
    await rariFundProxy.transferOwnership(process.env.LIVE_FUND_OWNER);
    await admin.transferProxyAdminOwnership(process.env.LIVE_FUND_OWNER);
  } else {
    // Development network: set all currencies to accepted
    await rariFundManager.setAcceptedCurrencies(["DAI", "USDC", "USDT", "TUSD", "BUSD", "sUSD", "mUSD"], [true, true, true, true, true, true, true]);
  }
};
