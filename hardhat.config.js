require("@nomiclabs/hardhat-waffle");
require("@nomiclabs/hardhat-etherscan");
require("hardhat-deploy");
require("solidity-coverage");
require("hardhat-gas-reporter");
require("hardhat-contract-sizer");
require("dotenv").config();

const GOERLI_RPC_URL = process.env.GOERLI_RPC_URL || "https://goerli.com";
const PRIVATE_KEY = process.env.PRIVATE_KEY || "@kry";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "@kry";
const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY || "@kry";
const REPORT_GAS = process.env.REPORT_GAS || false;

module.exports = {
    defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
            blockConfirmations: 1,
        },

        goerli: { chainId: 5, blockConfirmations: 6, url: GOERLI_RPC_URL, accounts: [PRIVATE_KEY] },
    },
    solidity: {
        compilers: [
            {
                version: "0.8.7",
            },
            {
                version: "0.4.24",
            },
        ],
    },
    namedAccounts: {
        deployer: {
            default: 0, // here this will by default take the first account as deployer
            1: 0, // similarly on mainnet it will take the first account as deployer. Note though that depending on how hardhat network are configured, the account 0 on one network can be different than on another
        },
        player: {
            default: 1,
        },
    },
    gasReporter: {
        enabled: REPORT_GAS,
        currency: "CAD",
        outputFile: "gas-report.txt",
        noColors: true,
        // coinmarketcap: process.env.COINMARKETCAP_API_KEY,
    },
    mocha: {
        timeout: 1000000, // 200 seconds max
    },
    etherscan: {
        // yarn hardhat verify --network <NETWORK> <CONTRACT_ADDRESS> <CONSTRUCTOR_PARAMETERS>
        apiKey: {
            goerli: ETHERSCAN_API_KEY,
        },
    },
};
