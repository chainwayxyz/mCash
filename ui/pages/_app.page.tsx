import '../styles/globals.css'
import type { AppProps } from 'next/app'

import './reactCOIServiceWorker';

import ZkappWorkerClient from './zkappWorkerClient';

import {
  PublicKey,
  PrivateKey,
  Field
} from 'snarkyjs';
import { useEffect, useState } from 'react';

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

    const zkappPublicKey = PublicKey.fromBase58('B62qrBBEARoG78KLD1bmYZeEirUfpNXoMPYQboTwqmGLtfqAGLXdWpU');

    await zkappWorkerClient.initZkappInstance(zkappPublicKey);

    console.log('getting zkApp state...');
    await zkappWorkerClient.fetchAccount({ publicKey: zkappPublicKey })
    const currentNum = await zkappWorkerClient.getNum();
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

  // add on refresh etc...


  return <Component {...pageProps} />
}
