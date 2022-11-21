import '../styles/globals.css'
import type { AppProps } from 'next/app'

import './reactCOIServiceWorker';

import ZkappWorkerClient from './zkappWorkerClient';

import {
  PublicKey,
  PrivateKey,
  Field,
  MerkleTree,
  Poseidon,
  MerkleWitness
} from 'snarkyjs';
import { useEffect, useState } from 'react';
class MerkleWitness256 extends MerkleWitness(256) {}

let transactionfee = 100_000_000;

export default function App({ Component, pageProps }: AppProps) {
  let [state, setState] = useState({
    zkappWorkerClient: null as null | ZkappWorkerClient,
    hasBeenSetup: false,
    accountExists: false,
    currentNum: null as null | Field,
    privateKey: null as null | PrivateKey,
    publicKey: null as null | PublicKey,
    zkappPublicKey: null as null | PublicKey,
    creatingTransaction: false,
    nullifier: null as any,
    secret: null as any,
  });

  useEffect(() => {
    (async () => {
    if (!state.hasBeenSetup) {
    const zkappWorkerClient = new ZkappWorkerClient();
    
    console.log('Loading SnarkyJS...');
    await zkappWorkerClient.loadSnarkyJS();
    console.log('done');
    
    await zkappWorkerClient.setActiveInstanceToBerkeley();
    await zkappWorkerClient.setActiveInstanceToBerkeley();
    
    if (localStorage.privateKey == null) {
      localStorage.privateKey = PrivateKey.random().toBase58();
    }
    
    let privateKey = PrivateKey.fromBase58(localStorage.privateKey);
    let publicKey = privateKey.toPublicKey();
    
    console.log('using key', publicKey.toBase58());
    
    console.log('checking if account exists...');
    const res = await zkappWorkerClient.fetchAccount({ publicKey: publicKey! });
    const accountExists = res.error == null;
    
    await zkappWorkerClient.loadContract();

    console.log('compiling zkApp');
    await zkappWorkerClient.compileContract();
    console.log('zkApp compiled');

    const zkappPublicKey = PublicKey.fromBase58('B62qjtqRAFiUJCTTyQWy88uMh86L4Ynm4csm43vKA237YBNBvtmt8Hf');

    await zkappWorkerClient.initZkappInstance(zkappPublicKey);

    console.log('getting zkApp state...');
    await zkappWorkerClient.fetchAccount({ publicKey: zkappPublicKey })
    const currentNum = await zkappWorkerClient.getCommitmentRoot();
    console.log('current state:', currentNum.toString());
    setState({
      ...state,
      zkappWorkerClient,
      hasBeenSetup: true,
      publicKey,
      privateKey,
      zkappPublicKey,
      accountExists,
      currentNum
    });
  }
  })();
  }, []);

  useEffect(() => {
    (async () => {
      if (state.hasBeenSetup && !state.accountExists) {
        for (;;) {
          console.log('checking if account exists...');
          const res = await state.zkappWorkerClient!.fetchAccount({ publicKey: state.publicKey! })
          const accountExists = res.error == null;
          if (accountExists) {
            break;
          }
          await new Promise((resolve) => setTimeout(resolve, 5000));
        }
        setState({ ...state, accountExists: true });
      }
    })();
  }, [state.hasBeenSetup]);

  // add on send transaction func

  const deposit = async () => {
    setState({ ...state, creatingTransaction: true });
    console.log('sending deposit transaction...');

    await state.zkappWorkerClient!.fetchAccount({ publicKey: state.publicKey! });

    // create two random numbers
    const num1 = Field.random();
    const num2 = Field.random();

    // get merkle tree from api
    // const res: any = await fetch('https://zkapp.berkeley.edu/api/merkle-tree');
    // const leaves = res.json().leaves.map((l: any) => new Field(l));

    const leaves: any[] = [
      // new Field('0x0000000000000000000000000000000000000000000000000000000000000000'),
    ]
    
    const merkleTree = new MerkleTree(256);
    merkleTree.fill(leaves);

    // create a commitment
    const commitment = Poseidon.hash([num1, num2]);
    const lastCommitment = (await state.zkappWorkerClient!.getLastCommitment()).toBigInt();

    merkleTree.setLeaf(lastCommitment, commitment);

    const witness = new MerkleWitness256(
      merkleTree.getWitness(lastCommitment)
    )

    await state.zkappWorkerClient!.createDepositTransaction(
      num1,
      num2,
      witness,
      state.privateKey!
    )

    await state.zkappWorkerClient!.proveUpdateTransaction();

    const txHash = await state.zkappWorkerClient!.sendUpdateTransaction();

    console.log('txHash', txHash);

    setState({ ...state, creatingTransaction: false });
  }

  const withdraw = async (nullifier: Field, secret: Field) => {
    setState({ ...state, creatingTransaction: true });

    // create a merkle tree
    const commitmentTree = new MerkleTree(256);
    const nullifierTree = new MerkleTree(256);

    // get merkle tree from api
    // const res: any = await fetch('https://zkapp.berkeley.edu/api/merkle-tree');
    // const res2: any = await fetch('https://zkapp.berkeley.edu/api/nullifier-tree');

    // const leaves = res.json().leaves.map((l: any) => new Field(l));
    // const nullifierLeaves = res2.json().leaves.map((l: any) => new Field(l));

    const leaves: any[] = [
      // new Field('0x0000000000000000000000000000000000000000000000000000000000000000'),
    ]

    const nullifierLeaves: any[] = [
      // new Field('0x0000000000000000000000000000000000000000000000000000000000000000'),
    ]

    // fill the merkle tree with the leaves
    commitmentTree.fill(leaves);
    nullifierTree.fill(nullifierLeaves);

    // find the commitment
    const commitment = Poseidon.hash([nullifier, secret]);
    
    // find its index in leaves from res
    const commitmentIndex = leaves.findIndex((leaf: any) => leaf === commitment.toString());

    // get the witness
    const witness = new MerkleWitness256(
      commitmentTree.getWitness(BigInt(commitmentIndex))
    )

    const nullifierWitness = new MerkleWitness256(
      nullifierTree.getWitness(nullifier.toBigInt())
    )

    // create a transaction
    await state.zkappWorkerClient!.createWithdrawTransaction(
      nullifier,
      secret,
      state.privateKey!,
      witness,
      nullifierWitness,
    )

    // prove the transaction
    await state.zkappWorkerClient!.proveUpdateTransaction();

    // send the transaction

    const txHash = await state.zkappWorkerClient!.sendUpdateTransaction();

    console.log('txHash', txHash);

    setState({ ...state, creatingTransaction: false });
  }

  // add on refresh etc...

  let setupText = state.hasBeenSetup ? 'SnarkyJS Ready' : 'Setting up SnarkyJS...';
  let setup = <div> { setupText } </div>
  
  let accountDoesNotExist;
  if (state.hasBeenSetup && !state.accountExists) {
    const faucetLink = "https://faucet.minaprotocol.com/?address=" + state.publicKey!.toBase58();
    accountDoesNotExist = <div>
    Account does not exist. Please visit the faucet to fund this account
    <a href={faucetLink} target="_blank" rel="noreferrer"> [Link] </a>
    </div>
  }
  
  let mainContent;
  if (true) {
    mainContent = <div style={{display: 'flex', flexDirection: 'row', marginTop: '100px', justifyContent: 'space-between', width:'50vw'}}>
      <div>
        <h1>Deposit</h1>
        <button onClick={deposit}>Deposit</button>
      </div>
      <div>
        <h1>Withdraw</h1>
        <div>
          <label>Nullifier:</label>
          <input type="text" value={state.nullifier} onChange={(e) => setState({ ...state, nullifier: e.target.value })} />
        </div>
        <div>
          <label>Secret:</label>
          <input type="text" value={state.secret} onChange={(e) => setState({ ...state, secret: e.target })} />
        </div>
        <button onClick={() => withdraw(new Field(state.nullifier), new Field(state.secret))}>Withdraw</button>
      </div>
      {/* <button onClick={onSendTransaction} disabled={state.creatingTransaction}> Send Transaction </button>
      <div> Current Number in zkApp: { state.currentNum!.toString() } </div>
      <button onClick={onRefreshCurrentNum}> Get Latest State </button> */}
    </div>
  }
  
  return <div style={{width: '100vw', display: 'flex', flexDirection:'column', justifyContent: 'center', alignItems: 'center'}}>
    { setup }
    { accountDoesNotExist }
    { mainContent }
  </div>
}
