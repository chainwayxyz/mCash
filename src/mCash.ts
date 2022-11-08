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
  Bool,
  arrayProp,
  CircuitValue,
  Circuit,
  Mina,
  isReady,
  PublicKey,
  AccountUpdate,
  // fetchAccount
} from 'snarkyjs';
import { Witness } from './MerkleTree';

export { deploy, deposit, withdraw, getZkAppState, createLocalBlockchain };

await isReady;

export class MerkleWitness extends CircuitValue {
  @arrayProp(Field, 255) path: Field[];
  @arrayProp(Bool, 255) isLeft: Bool[];

  constructor(witness: Witness) {
    super();

    this.path = witness.map((x) => x.sibling);
    this.isLeft = witness.map((x) => Bool(x.isLeft));
  }

  calculateRoot(leaf: Field): Field {
    let hash = leaf;

    for (let i = 1; i < 256; ++i) {
      const left = Circuit.if(this.isLeft[i - 1], hash, this.path[i - 1]);
      const right = Circuit.if(this.isLeft[i - 1], this.path[i - 1], hash);
      hash = Poseidon.hash([left, right]);
    }

    return hash;
  }

  calculateIndex(): Field {
    let powerOfTwo = Field(1);
    let index = Field(0);

    for (let i = 1; i < 256; ++i) {
      index = Circuit.if(this.isLeft[i - 1], index, index.add(powerOfTwo));
      powerOfTwo = powerOfTwo.mul(2);
    }

    return index;
  }
}

export class mCashZkApp extends SmartContract {
  @state(Field) nullifierRoot = State<Field>();
  @state(Field) commitmentRoot = State<Field>();
  @state(Field) lastCommitment = State<Field>();
  public amount: UInt64 = new UInt64(Field(100_000_000));
  @state(Field) fee = State<Field>();

  deploy(args: DeployArgs) {
    super.deploy(args);
    this.setPermissions({
      ...Permissions.default(),
      editState: Permissions.none(),
    });
  }

  @method init(_nullifierRoot: Field, _commitmentRoot: Field) {
    this.nullifierRoot.set(_nullifierRoot);
    this.commitmentRoot.set(_commitmentRoot);
    this.lastCommitment.set(Field(1));
    this.fee.set(Field(1));
    // this.balance.addInPlace(UInt64.fromNumber(initialBalance));
  }

  @method deposit(
    nullifier: Field,
    secret: Field,
    commitmentWitness: MerkleWitness
    // caller: PrivateKey
  ) {
    // let fee = this.fee.get();
    // this.fee.assertEquals(fee);

    // this.balance.addInPlace(this.amount); // works?

    // commitment = hash(nullifier, secret)
    const commitment = Poseidon.hash([nullifier, secret]);
    // verify that the commitment is in right index
    const commitmentIndex = commitmentWitness.calculateIndex();
    this.lastCommitment.assertEquals(commitmentIndex);
    // verify that the commitment is a valid commitment
    this.commitmentRoot.assertEquals(commitmentWitness.calculateRoot(Field(0)));

    const commitmentRootFromPath = commitmentWitness.calculateRoot(commitment);
    this.commitmentRoot.set(commitmentRootFromPath);
    this.lastCommitment.set(commitmentIndex.add(1));
  }

  @method withdraw(
    nullifier: Field,
    secret: Field,
    commitmentWitness: MerkleWitness,
    nullifierWitness: MerkleWitness,
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
      amount: this.amount,
    });
  }
}

// helpers
function createLocalBlockchain(): [PrivateKey, PrivateKey] {
  let Local = Mina.LocalBlockchain();
  Mina.setActiveInstance(Local);

  const account = Local.testAccounts[0].privateKey;
  const payer_account = Local.testAccounts[1].privateKey;
  return [account, payer_account];
}
let transactionFee = 10_000_000;
let initialBalance = 100_000_000;

async function deploy(
  zkAppInstance: mCashZkApp,
  zkAppPrivateKey: PrivateKey,
  account: PrivateKey,
  payer_account: PrivateKey,
  nullifierRoot: Field,
  commitmentRoot: Field
) {
  let tx = await Mina.transaction(account, () => {
    AccountUpdate.fundNewAccount(account, { initialBalance });
    zkAppInstance.deploy({ zkappKey: zkAppPrivateKey });

    zkAppInstance.init(nullifierRoot, commitmentRoot);
  });
  await tx.send().wait();

  // console.log('Mina balance');
  // console.log(await Mina.getBalance(account.toPublicKey()).toJSON());
  // let response = await fetchAccount(account.toPublicKey());
  // if (response.error) throw Error(response.error.statusText);
  // let { nonce, balance } = response.account;
  // console.log(`Using fee payer account with nonce ${nonce}, balance ${balance}`);
}

async function deposit(
  nullifier: Field,
  secret: Field,
  commitmentWitness: MerkleWitness,
  account: PrivateKey,
  zkAppAddress: PublicKey,
  zkAppPrivateKey: PrivateKey
) {
  let tx = await Mina.transaction(
    { feePayerKey: account, fee: transactionFee },
    () => {
      let zkApp = new mCashZkApp(zkAppAddress);
      let accountUpdate = AccountUpdate.createSigned(account);
      accountUpdate.send({
        to: zkAppAddress,
        amount: UInt64.fromNumber(100_000_000),
      });

      zkApp.deposit(nullifier, secret, commitmentWitness);
      // zkApp.deposit(nullifier, secret, commitmentWitness, account);
      zkApp.sign(zkAppPrivateKey);
    }
  );
  try {
    await tx.send().wait();
    return true;
  } catch (err) {
    console.log('Transaction failed with error', err);
    return false;
  }
}

async function withdraw(
  nullifier: Field,
  secret: Field,
  commitmentWitness: MerkleWitness,
  nullifierWitness: MerkleWitness,
  account: PrivateKey,
  zkAppAddress: PublicKey,
  zkAppPrivateKey: PrivateKey
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
    zkApp.sign(zkAppPrivateKey);
  });
  try {
    await tx.send().wait();
    return true;
  } catch (err) {
    return false;
  }
}

function getZkAppState(zkAppInstance: mCashZkApp) {
  let nullifierRoot = zkAppInstance.nullifierRoot.get();
  let commitmentRoot = zkAppInstance.commitmentRoot.get();
  let lastCommitment = zkAppInstance.lastCommitment.get();
  return {
    nullifierRoot,
    commitmentRoot,
    lastCommitment,
  };
}
