import { mCashZkApp } from './mCash.js';
import {
  OffChainStorage,
  MerkleWitness256,
} from 'experimental-zkapp-offchain-storage';

import {
  Mina,
  isReady,
  PublicKey,
  PrivateKey,
  AccountUpdate,
  UInt64,
  Poseidon,
  Field,
  shutdown,
} from 'snarkyjs';

import XMLHttpRequestTs from 'xmlhttprequest-ts';
const NodeXMLHttpRequest =
  XMLHttpRequestTs.XMLHttpRequest as any as typeof XMLHttpRequest;

const useLocal = true;
const doProofs = false;

const treeHeight = 256;
// const transactionFee = 100_000_000;
const storageServerAddress = 'http://localhost:3001';

async function main() {
  await isReady;

  // ----------------------------------------------------------------

  let feePayerKey: PrivateKey;
  let zkappPrivateKey: PrivateKey;

  if (useLocal) {
    const Local = Mina.LocalBlockchain();
    Mina.setActiveInstance(Local);

    feePayerKey = Local.testAccounts[0].privateKey;
    zkappPrivateKey = PrivateKey.random();
  } else {
    // Gives error since testnet is not implemented
    console.log('testnet not implemented');
    return;
  }

  const zkappPublicKey = zkappPrivateKey.toPublicKey();

  // ----------------------------------------
  // setup the zkapp

  const serverPublicKey = await OffChainStorage.getPublicKey(
    storageServerAddress,
    NodeXMLHttpRequest
  );

  console.log('server public key', serverPublicKey.toBase58());

  if (doProofs) {
    console.log('Compiling smart contract...');
    await mCashZkApp.compile();
  }
  const zkapp = new mCashZkApp(zkappPublicKey);

  if (useLocal) {
    console.log('Deploying smart contract...');
    await deploy(zkapp, zkappPrivateKey, serverPublicKey, feePayerKey);
    console.log('Smart contract deployed!');
  } else {
    console.log('testnet not implemented');
    return;
  }

  // ----------------------------------------
  // make a deposit

  if (useLocal) {
    console.log('Making a deposit...');
    const nullifier = Field.random();
    const secret = Field.random();
    await deposit(
      nullifier,
      secret,
      feePayerKey,
      zkappPublicKey,
      zkappPrivateKey
    );
    console.log('Deposit made!');
  } else {
    console.log('testnet not implemented');
    return;
  }

  if (useLocal) {
    console.log('Making a second deposit...');
    const nullifier = Field.random();
    const secret = Field.random();
    await deposit(
      nullifier,
      secret,
      feePayerKey,
      zkappPublicKey,
      zkappPrivateKey
    );
    console.log('Second deposit made!');
  } else {
    console.log('testnet not implemented');
    return;
  }

  await shutdown();
}

async function deploy(
  zkapp: mCashZkApp,
  zkappPrivateKey: PrivateKey,
  serverPublicKey: PublicKey,
  feePayerKey: PrivateKey
) {
  let tx = await Mina.transaction(feePayerKey, () => {
    AccountUpdate.fundNewAccount(feePayerKey);
    zkapp.deploy({ zkappKey: zkappPrivateKey });
    zkapp.init(serverPublicKey);
    if (!doProofs) zkapp.sign(zkappPrivateKey);
  });
  await tx.send().wait();

  tx = await Mina.transaction(feePayerKey, () => {
    let payerAccountUpdate = AccountUpdate.createSigned(feePayerKey);
    payerAccountUpdate.send({ to: zkapp.address, amount: UInt64.from(8e9) }); // SEND 8 ETHER TO ZKAPP
  });
  await tx.send();
}

main();

// helpers

async function deposit(
  nullifier: Field,
  secret: Field,
  deployerAccount: PrivateKey,
  zkAppPublicKey: PublicKey,
  zkAppPrivateKey: PrivateKey
) {
  let contract = new mCashZkApp(zkAppPublicKey);
  // Get the commitment tree root
  const commitmentRoot = contract.commitmentRoot.get();
  const lastCommitment = contract.lastCommitment.get().toBigInt();
  const idx2fields = await OffChainStorage.get(
    storageServerAddress,
    zkAppPublicKey,
    treeHeight,
    commitmentRoot,
    NodeXMLHttpRequest
  );
  const tree = OffChainStorage.mapToTree(treeHeight, idx2fields);
  const leafWitness = new MerkleWitness256(tree.getWitness(lastCommitment));

  // get the prior leaf
  const priorLeafIsEmpty = !idx2fields.has(lastCommitment);
  let priorLeafNumber: Field;
  let newLeafNumber: Field;
  if (!priorLeafIsEmpty) {
    // give error if the leaf is not empty
    console.log('prior leaf is not empty');
    return;
    // priorLeafNumber = idx2fields.get(lastCommitment)![0];
    // newLeafNumber = priorLeafNumber.add(3);
  } else {
    priorLeafNumber = Field.zero;
    newLeafNumber = Poseidon.hash([nullifier, secret]);
  }
  idx2fields.set(lastCommitment, [newLeafNumber]);
  const [storedNewStorageNumber, storedNewStorageSignature] =
    await OffChainStorage.requestStore(
      storageServerAddress,
      zkAppPublicKey,
      treeHeight,
      idx2fields,
      NodeXMLHttpRequest
    );
  console.log(
    'changing index',
    lastCommitment,
    'from',
    priorLeafNumber.toString(),
    'to',
    newLeafNumber.toString()
  );

  const doUpdate = () => {
    contract.deposit(
      nullifier,
      secret,
      leafWitness,
      storedNewStorageNumber,
      storedNewStorageSignature,
      deployerAccount
    );
  };

  let tx = await Mina.transaction(deployerAccount, () => {
    doUpdate();
    if (!doProofs) contract.sign(zkAppPrivateKey);
  });
  try {
    if (doProofs) await tx.prove();
    await tx.send().wait();
    return true;
  } catch (err) {
    console.log('Transaction failed with error', err);
    return false;
  }
}

// function createLocalBlockchain(): [PrivateKey, PrivateKey] {
//   let Local = Mina.LocalBlockchain();
//   Mina.setActiveInstance(Local);

//   const deployerAccount = Local.testAccounts[0].privateKey;
//   const payerAccount = Local.testAccounts[1].privateKey;
//   return [deployerAccount, payerAccount];
// }

// async function withdraw(
//   nullifier: Field,
//   secret: Field,
//   commitmentWitness: MerkleWitness256,
//   nullifierWitness: MerkleWitness256,
//   account: PrivateKey,
//   zkAppAddress: PublicKey,
//   zkAppPrivateKey: PrivateKey
// ) {
//   let tx = await Mina.transaction(account, () => {
//     let zkApp = new mCashZkApp(zkAppAddress);
//     zkApp.withdraw(
//       nullifier,
//       secret,
//       commitmentWitness,
//       nullifierWitness,
//       account
//     );
//     if (!doProofs) zkApp.sign(zkAppPrivateKey);
//   });
//   try {
//     if (doProofs) await tx.prove();
//     await tx.send().wait();
//     return true;
//   } catch (err) {
//     return false;
//   }
// }

// function getZkAppState(contract: mCashZkApp) {
//   let nullifierRoot = contract.nullifierRoot.get();
//   let commitmentRoot = contract.commitmentRoot.get();
//   let lastCommitment = contract.lastCommitment.get();
//   return {
//     nullifierRoot,
//     commitmentRoot,
//     lastCommitment,
//   };
// }
