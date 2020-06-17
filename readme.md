# Nitro protocol contracts tutorial

This repository represents a minimal, example package that consumes `@statechannels/nitro-protocol`as a dependency. It provides a testing environment for interacting with the nitro solidity contracts, using `jest`.

Clone the repository and `cd` into the new directory.

### Installing dependencies

**Make sure you have Yarn v1.17.3 installed**. For easy management of specific Yarn versions, we recommend using [Yarn Version Manager (YVM)](https://github.com/tophat/yvm).

To install the dependencies:

```shell
yarn
```

### Running the tutorial test

Executing

```shell
yarn tutorial lesson1.test
```

will

- start a local blockchain
- import precompiled contract bytecode from `@statechannels-nitro-protocol`
- deploy this bytecode
- run a `jest` test test for lesson 1 only

Your task is to make this tests pass, and then move on with `yarn tutorial lesson2.test` and so on up to lesson 16. Hopefully, you should learn something about the nitro contracts in the process. This exercise would be very useful for anyone interested in building a state channel wallet that runs on nitro protocol.

DApp developers may wish to build against our State Channel Wallet API (coming soon), which abstracts most of the complexity away into a much simpler interface.

### Fixing the test

Open `tutorial/lesson1.test.ts` in your text editor. Follow the instructions in a given test case block (starting with `it("...`) and make the necessary changes. If you have left the test runner open, it should automatically re-run the tests for you (with a brand new, clean blockchain). Individual tests are independent.

### Troubleshooting

You might find that you need to kill the test runner and/or the underlying ganache server, and start again following the steps above if things get into a bad state.
