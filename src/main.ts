import { mCashZkApp } from './mCash.js';
import { isReady, shutdown, Mina, PrivateKey, AccountUpdate } from 'snarkyjs';
import { MerkleTree } from './MerkleTree.js';

(async function main() {
  await isReady;
  console.log('SnarkyJS loaded');
  const Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);

  const deployerAccount = Local.testAccounts[0].privateKey;
  // ----------------------------------------------------
  // Create a public/private key pair. The public key is our address and where we will deploy to
  const zkAppPrivateKey = PrivateKey.random();
  const zkAppAddress = zkAppPrivateKey.toPublicKey();

  // Create an instance of our Square smart contract and deploy it to zkAppAddress
  const contract = new mCashZkApp(zkAppAddress);
  const nullifierTree = new MerkleTree(256);
  const commitmentTree = new MerkleTree(256);
  const nullifierRoot = nullifierTree.getRoot();
  const commitmentRoot = commitmentTree.getRoot();

  const deployTxn = await Mina.transaction(deployerAccount, () => {
    AccountUpdate.fundNewAccount(deployerAccount);
    contract.deploy({ zkappKey: zkAppPrivateKey });
    contract.init(nullifierRoot, commitmentRoot);
  });
  await deployTxn.send().wait();

  const stateNullifierRoot = contract.nullifierRoot.get();
  const stateCommitmentRoot = contract.commitmentRoot.get();
  console.log('State nullifier root', stateNullifierRoot.toString());
  console.log('State commitment root', stateCommitmentRoot.toString());
  // Get the initial state of our zkApp account after deployment
  // ----------------------------------------------------
  console.log('Shutting down');

  await shutdown();
})();
