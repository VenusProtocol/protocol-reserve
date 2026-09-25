import { MockContract, smock } from "@defi-wonderland/smock";
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import chai from "chai";
import { ethers } from "hardhat";
import { Address } from "hardhat-deploy/dist/types";

import { MockArraySorter, MockArraySorter__factory } from "../../typechain";
import { convertToUnit } from "../utils";

const { expect } = chai;
chai.use(smock.matchers);

let mockArraySorter: MockContract<MockArraySorter>;
let user1Address: Address;
let user2Address: Address;
let user3Address: Address;
let user4Address: Address;
let user5Address: Address;
let user1Balance: string = convertToUnit("3", 18);
let user2Balance: string = convertToUnit("2", 18);
let user3Balance: string = convertToUnit("3", 18);
let user4Balance: string = convertToUnit("0.5", 18);
let user5Balance: string = convertToUnit("0.1", 18);

async function fixture(): Promise<void> {
  const [, user1, user2, user3, user4, user5] = await ethers.getSigners();
  user1Address = user1.address;
  user2Address = user2.address;
  user3Address = user3.address;
  user4Address = user4.address;
  user5Address = user5.address;

  const MockArraySorterFactory = await smock.mock<MockArraySorter__factory>("MockArraySorter");
  mockArraySorter = await MockArraySorterFactory.deploy();
}

describe("Quicksort Tests", () => {
  let addrsArray;
  let balancesArray;

  beforeEach(async () => {
    await loadFixture(fixture);
    addrsArray = [user1Address, user2Address, user3Address, user4Address, user5Address];
    balancesArray = [user1Balance, user2Balance, user3Balance, user4Balance, user5Balance];
  });

  it("Should sort multiple addresses correctly corresponding to their balances", async () => {
    let resultArray = await mockArraySorter.sortArray(balancesArray, addrsArray);

    let expectedAddressesResult = [user1Address, user3Address, user2Address, user4Address, user5Address];
    let expectedBalancesResult = [user1Balance, user3Balance, user2Balance, user4Balance, user5Balance];

    expect(resultArray[0]).to.deep.equal(expectedAddressesResult);
    expect(resultArray[1]).to.deep.equal(expectedBalancesResult);

    user1Balance = convertToUnit("10", 18);
    user2Balance = convertToUnit("16", 18);
    addrsArray = [user1Address, user2Address];
    balancesArray = [user1Balance, user2Balance];

    resultArray = await mockArraySorter.sortArray(balancesArray, addrsArray);
    expectedAddressesResult = [user2Address, user1Address];
    expectedBalancesResult = [user2Balance, user1Balance];

    expect(resultArray[0]).to.deep.equal(expectedAddressesResult);
    expect(resultArray[1]).to.deep.equal(expectedBalancesResult);

    user1Balance = user2Balance = user3Balance = user4Balance = user5Balance = convertToUnit("8", 18);

    balancesArray = [user1Balance, user2Balance, user3Balance, user4Balance, user5Balance];
    addrsArray = [user1Address, user2Address, user3Address, user4Address, user5Address];

    resultArray = await mockArraySorter.sortArray(balancesArray, addrsArray);

    expect(resultArray[0]).to.deep.equal(addrsArray);
    expect(resultArray[1]).to.deep.equal(balancesArray);
  });
});
