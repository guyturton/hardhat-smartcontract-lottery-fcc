const { developmentChains } = require("../helper-hardhat-config.js");
const { ethers } = require("hardhat");

const BASE_FEE = ethers.utils.parseEther("0.25"); // 0.25 is the premium and it cost 0.25 link to make a request to get a random number from Chainlink
const GAS_PRICE_LINK = 1e9;

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const args = [GAS_PRICE_LINK, BASE_FEE];

    if (developmentChains.includes(network.name)) {
        log("Developer chain detected! Deploying mocks ....");

        // now deply a mock vrf coordinator
        await deploy("VRFCoordinatorV2Mock", { from: deployer, log: true, args: args });

        log("Mocks deployed!!");
        log("----------------------------------------");
    }
};

module.exports.tags = ["all", "mocks"];
