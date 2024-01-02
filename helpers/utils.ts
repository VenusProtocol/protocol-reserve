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
};
