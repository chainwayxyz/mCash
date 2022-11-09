import {
  Field,
  SmartContract,
  state,
  State,
  method,
  DeployArgs,
  Permissions,
  PrivateKey,
  Poseidon,
  UInt64,
  // Mina,
  // isReady,
  PublicKey,
  AccountUpdate,
  Experimental,
  Bool,
  Signature,
  // fetchAccount
} from 'snarkyjs';

import {
  OffChainStorage,
  // Update,
  MerkleWitness256,
} from 'experimental-zkapp-offchain-storage';

// export {
//   deploy,
//   deposit,
//   withdraw,
//   getZkAppState,
//   createLocalBlockchain,
//   // doProofs,
// };

// await isReady;
// const doProofs = false;

export class mCashZkApp extends SmartContract {
  @state(PublicKey) storageServerPublicKey = State<PublicKey>();
  @state(Field) storageNumber = State<Field>();

  @state(Field) nullifierRoot = State<Field>();
  @state(Field) commitmentRoot = State<Field>();
  @state(Field) lastCommitment = State<Field>();
  public amount: UInt64 = new UInt64(UInt64.from(8e9));
  @state(Field) fee = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      // setting 'Permission' to 'none' in order to avoid Problems with signing transactions in the browser
      editState: Permissions.proofOrSignature(),
      send: Permissions.proofOrSignature(),
      editSequenceState: Permissions.proofOrSignature(),
      incrementNonce: Permissions.proofOrSignature(),
      setDelegate: Permissions.proofOrSignature(),
      setPermissions: Permissions.proofOrSignature(),
      setTokenSymbol: Permissions.proofOrSignature(),
      setVerificationKey: Permissions.proofOrSignature(),
      setVotingFor: Permissions.proofOrSignature(),
      setZkappUri: Permissions.proofOrSignature(),
    });
  }

  @method init(storageServerPublicKey: PublicKey) {
    this.storageServerPublicKey.set(storageServerPublicKey);
    this.storageNumber.set(Field.zero);

    const emptyTreeRoot = new Experimental.MerkleTree(256).getRoot();
    this.nullifierRoot.set(emptyTreeRoot);
    this.commitmentRoot.set(emptyTreeRoot);
    this.lastCommitment.set(Field(1));
  }

  @method deposit(
    nullifier: Field,
    secret: Field,
    commitmentWitness: MerkleWitness256,
    storedNewCommitmentRootNumber: Field,
    storedNewCommitmentRootSignature: Signature,
    caller: PrivateKey
  ) {
    // Get deposit of 1 MINA
    let payerAccountUpdate = AccountUpdate.createSigned(caller);
    payerAccountUpdate.send({ to: this.address, amount: UInt64.from(1e9) });

    // Add offchain storage
    let storageServerPublicKey = this.storageServerPublicKey.get();
    this.storageServerPublicKey.assertEquals(storageServerPublicKey);

    const storedNumber = this.storageNumber.get();
    this.storageNumber.assertEquals(storedNumber);

    const storedCommitmentRoot = this.commitmentRoot.get();
    this.commitmentRoot.assertEquals(storedCommitmentRoot);

    const storedLastCommitment = this.lastCommitment.get();
    this.lastCommitment.assertEquals(storedLastCommitment);

    // commitment = hash(nullifier, secret)
    const commitment = Poseidon.hash([nullifier, secret]);
    // verify that the commitment is in right index
    const commitmentIndex = commitmentWitness.calculateIndex();
    storedLastCommitment.assertEquals(commitmentIndex);
    // verify that the commitment is a valid commitment
    // actullay we don't need this since we are using the offchain storage
    storedCommitmentRoot.assertEquals(
      commitmentWitness.calculateRoot(Field.zero)
    );

    let leaf = [Field.zero];
    let newLeaf = [commitment];

    const updates = [
      {
        leaf,
        leafIsEmpty: Bool(true),
        newLeaf,
        newLeafIsEmpty: Bool(false),
        leafWitness: commitmentWitness,
      },
    ];
    const storedNewRoot = OffChainStorage.assertRootUpdateValid(
      storageServerPublicKey,
      storedNumber,
      storedCommitmentRoot,
      updates,
      storedNewCommitmentRootNumber,
      storedNewCommitmentRootSignature
    );
    this.commitmentRoot.set(storedNewRoot);
    this.storageNumber.set(storedNewCommitmentRootNumber);
    this.lastCommitment.set(commitmentIndex.add(Field(1)));

    // const storedNewRootNumber = commitmentWitness.calculateRoot(commitment);

    // this.commitmentRoot.set(commitmentRootFromPath);
    // this.lastCommitment.set(commitmentIndex.add(1));
  }

  @method withdraw(
    nullifier: Field,
    secret: Field,
    commitmentWitness: MerkleWitness256,
    nullifierWitness: MerkleWitness256,
    caller: PrivateKey
  ) {
    // commitment = hash(nullifier, secret)
    const commitment = Poseidon.hash([nullifier, secret]);

    // verify that the commitment is a valid commitment
    this.commitmentRoot.assertEquals(
      commitmentWitness.calculateRoot(commitment)
    );
    // verify that the nullifier is a valid nullifier
    // traverse nullifierPath

    const nullifierRootFromPath = nullifierWitness.calculateRoot(Field(0));
    const nullifierFromPath = nullifierWitness.calculateIndex();

    // verify nullifierPath

    this.nullifierRoot.assertEquals(nullifierRootFromPath);
    nullifier.assertEquals(nullifierFromPath);
    // Now we can withdraw the MONEYYY

    this.nullifierRoot.set(nullifierWitness.calculateRoot(Field(1)));

    // Send mina
    this.send({
      to: caller.toPublicKey(),
      amount: UInt64.from(1e9),
    });
  }
}

