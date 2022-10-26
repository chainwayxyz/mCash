import {
  deploy,
  deposit,
  withdraw,
  getZkAppState,
  createLocalBlockchain,
  mCashZkApp,
  MerkleWitness,
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
  let zkAppInstance: mCashZkApp,
    account: PrivateKey,
    payer_account: PrivateKey,
    zkAppAddress: PublicKey,
    zkAppPrivateKey: PrivateKey,
    nullifierTree: MerkleTree,
    commitmentTree: MerkleTree;

  beforeEach(async () => {
    await isReady;
    [account, payer_account] = createLocalBlockchain();
    zkAppPrivateKey = PrivateKey.random();
    zkAppAddress = zkAppPrivateKey.toPublicKey();
    zkAppInstance = new mCashZkApp(zkAppAddress);
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
      zkAppInstance,
      zkAppPrivateKey,
      account,
      payer_account,
      nullifierRoot,
      commitmentRoot
    );

    let state = getZkAppState(zkAppInstance);
    expect(state).toBeDefined();
    expect(state.nullifierRoot).toStrictEqual(nullifierRoot);
    expect(state.commitmentRoot).toStrictEqual(commitmentRoot);
  });

  it('deposits money', async () => {
    const nullifierRoot = nullifierTree.getRoot();
    const commitmentRoot = commitmentTree.getRoot();

    await deploy(
      zkAppInstance,
      zkAppPrivateKey,
      account,
      payer_account,
      nullifierRoot,
      commitmentRoot
    );

    let state = getZkAppState(zkAppInstance);
    expect(state).toBeDefined();
    expect(state.nullifierRoot).toStrictEqual(nullifierRoot);
    expect(state.commitmentRoot).toStrictEqual(commitmentRoot);

    const nullifier = Field.random();
    const secret = Field.random();
    const commitment = Poseidon.hash([nullifier, secret]);
    const lastCommitment: bigint = state.lastCommitment.toBigInt();

    commitmentTree.setLeaf(lastCommitment, commitment);

    const commitmentWitness = commitmentTree.getWitness(lastCommitment);

    await deposit(
      nullifier,
      secret,
      new MerkleWitness(commitmentWitness),
      account,
      zkAppAddress,
      zkAppPrivateKey
    );

    state = getZkAppState(zkAppInstance);

    console.log('First nullifier check');
    console.log(state.nullifierRoot);
    console.log(nullifierRoot);

    console.log('First commitment check');
    console.log(state.commitmentRoot);
    console.log(commitmentTree.getRoot());

    expect(state).toBeDefined();
    expect(state.nullifierRoot).toStrictEqual(nullifierRoot);
    expect(state.commitmentRoot).toStrictEqual(commitmentTree.getRoot());
  });

  it('withdraws money', async () => {
    const nullifierRoot = nullifierTree.getRoot();
    const commitmentRoot = commitmentTree.getRoot();

    await deploy(
      zkAppInstance,
      zkAppPrivateKey,
      account,
      payer_account,
      nullifierRoot,
      commitmentRoot
    );

    let state = getZkAppState(zkAppInstance);
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
      account,
      zkAppAddress,
      zkAppPrivateKey
    );
    state = getZkAppState(zkAppInstance);
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
      account,
      zkAppAddress,
      zkAppPrivateKey
    );

    nullifierTree.setLeaf(nullifier.toBigInt(), Field(1));
    state = getZkAppState(zkAppInstance);
    expect(state).toBeDefined();
    expect(state.nullifierRoot).toStrictEqual(nullifierTree.getRoot());
    expect(state.commitmentRoot).toStrictEqual(commitmentTree.getRoot());
  });
});
