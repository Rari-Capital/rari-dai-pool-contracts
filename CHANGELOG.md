# Changelog

## `v1.1.0` (contracts not yet deployed; all code not yet pushed)

* Copy upgrades from Rari Stable Pool `v2.4.1` to `v2.6.0`:
    * Fuse integration!
    * Upgrade to mStable mUSD v3.
    * Integrate swaps via Uniswap V2 in `RariFundController`.
    * Upgraded mStable SAVE V1 to V2 (and implemented MTA rewards).
    * Fixed bug in calculation of `outputFilledAmountUsd` in `RariFundController.marketSell0xOrdersFillOrKill`.
    * Check `fundDisabled` in `RariFundManager.upgradeFundController`.

## `v1.0.0` (contracts deployed 2020-12-12; all code pushed 2021-04-16)

* Copied Rari Stable Pool `v2.4.1` at commit [`95a3159`](https://github.com/Rari-Capital/rari-stable-pool-contracts/commit/95a315940ea830e676f24df47bda3d68c9076cbf).
* Rebranded to Rari DAI Pool and Rari DAI Pool Token (RDPT).
