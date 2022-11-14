const { assert, expect } = require("chai");
const { deployments, ethers, network } = require("hardhat");
const { developmentChains, networkConfig } = require("../../helper-hardhat-config");

developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle staging tests", function () {
          let raffleContract, raffleEntranceFee, accounts;

          // set up everything and create objects etc before starting tests
          beforeEach(async function () {
              accounts = await ethers.getSigners();
              player = accounts[1];
              raffleContract = await ethers.getContract("Raffle", player); // get the contract that was just deployed.
              raffleEntranceFee = await raffleContract.getEntranceFee();
          });

          describe("fulfillRandomWords", function () {
              it("Works with live Chainlink Automation (aka keepers) and Chainlink VRF and we get a random winnger", async function () {
                  // enter the raffle
                  const startTime = await raffleContract.getLatestTimestamp();

                  await new Promise(async (resolve, reject) => {
                      raffleContract.once("WinnerPicked", async () => {
                          console.log("WinnerPicked event fired!");
                          resolve();
                          try {
                              const recentWinner = await raffleContract.getRecentWinner();
                              const raffleState = await raffleContract.getRaffleState();
                              const winnerEndingBalance = await accounts[0].getBalance();
                              const endingTimeStamp = await raffleContract.getLatestTimestamp();

                              await expect(raffleContract.getPlayer(0)).to.be.reverted;
                              assert.equal(recentWinner.toString(), accounts[0].address);
                              assert.equal(raffleState, 0);
                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(raffleEntranceFee.toString())
                              );
                              assert(endingTimeStamp > startTime);
                              resolve();
                          } catch (error) {
                              console.log(error);
                              reject(error);
                          }
                      });

                      await raffleContract.enterRaffle({ value: raffleEntranceFee });
                      const winnerStartingBalance = await accounts[0].getBalance();
                  });
              });
          });
      });
