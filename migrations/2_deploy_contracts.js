// SPDX-License-Identifier: UNLICENSED
const { deployProxy, upgradeProxy, admin } = require('@openzeppelin/truffle-upgrades');
require('dotenv').config();

var DydxPoolController = artifacts.require("./lib/pools/DydxPoolController.sol");
var CompoundPoolController = artifacts.require("./lib/pools/CompoundPoolController.sol");
var AavePoolController = artifacts.require("./lib/pools/AavePoolController.sol");
var MStablePoolController = artifacts.require("./lib/pools/MStablePoolController.sol");
var FusePoolController = artifacts.require("./lib/pools/FusePoolController.sol");
var ZeroExExchangeController = artifacts.require("./lib/exchanges/ZeroExExchangeController.sol");
var MStableExchangeController = artifacts.require("./lib/exchanges/MStableExchangeController.sol");
var UniswapExchangeController = artifacts.require("./lib/exchanges/UniswapExchangeController.sol");
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
  
  if (parseInt(process.env.UPGRADE_FROM_LAST_VERSION) > 0) {
    // Upgrade from v1.0.0 (only modifying RariFundController v1.0.0, RariFundManager v1.0.0, and RariFundProxy v1.0.0) to v1.1.0
    if (!process.env.UPGRADE_OLD_FUND_CONTROLLER) return console.error("UPGRADE_OLD_FUND_CONTROLLER is missing for upgrade");
    if (!process.env.UPGRADE_FUND_MANAGER_ADDRESS) return console.error("UPGRADE_FUND_MANAGER_ADDRESS is missing for upgrade");
    if (!process.env.UPGRADE_FUND_OWNER_ADDRESS) return console.error("UPGRADE_FUND_OWNER_ADDRESS is missing for upgrade");

    if (["live", "live-fork"].indexOf(network) >= 0) {
      if (!process.env.LIVE_UPGRADE_FUND_OWNER_PRIVATE_KEY) return console.error("LIVE_UPGRADE_FUND_OWNER_PRIVATE_KEY is missing for live upgrade");
    } else {
      if (!process.env.UPGRADE_FUND_TOKEN_ADDRESS) return console.error("UPGRADE_FUND_TOKEN_ADDRESS is missing for development upgrade");
      if (!process.env.UPGRADE_FUND_PRICE_CONSUMER_ADDRESS) return console.error("UPGRADE_FUND_PRICE_CONSUMER_ADDRESS is missing for development upgrade");
    }

    // Upgrade from v2.4.0 (RariFundController v2.0.0) to v2.5.0
    var oldRariFundController = await RariFundController.at(process.env.UPGRADE_OLD_FUND_CONTROLLER);

    // Deploy liquidity pool and currency exchange libraries
    await deployer.deploy(DydxPoolController);
    await deployer.deploy(CompoundPoolController);
    await deployer.deploy(AavePoolController);
    await deployer.deploy(MStablePoolController);
    await deployer.deploy(FusePoolController);
    await deployer.deploy(MStableExchangeController);
    await deployer.deploy(UniswapExchangeController);

    // Link libraries to RariFundController
    await deployer.link(DydxPoolController, RariFundController);
    await deployer.link(CompoundPoolController, RariFundController);
    await deployer.link(AavePoolController, RariFundController);
    await deployer.link(MStablePoolController, RariFundController);
    await deployer.link(FusePoolController, RariFundController);
    await deployer.link(MStableExchangeController, RariFundController);
    await deployer.link(UniswapExchangeController, RariFundController);

    // Deploy new RariFundController
    var rariFundController = await deployProxy(RariFundController, { deployer, unsafeAllowLinkedLibraries: true });

    // Disable the fund on the old RariFundController
    await oldRariFundController.disableFund({ from: process.env.UPGRADE_FUND_OWNER_ADDRESS });

    // Disable the fund on the RariFundManager
    RariFundManager.class_defaults.from = process.env.UPGRADE_FUND_OWNER_ADDRESS;
    var rariFundManager = await RariFundManager.at(process.env.UPGRADE_FUND_MANAGER_ADDRESS);
    await rariFundManager.setFundDisabled(true);

    // Upgrade RariFundController
    await oldRariFundController.methods["upgradeFundController(address)"](RariFundController.address, { from: process.env.UPGRADE_FUND_OWNER_ADDRESS });

    // Forward COMP governance tokens
    if (oldRariFundController.methods["upgradeFundController(address,address)"].call(RariFundController.address, "0xc00e94cb662c3520282e6f5717214004a7f26888", { from: process.env.UPGRADE_FUND_OWNER_ADDRESS })) await oldRariFundController.methods["upgradeFundController(address,address)"](RariFundController.address, "0xc00e94cb662c3520282e6f5717214004a7f26888", { from: process.env.UPGRADE_FUND_OWNER_ADDRESS });

    // Connect new RariFundController and RariFundManager
    await rariFundController.setFundManager(process.env.UPGRADE_FUND_MANAGER_ADDRESS);
    await rariFundManager.setFundController(RariFundController.address);

    // Upgrade RariFundManager
    rariFundManager = await upgradeProxy(process.env.UPGRADE_FUND_MANAGER_ADDRESS, RariFundManager, { deployer, unsafeAllowCustomTypes: true });

    // Re-enable the fund on the RariFundManager
    await rariFundManager.setFundDisabled(false);

    // Set Aave referral code
    await rariFundController.setAaveReferralCode(86);

    // Set daily loss rate limit for currency exchanges
    await rariFundController.setExchangeLossRateLimit(["live", "live-fork"].indexOf(network) >= 0 ? web3.utils.toBN(2).pow(web3.utils.toBN(255)).neg() : web3.utils.toBN(0.5e18));

    // Set fund rebalancer on controller and manager
    await rariFundController.setFundRebalancer(["live", "live-fork"].indexOf(network) >= 0 ? process.env.LIVE_FUND_REBALANCER : process.env.DEVELOPMENT_ADDRESS);

    // Deploy ZeroExExchangeController for RariFundProxy
    await deployer.deploy(ZeroExExchangeController);

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
      // Live network: transfer ownership of RariFundController to live owner
      await rariFundController.transferOwnership(process.env.LIVE_FUND_OWNER);
      await rariFundProxy.transferOwnership(process.env.LIVE_FUND_OWNER);
    } else {
      // Register Fuse pools
      var testFusePools = require("../test/fixtures/fuse.json");
      var poolKeys = Object.keys(testFusePools);
      var poolIds = [];
      var currencyCodes = [];
      var cTokens = [];
      for (var i = 0; i < poolKeys.length; i++) {
        poolIds[i] = 100 + i;
        currencyCodes[i] = [];
        cTokens[i] = [];
        for (const currencyCode of Object.keys(testFusePools[poolKeys[i]].currencies)) {
          currencyCodes[i].push(currencyCode);
          cTokens[i].push(testFusePools[poolKeys[i]].currencies[currencyCode].cTokenAddress);
        }
      }
      await rariFundController.addFuseAssets(poolIds, currencyCodes, cTokens);

      // Development network: transfer ownership of contracts to development address, set development address as rebalancer, and set all currencies to accepted
      await rariFundManager.transferOwnership(process.env.DEVELOPMENT_ADDRESS, { from: process.env.UPGRADE_FUND_OWNER_ADDRESS });
      var rariFundPriceConsumer = await RariFundPriceConsumer.at(process.env.UPGRADE_FUND_PRICE_CONSUMER_ADDRESS); 
      await rariFundPriceConsumer.transferOwnership(process.env.DEVELOPMENT_ADDRESS, { from: process.env.UPGRADE_FUND_OWNER_ADDRESS });
      // TODO: await admin.transferProxyAdminOwnership(process.env.DEVELOPMENT_ADDRESS, { from: process.env.UPGRADE_FUND_OWNER_ADDRESS });
      RariFundManager.class_defaults.from = process.env.DEVELOPMENT_ADDRESS;
      await rariFundManager.setFundRebalancer(process.env.DEVELOPMENT_ADDRESS);
      await rariFundManager.setAcceptedCurrencies(["DAI", "USDC", "USDT", "TUSD", "BUSD", "sUSD", "mUSD"], [true, true, true, true, true, true, true]);
    }
  } else {
    // Normal deployment!
    // Deploy liquidity pool and currency exchange libraries
    await deployer.deploy(DydxPoolController);
    await deployer.deploy(CompoundPoolController);
    await deployer.deploy(AavePoolController);
    await deployer.deploy(MStablePoolController);
    await deployer.deploy(FusePoolController);
    await deployer.deploy(MStableExchangeController);
    await deployer.deploy(UniswapExchangeController);

    // Link libraries to RariFundController
    await deployer.link(DydxPoolController, RariFundController);
    await deployer.link(CompoundPoolController, RariFundController);
    await deployer.link(AavePoolController, RariFundController);
    await deployer.link(MStablePoolController, RariFundController);
    await deployer.link(FusePoolController, RariFundController);
    await deployer.link(MStableExchangeController, RariFundController);
    await deployer.link(UniswapExchangeController, RariFundController);

    // Deploy RariFundController and RariFundManager
    var rariFundController = await deployProxy(RariFundController, { deployer, unsafeAllowLinkedLibraries: true });
    var rariFundManager = await deployProxy(RariFundManager, [], { deployer });

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
    await rariFundController.setExchangeLossRateLimit(["live", "live-fork"].indexOf(network) >= 0 ? web3.utils.toBN(2).pow(web3.utils.toBN(255)).neg() : web3.utils.toBN(0.5e18));

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

    // Deploy ZeroExExchangeController for RariFundProxy
    await deployer.deploy(ZeroExExchangeController);

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
      await rariFundPriceConsumer.transferOwnership(process.env.LIVE_FUND_OWNER);
      await admin.transferProxyAdminOwnership(process.env.LIVE_FUND_OWNER);
    } else {
      // Register Fuse pools
      var testFusePools = require("../test/fixtures/fuse.json");
      var poolKeys = Object.keys(testFusePools);
      var poolIds = [];
      var currencyCodes = [];
      var cTokens = [];
      for (var i = 0; i < poolKeys.length; i++) {
        poolIds[i] = 100 + i;
        currencyCodes[i] = [];
        cTokens[i] = [];
        for (const currencyCode of Object.keys(testFusePools[poolKeys[i]].currencies)) {
          currencyCodes[i].push(currencyCode);
          cTokens[i].push(testFusePools[poolKeys[i]].currencies[currencyCode].cTokenAddress);
        }
      }
      await rariFundController.addFuseAssets(poolIds, currencyCodes, cTokens);

      // Development network: set all currencies to accepted
      await rariFundManager.setAcceptedCurrencies(["DAI", "USDC", "USDT", "TUSD", "BUSD", "sUSD", "mUSD"], [true, true, true, true, true, true, true]);
    }
  }
};
