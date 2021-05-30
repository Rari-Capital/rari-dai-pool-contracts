// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.5.17;

import "@openzeppelin/contracts-ethereum-package/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-ethereum-package/contracts/token/ERC20/SafeERC20.sol";

import "../../external/mstable/ISavingsContract.sol";

/**
 * @title MStablePoolController
 * @author David Lucid <david@rari.capital> (https://github.com/davidlucid)
 * @dev This library handles deposits to and withdrawals from mStable liquidity pools.
 */
library MStablePoolController {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    /**
     * @dev mStable mUSD ERC20 token contract address.
     */
    address constant private MUSD_TOKEN_CONTRACT = 0xe2f2a5C287993345a840Db3B0845fbC70f5935a5;

    /**
     * @dev mStable SavingsContract contract address.
     */
    address constant private SAVINGS_CONTRACT = 0xcf3F73290803Fc04425BEE135a4Caeb2BaB2C2A1;

    /**
     * @dev mStable SavingsContract contract object.
     */
    ISavingsContract constant private _savingsContract = ISavingsContract(SAVINGS_CONTRACT);

    /**
     * @dev Returns the fund's mUSD token balance supplied to the mStable savings contract.
     */
    function getBalance() external view returns (uint256) {
        return _savingsContract.creditBalances(address(this)).mul(_savingsContract.exchangeRate()).div(1e18);
    }

    /**
     * @dev Approves mUSD tokens to the mStable savings contract without spending gas on every deposit.
     * @param amount Amount of mUSD tokens to approve to the mStable savings contract.
     */
    function approve(uint256 amount) external {
        IERC20 token = IERC20(MUSD_TOKEN_CONTRACT);
        uint256 allowance = token.allowance(address(this), SAVINGS_CONTRACT);
        if (allowance == amount) return;
        if (amount > 0 && allowance > 0) token.safeApprove(SAVINGS_CONTRACT, 0);
        token.safeApprove(SAVINGS_CONTRACT, amount);
        return;
    }

    /**
     * @dev Deposits mUSD tokens to the mStable savings contract.
     * @param amount The amount of mUSD tokens to be deposited.
     */
    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0.");
        uint256 creditsIssued = _savingsContract.depositSavings(amount);
        require(creditsIssued > 0, "Error calling depositSavings on mStable savings contract: no credits issued.");
    }

    /**
     * @dev Withdraws mUSD tokens from the mStable savings contract.
     * May withdraw slightly more than `amount` due to imperfect precision.
     * @param amount The amount of mUSD tokens to be withdrawn.
     */
    function withdraw(uint256 amount) external {
        require(amount > 0, "Amount must be greater than 0.");
        uint256 exchangeRate = _savingsContract.exchangeRate();
        uint256 credits = amount.mul(1e18).div(exchangeRate);
        if (credits.mul(exchangeRate).div(1e18) < amount) credits++; // Round up if necessary (i.e., if the division above left a remainder)
        uint256 mAssetReturned = _savingsContract.redeem(credits);
        require(mAssetReturned > 0, "Error calling redeem on mStable savings contract: no mUSD returned.");
    }

    /**
     * @dev Withdraws all funds from the mStable savings contract.
     */
    function withdrawAll() external returns (bool) {
        uint256 creditBalance = _savingsContract.creditBalances(address(this));
        if (creditBalance <= 0) return false;
        uint256 mAssetReturned = _savingsContract.redeem(creditBalance);
        require(mAssetReturned > 0, "Error calling redeem on mStable savings contract: no mUSD returned.");
        return true;
    }
}
