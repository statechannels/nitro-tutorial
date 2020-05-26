module.exports = {
  globalSetup: "./contract-test-setup.ts",
  globalTeardown: "./contract-test-teardown.ts",
  collectCoverageFrom: ["**/*.{js,jsx,ts,tsx}"],
  reporters: ["default"],
  testMatch: ["../tutorial/**/*.test.ts"],
  testEnvironment: "node",
  testURL: "http://localhost",
  preset: "ts-jest",
};
