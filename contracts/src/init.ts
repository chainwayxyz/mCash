import { Mina, isReady, PrivateKey, shutdown, fetchAccount } from 'snarkyjs';

import { mCashZkApp } from './mCash.js';

async function main() {
  await isReady;

  let Berkeley = Mina.BerkeleyQANet(
    'https://proxy.berkeley.minaexplorer.com/graphql'
  );
  Mina.setActiveInstance(Berkeley);

  let feePayerKey = PrivateKey.fromBase58(
    'EKFCkSABh1pWocpkewksSxGbneLHv4BUP72J9KSiqyCM8EnXAFyn'
  );

  let response = await fetchAccount({ publicKey: feePayerKey.toPublicKey() });
  if (response.error) throw Error(response.error.statusText);
  let { nonce, balance } = response.account;

  console.log(
    `Using fee payer account with nonce ${nonce}, balance ${balance}`
  );

  let zkappKey = PrivateKey.fromBase58(
    'EKEQiEHiY73xqpj5NgA1Fvcirp55BP4som9rAVRhKbus3fkDdSnC'
  );

  let zkappAddress = zkappKey.toPublicKey();

  // Log the public key to the console so we can use it later
  console.log(`zkappAddress: ${zkappAddress.toBase58()}`);

  let transactionFee = 100_000_000;
  // let initialState = Field(1);

  // check if the zkapp is already deployed, based on whether the account exists and its first zkapp state is != 0
  let zkapp = new mCashZkApp(zkappAddress);
  let x = await zkapp.commitmentRoot.fetch();
  // let isDeployed = x?.equals(0).not().toBoolean() ?? false;
  // log the x value to the console so we can use it later
  console.log(`x: ${x?.toString()}`);

  console.log(`Initing zkapp for public key ${zkappAddress.toBase58()}.`);

  let transaction = await Mina.transaction(
    { feePayerKey, fee: transactionFee },
    () => {
      zkapp.init(zkappKey);
    }
  );

  console.log('Proving the transaction...');
  await transaction.prove();
  console.log('Sending the transaction...');
  await transaction.send();

  await shutdown();
}

main();
