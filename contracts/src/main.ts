import {
  Mina,
  isReady,
  PrivateKey,
  // Field,
  shutdown,
  fetchAccount,
} from 'snarkyjs';

import { mCashZkApp } from './mCash.js';

async function main() {
  await isReady;

  // ----------------------------------------

  // you can use this with any spec-compliant graphql endpoint
  let Berkeley = Mina.BerkeleyQANet(
    'https://proxy.berkeley.minaexplorer.com/graphql'
  );
  Mina.setActiveInstance(Berkeley);

  // to use this test, change this private key to an account which has enough MINA to pay fees
  let feePayerKey = PrivateKey.fromBase58(
    'EKFCkSABh1pWocpkewksSxGbneLHv4BUP72J9KSiqyCM8EnXAFyn'
  );
  let response = await fetchAccount({ publicKey: feePayerKey.toPublicKey() });
  if (response.error) throw Error(response.error.statusText);
  let { nonce, balance } = response.account;
  console.log(
    `Using fee payer account with nonce ${nonce}, balance ${balance}`
  );

  // this is an actual zkapp that was deployed and updated with this script:
  // https://berkeley.minaexplorer.com/wallet/B62qpRzFVjd56FiHnNfxokVbcHMQLT119My1FEdSq8ss7KomLiSZcan
  // replace this with a new zkapp key if you want to deploy another zkapp
  // and please never expose actual private keys in public code repositories like this!

  let zkappKey = PrivateKey.fromBase58(
    'EKEQiEHiY73xqpj5NgA1Fvcirp55BP4som9rAVRhKbus3fkDdSnC'
  );
  // // Log the private key to the console so we can use it later
  // console.log(`zkappKey: ${zkappKey.toBase58()}`);
  let zkappAddress = zkappKey.toPublicKey();
  // Log the public key to the console so we can use it later
  console.log(`zkappAddress: ${zkappAddress.toBase58()}`);

  let transactionFee = 100_000_000;
  // let initialState = Field(1);

  // compile the SmartContract to get the verification key (if deploying) or cache the provers (if updating)
  // this can take a while...
  console.log('Compiling smart contract...');
  // let { verificationKey } = await mCashZkApp.compile();

  // check if the zkapp is already deployed, based on whether the account exists and its first zkapp state is != 0
  let zkapp = new mCashZkApp(zkappAddress);
  let x = await zkapp.commitmentRoot.fetch();
  // let isDeployed = x?.equals(0).not().toBoolean() ?? false;
  // log the x value to the console so we can use it later
  console.log(`x: ${x?.toString()}`);

  // console.log(`isDeployed: ${isDeployed}`);

  // if the zkapp is not deployed yet, create a deploy transaction
  // if (true) {
  console.log(`Initing zkapp for public key ${zkappAddress.toBase58()}.`);
  // the `transaction()` interface is the same as when testing with a local blockchain
  let transaction = await Mina.transaction(
    { feePayerKey, fee: transactionFee },
    () => {
      // AccountUpdate.fundNewAccount(feePayerKey);
      zkapp.init(zkappKey);
    }
  );
  // if you want to inspect the transaction, you can print it out:
  // console.log(transaction.toGraphqlQuery());

  // send the transaction to the graphql endpoint
  console.log('Proving the transaction...');
  await transaction.prove();
  console.log('Sending the transaction...');
  await transaction.send();
  // }

  // if the zkapp is not deployed yet, create an update transaction
  await shutdown();
}

main();
