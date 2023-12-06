module.exports = {
  istanbulReporter: ["html", "lcov", "cobertura"],
  providerOptions: {
    mnemonic: process.env.MNEMONIC,
  },
  skipFiles: ["test"],
};
