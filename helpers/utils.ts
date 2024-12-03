import BigNumber from "bignumber.js";

BigNumber.config({
  FORMAT: {
    decimalSeparator: ".",
    groupSize: 0,
    groupSeparator: "",
    secondaryGroupSize: 0,
    fractionGroupSeparator: "",
    fractionGroupSize: 0,
  },
  ROUNDING_MODE: BigNumber.ROUND_DOWN,
  EXPONENTIAL_AT: 1e9,
});

export const convertToUnit = (amount: string | number, decimals: number) => {
  return new BigNumber(amount).times(new BigNumber(10).pow(decimals)).toString();
};

export const ADDRESS_ONE = "0x0000000000000000000000000000000000000001";

interface ChainAddressesConfig {
  [key: string]: string;
}

// Add all multisigs here (in case there is no NormalTimelock deployed on the chain we will fallback to this config)
export const multisigs: ChainAddressesConfig = {
  sepolia: "0x94fa6078b6b8a26f0b6edffbe6501b22a10470fb",
  ethereum: "0x285960C5B22fD66A736C7136967A3eB15e93CC67",
  opbnbtestnet: "0xb15f6EfEbC276A3b9805df81b5FB3D50C2A62BDf",
  opbnbmainnet: "0xC46796a21a3A9FAB6546aF3434F2eBfFd0604207",
  arbitrumsepolia: "0x1426A5Ae009c4443188DA8793751024E358A61C2",
  arbitrumone: "0x14e0E151b33f9802b3e75b621c1457afc44DcAA0",
  zksyncsepolia: "0xa2f83de95E9F28eD443132C331B6a9C9B7a9F866",
  zksyncmainnet: "0x751Aa759cfBB6CE71A43b48e40e1cCcFC66Ba4aa",
  opsepolia: "0xd57365EE4E850e881229e2F8Aa405822f289e78d",
  opmainnet: "0x2e94dd14E81999CdBF5deDE31938beD7308354b3",
  basesepolia: "0xdf3b635d2b535f906BB02abb22AED71346E36a00",
};
