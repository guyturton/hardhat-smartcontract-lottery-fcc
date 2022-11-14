const { network, ethers } = require("hardhat");
const { developmentChains, networkConfig } = require("../helper-hardhat-config.js");
const { verify } = require("../utils/verify");

const VRF_FUND_SUBSCRIPTION_AMT = ethers.utils.parseEther("30");

module.exports = async function ({ getNamedAccounts, deployments }) {
    const { deploy, log } = deployments;
    const { deployer } = await getNamedAccounts();
    const chainId = network.config.chainId;
    let vrfCoordinatorsV2Address, subscriptionId, vrfCoordinatorV2Mock;

    if (developmentChains.includes(network.name)) {
        log("Deploying to local chain");
        vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock");
        vrfCoordinatorsV2Address = vrfCoordinatorV2Mock.address;
        const transactionResponce = await vrfCoordinatorV2Mock.createSubscription();
        const transactionReceipt = await transactionResponce.wait(1);
        subscriptionId = transactionReceipt.events[0].args.subId;

        // need to fund the mock
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_FUND_SUBSCRIPTION_AMT);
    } else {
        log("Deploying to network");
        vrfCoordinatorsV2Address = networkConfig[chainId]["vrfCoordinatorV2"];
        log("VRF Address: ");
        log(vrfCoordinatorsV2Address);
        subscriptionId = networkConfig[chainId]["subscriptionId"];
    }

    const gasLane = networkConfig[chainId]["gasLane"];
    const entranceFee = networkConfig[chainId]["entranceFee"];

    const callbackGasLimit = networkConfig[chainId].callbackGasLimit;
    const interval = networkConfig[chainId].interval;

    const args = [
        vrfCoordinatorsV2Address,
        entranceFee,
        gasLane,
        subscriptionId,
        callbackGasLimit,
        interval,
    ];

    // const args = [
    //     vrfCoordinatorsV2Address,
    //     subscriptionId,
    //     networkConfig[chainId]["gasLane"],
    //     networkConfig[chainId]["keepersUpdateInterval"],
    //     networkConfig[chainId]["raffleEntranceFee"],
    //     networkConfig[chainId]["callbackGasLimit"],
    // ];

    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.waitConfirmations || 1,
    });

    //Ensure the Raffle contract is a valid consumer of the VRFCoordinatorV2Mock contract.
    if (developmentChains.includes(network.name)) {
        await vrfCoordinatorV2Mock.addConsumer(subscriptionId.toNumber(), raffle.address);
    }

    if (!developmentChains.includes(network.name)) {
        log("Verifying ....");
        await verify(raffle.address, args);
    }
    log("------------------------------------");
};

module.exports.tags = ["all", "raffle"];