// // helpers

// const treeHeight = 256;
// const storageServerAddress = 'http://localhost:3001';

// function createLocalBlockchain(): [PrivateKey, PrivateKey] {
//   let Local = Mina.LocalBlockchain();
//   Mina.setActiveInstance(Local);

//   const deployerAccount = Local.testAccounts[0].privateKey;
//   const payerAccount = Local.testAccounts[1].privateKey;
//   return [deployerAccount, payerAccount];
// }

// async function deploy(
//   zkAppInstance: mCashZkApp,
//   zkAppPrivateKey: PrivateKey,
//   account: PrivateKey
// ) {
//   const serverPublicKey = await OffChainStorage.getPublicKey(
//     storageServerAddress,
//     NodeXMLHttpRequest
//   );
//   let tx = await Mina.transaction(account, () => {
//     AccountUpdate.fundNewAccount(account);
//     zkAppInstance.init(serverPublicKey);
//     zkAppInstance.deploy({ zkappKey: zkAppPrivateKey });
//   });
//   await tx.send().wait();

//   tx = await Mina.transaction(account, () => {
//     let payerAccountUpdate = AccountUpdate.createSigned(account);
//     const zkAppAddress = zkAppInstance.address;
//     payerAccountUpdate.send({ to: zkAppAddress, amount: UInt64.from(8e9) });
//   });
//   await tx.send();
// }

// async function deposit(
//   nullifier: Field,
//   secret: Field,
//   deployerAccount: PrivateKey,
//   zkAppPublicKey: PublicKey,
//   zkAppPrivateKey: PrivateKey
// ) {
//   let contract = new mCashZkApp(zkAppPublicKey);
//   // Get the commitment tree root
//   const commitmentRoot = contract.commitmentRoot.get();
//   const lastCommitment = contract.lastCommitment.get().toBigInt();
//   const idx2fields = await OffChainStorage.get(
//     storageServerAddress,
//     zkAppPublicKey,
//     treeHeight,
//     commitmentRoot,
//     NodeXMLHttpRequest
//   );
//   const tree = OffChainStorage.mapToTree(treeHeight, idx2fields);
//   const leafWitness = new MerkleWitness256(tree.getWitness(lastCommitment));

//   // get the prior leaf
//   const priorLeafIsEmpty = !idx2fields.has(lastCommitment);
//   let priorLeafNumber: Field;
//   let newLeafNumber: Field;
//   if (!priorLeafIsEmpty) {
//     // give error if the leaf is not empty
//     console.log('prior leaf is not empty');
//     return;
//     priorLeafNumber = idx2fields.get(lastCommitment)![0];
//     newLeafNumber = priorLeafNumber.add(3);
//   } else {
//     priorLeafNumber = Field.zero;
//     newLeafNumber = Poseidon.hash([nullifier, secret]);
//   }
//   idx2fields.set(lastCommitment, [ newLeafNumber ]);
//   const [storedNewStorageNumber, storedNewStorageSignature] =
//   await OffChainStorage.requestStore(
//     storageServerAddress,
//     zkAppPublicKey,
//     treeHeight,
//     idx2fields,
//     NodeXMLHttpRequest
//   );
//   console.log('changing index', lastCommitment, 'from',  priorLeafNumber.toString(), 'to', newLeafNumber.toString());

//   // update the smart contract
//   // nullifier: Field,
//   // secret: Field,
//   // commitmentWitness: MerkleWitness256,
//   // storedNewCommitmentRootNumber: Field,
//   // storedNewCommitmentRootSignature: Signature,
//   // caller: PrivateKey

//   const doUpdate = () => {
//     contract.deposit(
//       nullifier,
//       secret,
//       leafWitness,
//       storedNewStorageNumber,
//       storedNewStorageSignature,
//       deployerAccount
//     );
//   }

//   let tx = await Mina.transaction(deployerAccount, () => {
//     doUpdate();
//     if (!doProofs) contract.sign(zkAppPrivateKey);
//   });
//   try {
//     if (doProofs) await tx.prove();
//     await tx.send().wait();
//     return true;
//   } catch (err) {
//     console.log('Transaction failed with error', err);
//     return false;
//   }
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
