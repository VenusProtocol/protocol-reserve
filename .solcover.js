module.exports = {
  istanbulReporter: ["html", "lcov", "text", "json", "cobertura"],
  providerOptions: {
    mnemonic: process.env.MNEMONIC,
  },
  skipFiles: ["test"],
};
