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


export default function App({ Component, pageProps }: AppProps) {
  let [state, setState] = useState({
    zkappWorkerClient: null as null | ZkappWorkerClient,
    hasBeenSetup: false,
    accountExists: false,
    privateKey: null as null | PrivateKey,
    publicKey: null as null | PublicKey,
    zkappPublicKey: null as null | PublicKey,
    creatingTransaction: false,
    nullifier: null as any,
    secret: null as any,
    depositNullifier: null as any,
    depositSecret: null as any,
    root: null as any,
    txStatus: null as any,
    txHash: null as any,
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

    const zkappPublicKey = PublicKey.fromBase58('B62qpgc8K7AJJJSwRu78UwJPEHmXcFsGp4QZvc5Znnbkkdi27DSJi8X');

    await zkappWorkerClient.initZkappInstance(zkappPublicKey);

    console.log('getting zkApp state...');
    await zkappWorkerClient.fetchAccount({ publicKey: zkappPublicKey })
    const root = '0x'+(await zkappWorkerClient.getCommitmentRoot()).toBigInt().toString(16);
    // convert Field to Hex
    
    console.log('current state:', root.toString());
    setState({
      ...state,
      zkappWorkerClient,
      hasBeenSetup: true,
      publicKey,
      privateKey,
      zkappPublicKey,
      accountExists,
      root
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
    try {
    setState({ ...state, txStatus: 'Generating random nullifier and secret', creatingTransaction: true });
    console.log('sending deposit transaction...');

    await state.zkappWorkerClient!.fetchAccount({ publicKey: state.publicKey! });

    // create two random numbers
    const nullifier = Field.random();
    const secret = Field.random();

    // get merkle tree from api
    const res: any = await fetch(process.env.NEXT_PUBLIC_BACKEND_URL!);
    const leaves = (await res.json()).commitments.map((l: any) => new Field(l));

    // const leaves: any[] = [
    //   // new Field('0x0000000000000000000000000000000000000000000000000000000000000000'),
    // ]
    
    const merkleTree = new MerkleTree(256);
    merkleTree.fill([Field(0), ...leaves]);

    // create a commitment
    const commitment = Poseidon.hash([nullifier, secret]);
    const lastCommitment = (await state.zkappWorkerClient!.getLastCommitment()).toBigInt();

    merkleTree.setLeaf(lastCommitment, commitment);

    const witness = new MerkleWitness256(
      merkleTree.getWitness(lastCommitment)
    )

    console.log('commitmentIndex', lastCommitment);
    console.log(leaves)
    console.log(commitment)
    console.log(merkleTree)

    setState({ ...state, txStatus: 'Creating deposit transaction' })

    await state.zkappWorkerClient!.createDepositTransaction(
      nullifier,
      secret,
      witness,
      state.privateKey!
    )

    setState({ ...state, txStatus: 'Proving deposit transaction' })

    await state.zkappWorkerClient!.proveUpdateTransaction();

    setState({ ...state, txStatus: 'Sending deposit transaction' })

    const txHash = await state.zkappWorkerClient!.sendUpdateTransaction();

    // post commitment to api
    await fetch(process.env.NEXT_PUBLIC_BACKEND_URL!, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        commitment: commitment.toString()
      })
    });

    const root = '0x'+(await state.zkappWorkerClient!.getCommitmentRoot()).toBigInt().toString(16);

    setState({ ...state, root, txStatus: `Deposit transaction hash ${txHash}`, txHash, creatingTransaction: false, depositNullifier: nullifier, depositSecret: secret });
    } catch (e) {
      alert(e);
    } 
  }

  const withdraw = async (nullifier: any, secret: any) => {
    try {
      // log nullifier and secret
      console.log('nullifier', nullifier);
      console.log('secret', secret);

      // cast to field
      const nullifierField = new Field(nullifier);
      const secretField = new Field(secret);

      setState({ ...state, creatingTransaction: true, txStatus: 'Generating trees for withdrawal' });

      await state.zkappWorkerClient!.fetchAccount({ publicKey: state.publicKey! });

      // create a merkle tree
      const commitmentTree = new MerkleTree(256);
      const nullifierTree = new MerkleTree(256);

      // get merkle tree from api
      const res: any = await (await fetch(process.env.NEXT_PUBLIC_BACKEND_URL!)).json();

      const leaves = res.commitments.map((l: any) => new Field(l));
      const nullifierLeaves = res.nullifiers.map((l: any) => new Field(l));

      // const leaves: any[] = [
      //   // new Field('0x0000000000000000000000000000000000000000000000000000000000000000'),
      // ]

      // const nullifierLeaves: any[] = [
      //   // new Field('0x0000000000000000000000000000000000000000000000000000000000000000'),
      // ]

      // fill the merkle tree with the leaves
      commitmentTree.fill([Field(0), ...leaves]);
      nullifierLeaves.forEach((value: Field) => {
        nullifierTree.setLeaf(value.toBigInt(), Field(1));
      });

      // poseidon hash the nullifier and secret
      const commitment = Poseidon.hash([nullifierField, secretField]);

      console.log('our commitment', commitment.toString());
      console.log('leaves', leaves);
      
      // find its index in leaves from res
      const commitmentIndex = leaves.findIndex((leaf: Field) => leaf.toString() === commitment.toString());

      console.log('our merkle root', commitmentTree.getRoot().toBigInt().toString(16));
      console.log('their merkle root', (await state.zkappWorkerClient!.getCommitmentRoot()).toBigInt().toString(16));

      console.log('our index', commitmentIndex);

      // get the witness
      const witness = new MerkleWitness256(
        commitmentTree.getWitness(BigInt(commitmentIndex+1))
      )

      const nullifierWitness = new MerkleWitness256(
        nullifierTree.getWitness(nullifierField.toBigInt())
      )

      setState({ ...state, txStatus: 'Creating withdrawal transaction' });

      console.log('Private key', state.privateKey);

      // create a transaction
      await state.zkappWorkerClient!.createWithdrawTransaction(
        nullifierField,
        secretField,
        state.privateKey!,
        witness,
        nullifierWitness,
      )

      setState({ ...state, txStatus: 'Proving withdrawal transaction' });

      // prove the transaction
      await state.zkappWorkerClient!.proveUpdateTransaction();

      // send the transaction

      setState({ ...state, txStatus: 'Sending withdrawal transaction' });

      const txHash = await state.zkappWorkerClient!.sendUpdateTransaction();

      console.log('txHash', txHash);

      // post commitment to api
      await fetch(process.env.NEXT_PUBLIC_BACKEND_URL!, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nullifier: nullifierField.toString()
        })
      });

      setState({ ...state, creatingTransaction: false, txStatus: `Withdrawal transaction hash ${txHash}`, txHash });
    } catch (e) {
      alert(e);
    }
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
  if (state.hasBeenSetup && state.accountExists) {
    mainContent = 
      <div style={{display: 'flex', flexDirection: 'column', marginTop: '100px', justifyContent: 'center', alignItems: 'center', width:'50vw'}}>
        <div style={{display: 'flex', flexDirection: 'row', marginTop: '100px', justifyContent: 'space-between', width:'50vw'}}>
          <div>
            <h1>Deposit</h1>
            <button onClick={deposit}>Deposit</button>
            {state.depositNullifier && state.depositSecret && <div style={{width: '90%'}}>
              <h3>Your Nullifier</h3>
              <div>{state.depositNullifier.toString()}</div>
              <h3>Your Secret</h3>
              <div>{state.depositSecret.toString()}</div>
            </div>}
          </div>
          <div>
            <h1>Withdraw</h1>
            <div>
              <label>Nullifier:</label>
              <input type="text" value={state.nullifier} onChange={(e) => setState({ ...state, nullifier: e.target.value })} />
            </div>
            <div>
              <label>Secret:</label>
              <input type="text" value={state.secret} onChange={(e) => setState({ ...state, secret: e.target.value })} />
            </div>
            <button onClick={() => withdraw(state.nullifier, state.secret)}>Withdraw</button>
          </div>
          {/* <button onClick={onSendTransaction} disabled={state.creatingTransaction}> Send Transaction </button>
          <div> Current Number in zkApp: { state.currentNum!.toString() } </div>
          <button onClick={onRefreshCurrentNum}> Get Latest State </button> */}
        </div>
        {state.txStatus && <div style={{marginTop: 50}}>
        <h1>Transaction Status</h1>
        <div>
          {state.txHash && (
            <a href={`https://berkeley.minaexplorer.com/transaction/${state.txHash}`} target="_blank" rel="noopener noreferrer">{state.txStatus}</a>
          )}
          {!state.txHash && (
            <div>{state.txStatus}</div>
          )}
          </div>
      </div>}
        {state.root && <div style={{marginTop: 50}}>
          <h1>Current Root</h1>
          <div>{state.root.toString()}</div>
        </div>}
      </div>
  }
  
  return <div style={{width: '100vw', display: 'flex', flexDirection:'column', justifyContent: 'center', alignItems: 'center'}}>
    { setup }
    { accountDoesNotExist }
    { mainContent }
  </div>
}
