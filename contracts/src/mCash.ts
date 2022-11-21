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
  Mina,
  PublicKey,
  AccountUpdate,
  MerkleWitness,
  MerkleTree,
  // fetchAccount
} from 'snarkyjs';
import { BaseMerkleWitness } from 'snarkyjs/dist/node/lib/merkle_tree';

class CustomMerkleWitness extends MerkleWitness(256) {}

// import {
//   // OffChainStorage,
//   // Update,
//   MerkleWitness256,
// } from 'experimental-zkapp-offchain-storage';

export {
  deploy,
  deposit,
  withdraw,
  getZkAppState,
  createLocalBlockchain,
  doProofs,
};

// await isReady;
const doProofs = false;

export class mCashZkApp extends SmartContract {
  events = {
    deposit: Field,
    withdraw: Field,
  };

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

  @method init(zkAppPrivateKey: PrivateKey) {
    super.init(zkAppPrivateKey);

    const emptyTreeRoot = new MerkleTree(256).getRoot();
    this.nullifierRoot.set(emptyTreeRoot);
    this.commitmentRoot.set(emptyTreeRoot);
    this.lastCommitment.set(Field(1));
  }

  @method deposit(
    nullifier: Field,
    secret: Field,
    commitmentWitness: CustomMerkleWitness,
    caller: PrivateKey
  ) {
    let payerAccountUpdate = AccountUpdate.createSigned(caller);
    payerAccountUpdate.send({ to: this.address, amount: UInt64.from(1e9) });

    // commitment = hash(nullifier, secret)
    const commitment = Poseidon.hash([nullifier, secret]);
    // verify that the commitment is in right index
    const commitmentIndex = commitmentWitness.calculateIndex();

    const lastCommitmentInContract = this.lastCommitment.get();
    this.lastCommitment.assertEquals(lastCommitmentInContract);
    lastCommitmentInContract.assertEquals(commitmentIndex);

    // verify that the commitment is a valid commitment
    const commitmentRootInContract = this.commitmentRoot.get();
    this.commitmentRoot.assertEquals(commitmentRootInContract);
    commitmentRootInContract.assertEquals(
      commitmentWitness.calculateRoot(Field(0))
    );

    const commitmentRootFromPath = commitmentWitness.calculateRoot(commitment);
    this.commitmentRoot.set(commitmentRootFromPath);
    this.lastCommitment.set(commitmentIndex.add(1));

    this.emitEvent('deposit', commitment);
  }

  @method withdraw(
    nullifier: Field,
    secret: Field,
    commitmentWitness: CustomMerkleWitness,
    nullifierWitness: CustomMerkleWitness,
    caller: PrivateKey
  ) {
    // commitment = hash(nullifier, secret)
    const commitment = Poseidon.hash([nullifier, secret]);

    const commitmentRootInContract = this.commitmentRoot.get();
    this.commitmentRoot.assertEquals(commitmentRootInContract);
    commitmentRootInContract.assertEquals(
      commitmentWitness.calculateRoot(commitment)
    );

    // verify that the nullifier is a valid nullifier
    // traverse nullifierPath
    const nullifierRootFromPath = nullifierWitness.calculateRoot(Field(0));
    const nullifierFromPath = nullifierWitness.calculateIndex();

    // verify nullifierPath
    const nullifierRootInContract = this.nullifierRoot.get();
    this.nullifierRoot.assertEquals(nullifierRootInContract);
    nullifierRootInContract.assertEquals(nullifierRootFromPath);
    nullifier.assertEquals(nullifierFromPath);

    this.nullifierRoot.set(nullifierWitness.calculateRoot(Field(1)));

    // Send mina
    this.send({
      to: caller.toPublicKey(),
      amount: UInt64.from(1e9),
    });

    this.emitEvent('withdraw', nullifier);
  }
}

// helpers
function createLocalBlockchain(): [PrivateKey, PrivateKey] {
  let Local = Mina.LocalBlockchain({
    proofsEnabled: doProofs,
  });
  Mina.setActiveInstance(Local);

  const deployerAccount = Local.testAccounts[0].privateKey;
  const payerAccount = Local.testAccounts[1].privateKey;
  return [deployerAccount, payerAccount];
}

async function deploy(
  zkAppInstance: mCashZkApp,
  zkAppPrivateKey: PrivateKey,
  account: PrivateKey
) {
  let tx = await Mina.transaction(account, () => {
    AccountUpdate.fundNewAccount(account);
    // zkAppInstance.init();
    zkAppInstance.deploy({ zkappKey: zkAppPrivateKey });
  });
  await tx.prove();
  await tx.send();

  tx = await Mina.transaction(account, () => {
    let payerAccountUpdate = AccountUpdate.createSigned(account);
    const zkAppAddress = zkAppInstance.address;
    payerAccountUpdate.send({ to: zkAppAddress, amount: UInt64.from(8e9) });
  });
  await tx.prove();
  await tx.send();
}

async function deposit(
  nullifier: Field,
  secret: Field,
  commitmentWitness: BaseMerkleWitness,
  deployerAccount: PrivateKey,
  zkAppAddress: PublicKey
  // _zkAppPrivateKey: PrivateKey
) {
  let tx = await Mina.transaction(deployerAccount, () => {
    let contract = new mCashZkApp(zkAppAddress);
    contract.deposit(nullifier, secret, commitmentWitness, deployerAccount);
    // if (!doProofs) contract.sign(zkAppPrivateKey);
  });
  try {
    await tx.prove();
    await tx.send();
    return true;
  } catch (err) {
    console.log('Transaction failed with error', err);
    return false;
  }
}

async function withdraw(
  nullifier: Field,
  secret: Field,
  commitmentWitness: BaseMerkleWitness,
  nullifierWitness: BaseMerkleWitness,
  account: PrivateKey,
  zkAppAddress: PublicKey
  // _zkAppPrivateKey: PrivateKey
) {
  let tx = await Mina.transaction(account, () => {
    let zkApp = new mCashZkApp(zkAppAddress);
    zkApp.withdraw(
      nullifier,
      secret,
      commitmentWitness,
      nullifierWitness,
      account
    );
    // if (!doProofs) zkApp.sign(zkAppPrivateKey);
  });
  try {
    await tx.prove();
    await tx.send();
    return true;
  } catch (err) {
    return false;
  }
}

function getZkAppState(contract: mCashZkApp) {
  let nullifierRoot = contract.nullifierRoot.get();
  let commitmentRoot = contract.commitmentRoot.get();
  let lastCommitment = contract.lastCommitment.get();
  return {
    nullifierRoot,
    commitmentRoot,
    lastCommitment,
  };
}
