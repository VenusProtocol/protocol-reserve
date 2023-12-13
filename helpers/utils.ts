import { Contracts as bnbMainnetAddresses } from "@venusprotocol/venus-protocol/networks/mainnet.json";
import { Contracts as bnbTestnetAddresses } from "@venusprotocol/venus-protocol/networks/testnet.json";
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

export const convertToBigInt = (amount: string | number, decimals: number) => {
  return BigInt(convertToUnit(amount, decimals));
};

export const ADDRESS_ONE = "0x0000000000000000000000000000000000000001";

interface ChainAddressesConfig {
  [key: string]: string;
}

// Add all multisigs here (in case there is no NormalTimelock deployed on the chain we will fallback to this config)
export const multisigs: ChainAddressesConfig = {
  sepolia: "0x94fa6078b6b8a26f0b6edffbe6501b22a10470fb",
};

export const wBNBAddress: ChainAddressesConfig = {
  bscmainnet: bnbMainnetAddresses.WBNB,
  bsctestnet: bnbTestnetAddresses.WBNB,
};
