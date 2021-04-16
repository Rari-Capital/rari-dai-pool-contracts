# Rari DAI Pool: Deployed Smart Contracts

As follows are all deployments of our smart contracts on the Ethereum mainnet. See [`API.md`](API.md) for reference on these contracts' public methods and [`USAGE.md`](USAGE.md) for instructions on how to use them.

## Latest Versions

### `RariFundController`

`RariFundController` holds supplied funds and is used by the rebalancer to deposit and withdraw from pools and make exchanges.

**v1.0.0**: `0xD7590e93a2e04110Ad50ec70EADE7490F7B8228a`

### `RariFundManager`

`RariFundManager` is the Rari DAI Pool's main contract: it handles deposits, withdrawals, USD balances, interest, fees, etc.

**v1.0.0**: `0xB465BAF04C087Ce3ed1C266F96CA43f4847D9635`

### `RariFundToken`

The Rari DAI Pool Token (RDPT) is an ERC20 token used to internally account for the ownership of funds supplied to the Rari DAI Pool.

**v1.0.0**: `0x0833cfcb11A5ba89FbAF73a407831c98aD2D7648`

### `RariFundPriceConsumer`

`RariFundPriceConsumer` retrieves stablecoin prices from Chainlink's public price feeds (used by `RariFundManager` and `RariFundController`).

**v1.0.0**: `0x96ce4C781eDF07F4e3D210c919CA4F9A7ad82a7f`

### `RariFundProxy`

`RariFundProxy` includes wrapper functions built on top of `RariFundManager`: exchange and deposit, withdraw and exchange, deposit without paying gas via the Gas Station Network (GSN).

**v1.0.0**: `0x3F579F097F2CE8696Ae8C417582CfAFdE9Ec9966`
