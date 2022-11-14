//const { inputToConfig, compile } = require("@ethereum-waffle/compiler");
const { assert, expect } = require("chai");
const { deployments, ethers, network } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle unit tests", function () {
          let raffleContract, vrfCoordinatorV2Mock, raffleEntranceFee, interval, accounts;
          const chainId = network.config.chainId;

          // set up everything and create objects etc before starting tests
          beforeEach(async function () {
              //deployer = (await getNamedAccounts()).deployer;
              await deployments.fixture(["all"]); // we are going to deply everything

              accounts = await ethers.getSigners();
              player = accounts[1];
              raffleContract = await ethers.getContract("Raffle", player); // get the contract that was just deployed.
              vrfCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock"); // get the chainlink mock
              raffleEntranceFee = await raffleContract.getEntranceFee();
              interval = await raffleContract.getInterval();
          });

          describe("constructor", function () {
              it("creates the constructor correctly", async function () {
                  // make sure raffle state is open wehn creating the contract object
                  const raffleState = await raffleContract.getRaffleState();
                  assert.equal(raffleState.toString(), "0"); // 0 is open from the enum

                  assert.equal(
                      interval.toString(),
                      networkConfig[network.config.chainId]["interval"]
                  );
              });

              describe("enterRaffle", function () {
                  it("reverts when you don't pay enough", async function () {
                      await expect(raffleContract.enterRaffle()).to.be.revertedWith(
                          "Raffle__NotEnoughETHEntered"
                      );
                  });
                  it("tests to get entrance fee", async function () {
                      assert.equal(raffleEntranceFee.toString(), ethers.utils.parseEther("0.01"));
                  });
                  //   it("tests to see if player entered raffle", async function () {
                  //       await raffle.enterRaffle({ value: raffleEntraceFee });
                  //       const numPlayers = await raffle.getNumOfPlayers();
                  //       assert.equal(numPlayers, 1);
                  //   });
                  it("adds players to the raffle", async function () {
                      await raffleContract.enterRaffle({ value: raffleEntranceFee });
                      const playerFromContract = await raffleContract.getPlayer(0); // since raffle contract just deployed, player is the same as the deployer
                      assert.equal(player.address, playerFromContract);
                  });
                  it("emits event on enter when entering the raffle", async function () {
                      // will test that an event fired within the enterRaffle function
                      await expect(
                          raffleContract.enterRaffle({ value: raffleEntranceFee })
                      ).to.emit(raffleContract, "RaffleEnter");
                  });
                  it("tests to make sure you can't enter raffle when its calculating the new winner", async function () {
                      await raffleContract.enterRaffle({ value: raffleEntranceFee });
                      // allows us to speed up the time delay for our local network so we can test right away and not waith for the interval.
                      await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                      // mine a block since waiting ofr interval means nothing unless we can mine a block.
                      await network.provider.request({ method: "evm_mine", params: [] });
                      // pretend to be a Chainlink automonous node and kick off the perform upkeep method a put raffle into a state of calculating
                      await raffleContract.performUpkeep([]);

                      // now test to make sure you can't enter raffle
                      await expect(
                          raffleContract.enterRaffle({ value: raffleEntranceFee })
                      ).to.be.revertedWith("Raffle__NotOpen");
                  });
              });
          });

          describe("checkUpKeep", function () {
              it("returns false if not enough ETH is sent to join raffle", async function () {
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  // mine a block since waiting ofr interval means nothing unless we can mine a block.
                  await network.provider.request({ method: "evm_mine", params: [] });

                  // call a public function without actually creating a transaction.  callStatic
                  const { upKeepNeed } = await raffleContract.callStatic.checkUpkeep([]);
                  assert(!upKeepNeed);
              });

              it("returns false if raffle is not open", async function () {
                  await raffleContract.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  await raffleContract.performUpkeep([]); // changes the state to calculating
                  const raffleState = await raffleContract.getRaffleState(); // stores the new state
                  const { upkeepNeeded } = await raffleContract.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert.equal(raffleState.toString() == "1", upkeepNeeded == false);
              });

              it("returns false if enough time hasn't passed", async () => {
                  await raffleContract.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() - 5]); // use a higher number here if this test fails
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const { upkeepNeeded } = await raffleContract.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(!upkeepNeeded);
              });
              it("returns true if enough time has passed, has players, eth, and is open", async () => {
                  await raffleContract.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const { upkeepNeeded } = await raffleContract.callStatic.checkUpkeep("0x"); // upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers)
                  assert(upkeepNeeded);
              });
          });

          describe("performUpKeep", function () {
              it("can only run in checkUpkeep is true", async function () {
                  await raffleContract.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const trans = await raffleContract.performUpkeep([]);
                  assert(trans);
              });

              it("reverts when checkUpKeep is false", async function () {
                  await expect(raffleContract.performUpkeep([])).to.be.revertedWith(
                      "Raffle__UpkeepNotNeeded"
                  );
              });
              it("updates the raffle state, emits an event, and calls the vrf coordinator", async function () {
                  await raffleContract.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
                  const transResponse = await raffleContract.performUpkeep([]);
                  const transReceipt = await transResponse.wait(1);
                  const requestId = await transReceipt.events[1].args.requestId;
                  const raffleState = await raffleContract.getRaffleState();
                  assert(requestId.toNumber() > 0);
                  assert(raffleState.toString() == "1");
              });
          });

          describe("fulfillRandomWords", function () {
              beforeEach(async function () {
                  await raffleContract.enterRaffle({ value: raffleEntranceFee });
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1]);
                  await network.provider.request({ method: "evm_mine", params: [] });
              });
              it("can only be called if performUpKeep has been called", async function () {
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(0, raffleContract.address)
                  ).to.be.revertedWith("nonexistent request");
                  await expect(
                      vrfCoordinatorV2Mock.fulfillRandomWords(1, raffleContract.address)
                  ).to.be.revertedWith("nonexistent request");
              });

              it("picks a winner, resets, and sends money", async () => {
                  const additionalEntrances = 3; // to test
                  const startingIndex = 2;
                  for (let i = startingIndex; i < startingIndex + additionalEntrances; i++) {
                      // i = 2; i < 5; i=i+1
                      raffle = raffleContract.connect(accounts[i]); // Returns a new instance of the Raffle contract connected to player
                      await raffle.enterRaffle({ value: raffleEntranceFee });
                  }
                  const startingTimeStamp = await raffle.getLatestTimestamp(); // stores starting timestamp (before we fire our event)

                  // This will be more important for our staging tests...
                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          // event listener for WinnerPicked
                          console.log("WinnerPicked event fired!");
                          // assert throws an error if it fails, so we need to wrap
                          // it in a try/catch so that the promise returns event
                          // if it fails.
                          try {
                              // Now lets get the ending values...
                              const recentWinner = await raffle.getRecentWinner();
                              const raffleState = await raffle.getRaffleState();
                              const winnerBalance = await accounts[2].getBalance();
                              const endingTimeStamp = await raffle.getLatestTimestamp();
                              await expect(raffle.getPlayer(0)).to.be.reverted;
                              // Comparisons to check if our ending values are correct:
                              assert.equal(recentWinner.toString(), accounts[2].address);
                              assert.equal(raffleState, 0);
                              assert.equal(
                                  winnerBalance.toString(),
                                  startingBalance // startingBalance + ( (raffleEntranceFee * additionalEntrances) + raffleEntranceFee )
                                      .add(
                                          raffleEntranceFee
                                              .mul(additionalEntrances)
                                              .add(raffleEntranceFee)
                                      )
                                      .toString()
                              );
                              assert(endingTimeStamp > startingTimeStamp);
                              resolve(); // if try passes, resolves the promise
                          } catch (e) {
                              reject(e); // if try fails, rejects the promise
                          }
                      });

                      // kicking off the event by mocking the chainlink keepers and vrf coordinator
                      const tx = await raffle.performUpkeep("0x");
                      const txReceipt = await tx.wait(1);
                      const startingBalance = await accounts[2].getBalance();
                      await vrfCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.events[1].args.requestId,
                          raffle.address
                      );
                  });
              });
          });
      });
