import {
  deposit,
  withdraw,
  mCashZkApp,
  MerkleWitness,
  deploy,
  createLocalBlockchain,
  getZkAppState,
} from './mCash';

import {
  isReady,
  shutdown,
  Field,
  PrivateKey,
  PublicKey,
  Poseidon,
} from 'snarkyjs';

import { MerkleTree } from './MerkleTree';

/*
 INCOMPLETE
 */

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
    [deployerAccount, payerAccount] = createLocalBlockchain();
    console.log('Deployer account', deployerAccount.toString());
    console.log('Payer account', payerAccount.toString());

    // ----------------------------------------------------
    // Create a public/private key pair. The public key is our address and where we will deploy to
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();

    // Create an instance of our Square smart contract and deploy it to zkAppAddress
    contract = new mCashZkApp(zkAppAddress);
    nullifierTree = new MerkleTree(256);
    commitmentTree = new MerkleTree(256);
  });

  afterAll(async () => {
    setTimeout(shutdown, 0);
  });

  it('generates and deploys the `mCash` smart contract', async () => {
    const nullifierRoot = nullifierTree.getRoot();
    const commitmentRoot = commitmentTree.getRoot();
    await deploy(
      contract,
      zkAppPrivateKey,
      deployerAccount,
      nullifierRoot,
      commitmentRoot
    );

    let state = getZkAppState(contract);
    expect(state).toBeDefined();
    expect(state.nullifierRoot).toStrictEqual(nullifierRoot);
    expect(state.commitmentRoot).toStrictEqual(commitmentRoot);
  });

  it('deposits money', async () => {
    const nullifierRoot = nullifierTree.getRoot();
    const commitmentRoot = commitmentTree.getRoot();
    await deploy(
      contract,
      zkAppPrivateKey,
      deployerAccount,
      nullifierRoot,
      commitmentRoot
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

    const commitmentWitness = new MerkleWitness(
      commitmentTree.getWitness(lastCommitment)
    );

    await deposit(
      nullifier,
      secret,
      commitmentWitness,
      deployerAccount,
      zkAppAddress,
      zkAppPrivateKey
    );

    state = getZkAppState(contract);

    expect(state).toBeDefined();
    expect(state.nullifierRoot).toStrictEqual(nullifierRoot);
    expect(state.commitmentRoot).toStrictEqual(commitmentTree.getRoot());
  });

  it('withdraws money', async () => {
    console.log('Withdraw test');
    const nullifierRoot = nullifierTree.getRoot();
    const commitmentRoot = commitmentTree.getRoot();
    await deploy(
      contract,
      zkAppPrivateKey,
      deployerAccount,
      nullifierRoot,
      commitmentRoot
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

    const commitmentWitness = new MerkleWitness(
      commitmentTree.getWitness(lastCommitment)
    );

    await deposit(
      nullifier,
      secret,
      commitmentWitness,
      deployerAccount,
      zkAppAddress,
      zkAppPrivateKey
    );

    state = getZkAppState(contract);

    expect(state).toBeDefined();
    expect(state.nullifierRoot).toStrictEqual(nullifierRoot);
    expect(state.commitmentRoot).toStrictEqual(commitmentTree.getRoot());

    const nullifierWitness = new MerkleWitness(
      nullifierTree.getWitness(nullifier.toBigInt())
    );

    await withdraw(
      nullifier,
      secret,
      commitmentWitness,
      nullifierWitness,
      deployerAccount,
      zkAppAddress,
      zkAppPrivateKey
    );

    nullifierTree.setLeaf(nullifier.toBigInt(), Field(1));
    state = getZkAppState(contract);

    console.log('First nullifier check');
    console.log(state.nullifierRoot);
    console.log(nullifierRoot);

    console.log('First commitment check');
    console.log(state.commitmentRoot);
    console.log(commitmentTree.getRoot());

    expect(state).toBeDefined();
    expect(state.nullifierRoot).toStrictEqual(nullifierTree.getRoot());
    expect(state.commitmentRoot).toStrictEqual(commitmentTree.getRoot());
  });
});
