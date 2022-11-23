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
} from 'snarkyjs';
import { BaseMerkleWitness } from 'snarkyjs/dist/node/lib/merkle_tree';

class CustomMerkleWitness extends MerkleWitness(256) {}

export {
  deploy,
  deposit,
  withdraw,
  getZkAppState,
  createLocalBlockchain,
  doProofs,
};

const doProofs = false;

export class mCashZkApp extends SmartContract {
  // Events to keep off-chain state synced
  events = {
    deposit: Field,
    withdraw: Field,
  };

  // Root of the nullifier tree
  @state(Field) nullifierRoot = State<Field>();

  // Root of the commitment tree
  @state(Field) commitmentRoot = State<Field>();

  // Index of the last commitment
  @state(Field) lastCommitment = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),

      // Allows both proof and non-proof transactions for testnet only!
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

    // Initialize the trees
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
    // Get 1e9 mina from the caller
    let payerAccountUpdate = AccountUpdate.createSigned(caller);
    payerAccountUpdate.send({ to: this.address, amount: UInt64.from(1e9) });

    // commitment = hash(nullifier, secret)
    const commitment = Poseidon.hash([nullifier, secret]);

    // verify that the commitment is in right index
    const commitmentIndex = commitmentWitness.calculateIndex();

    // verify on-chain commitment index is correct
    const lastCommitmentInContract = this.lastCommitment.get();
    this.lastCommitment.assertEquals(lastCommitmentInContract);
    lastCommitmentInContract.assertEquals(commitmentIndex);

    // verify that the commitment is a valid commitment
    const commitmentRootInContract = this.commitmentRoot.get();
    this.commitmentRoot.assertEquals(commitmentRootInContract);
    commitmentRootInContract.assertEquals(
      commitmentWitness.calculateRoot(Field(0))
    );

    // update commitment tree and last commitment index
    const commitmentRootFromPath = commitmentWitness.calculateRoot(commitment);
    this.commitmentRoot.set(commitmentRootFromPath);
    this.lastCommitment.set(commitmentIndex.add(1));

    // emit deposit event
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

    // verify on-chain commitment root is correct
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

    // update nullifier tree
    this.nullifierRoot.set(nullifierWitness.calculateRoot(Field(1)));

    // Send mina to the caller
    this.send({
      to: caller.toPublicKey(),
      amount: UInt64.from(1e9),
    });

    // emit withdraw event
    this.emitEvent('withdraw', nullifier);
  }
}

// ------- HELPER FUNCTIONS --------
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
) {
  let tx = await Mina.transaction(deployerAccount, () => {
    let contract = new mCashZkApp(zkAppAddress);
    contract.deposit(nullifier, secret, commitmentWitness, deployerAccount);
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
