import BigNumber from "bignumber.js";

export const convertToUnit = (amount: string | number, decimals: number) => {
  return new BigNumber(amount).times(new BigNumber(10).pow(decimals)).toString();
};
