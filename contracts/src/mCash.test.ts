import {
  deposit,
  withdraw,
  mCashZkApp,
  deploy,
  createLocalBlockchain,
  getZkAppState,
  doProofs,
} from './mCash';

import {
  isReady,
  shutdown,
  Field,
  PrivateKey,
  PublicKey,
  Poseidon,
  MerkleTree,
  MerkleWitness,
} from 'snarkyjs';

class MerkleWitness256 extends MerkleWitness(256) {}

describe('mCash', () => {
  let contract: mCashZkApp,
    deployerAccount: PrivateKey,
    payerAccount: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    nullifierTree: MerkleTree,
    commitmentTree: MerkleTree;

  beforeEach(async () => {
    await isReady;
    nullifierTree = new MerkleTree(256);
    commitmentTree = new MerkleTree(256);
    [deployerAccount, payerAccount] = createLocalBlockchain();

    console.log('Payer account', payerAccount.toString());

    // ----------------------------------------------------
    // Create a public/private key pair. The public key is our address and where we will deploy to
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();

    // Create an instance of our Square smart contract and deploy it to zkAppAddress
    contract = new mCashZkApp(zkAppAddress);
    nullifierTree = new MerkleTree(256);
    commitmentTree = new MerkleTree(256);

    if (doProofs) {
      console.log('Compiling');
      await mCashZkApp.compile();
    }
  });

  afterAll(async () => {
    setTimeout(shutdown, 0);
  });

  it('generates and deploys the `mCash` smart contract', async () => {
    const nullifierRoot = nullifierTree.getRoot();
    const commitmentRoot = commitmentTree.getRoot();
    await deploy(contract, zkAppPrivateKey, deployerAccount);

    let state = getZkAppState(contract);
    expect(state).toBeDefined();
    expect(state.nullifierRoot).toStrictEqual(nullifierRoot);
    expect(state.commitmentRoot).toStrictEqual(commitmentRoot);
  });

  it('deposits money', async () => {
    console.log('Depositing');
    const nullifierRoot = nullifierTree.getRoot();
    const commitmentRoot = commitmentTree.getRoot();
    await deploy(contract, zkAppPrivateKey, deployerAccount);

    console.log(
      `initial balance: ${contract.account.balance.get().div(1e9)} MINA`
    );
    let state = getZkAppState(contract);
    expect(state).toBeDefined();
    expect(state.nullifierRoot).toStrictEqual(nullifierRoot);
    expect(state.commitmentRoot).toStrictEqual(commitmentRoot);

    const nullifier = Field.random();
    const secret = Field.random();
    const commitment = Poseidon.hash([nullifier, secret]);
    const lastCommitment: bigint = state.lastCommitment.toBigInt();

    commitmentTree.setLeaf(lastCommitment, commitment);

    const commitmentWitness = new MerkleWitness256(
      commitmentTree.getWitness(lastCommitment)
    );

    await deposit(
      nullifier,
      secret,
      commitmentWitness,
      deployerAccount,
      zkAppAddress
      // zkAppPrivateKey
    );

    state = getZkAppState(contract);

    expect(state).toBeDefined();
    expect(state.nullifierRoot).toStrictEqual(nullifierRoot);
    expect(state.commitmentRoot).toStrictEqual(commitmentTree.getRoot());
    console.log(
      `balance after deposit: ${contract.account.balance.get().div(1e9)} MINA`
    );
  });

  it('withdraws money', async () => {
    console.log('Withdraw test');
    const nullifierRoot = nullifierTree.getRoot();
    const commitmentRoot = commitmentTree.getRoot();
    await deploy(contract, zkAppPrivateKey, deployerAccount);

    console.log(
      `initial balance: ${contract.account.balance.get().div(1e9)} MINA`
    );
    let state = getZkAppState(contract);
    expect(state).toBeDefined();
    expect(state.nullifierRoot).toStrictEqual(nullifierRoot);
    expect(state.commitmentRoot).toStrictEqual(commitmentRoot);

    const nullifier = Field.random();
    const secret = Field.random();
    const commitment = Poseidon.hash([nullifier, secret]);
    const lastCommitment: bigint = state.lastCommitment.toBigInt();

    commitmentTree.setLeaf(lastCommitment, commitment);

    const commitmentWitness = new MerkleWitness256(
      commitmentTree.getWitness(lastCommitment)
    );

    await deposit(
      nullifier,
      secret,
      commitmentWitness,
      deployerAccount,
      zkAppAddress
      // zkAppPrivateKey
    );

    state = getZkAppState(contract);

    expect(state).toBeDefined();
    expect(state.nullifierRoot).toStrictEqual(nullifierRoot);
    expect(state.commitmentRoot).toStrictEqual(commitmentTree.getRoot());

    console.log(
      `balance after deposit: ${contract.account.balance.get().div(1e9)} MINA`
    );
    const nullifierWitness = new MerkleWitness256(
      nullifierTree.getWitness(nullifier.toBigInt())
    );

    await withdraw(
      nullifier,
      secret,
      commitmentWitness,
      nullifierWitness,
      deployerAccount,
      zkAppAddress
      // zkAppPrivateKey
    );

    nullifierTree.setLeaf(nullifier.toBigInt(), Field(1));
    state = getZkAppState(contract);

    expect(state).toBeDefined();
    expect(state.nullifierRoot).toStrictEqual(nullifierTree.getRoot());
    expect(state.commitmentRoot).toStrictEqual(commitmentTree.getRoot());
    console.log(
      `balance after withdraw: ${contract.account.balance.get().div(1e9)} MINA`
    );
  });
});
