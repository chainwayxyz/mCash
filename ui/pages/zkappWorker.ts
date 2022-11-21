import {
    Mina,
    isReady,
    PublicKey,
    PrivateKey,
    Field,
    fetchAccount,
    MerkleWitness
  } from 'snarkyjs'
class MerkleWitness256 extends MerkleWitness(256) {}

  type Transaction = Awaited<ReturnType<typeof Mina.transaction>>;
  
  // ---------------------------------------------------------------------------------------
  
  import type { mCashZkApp } from '../../contracts/src/mCash';
  
  const state = {
    mCashZkApp: null as null | typeof mCashZkApp,
    zkapp: null as null | mCashZkApp,
    transaction: null as null | Transaction,
  }
  
  // ---------------------------------------------------------------------------------------
  
  const functions = {
    loadSnarkyJS: async (args: {}) => {
      await isReady;
    },
    setActiveInstanceToBerkeley: async (args: {}) => {
      const Berkeley = Mina.BerkeleyQANet(
        "https://proxy.berkeley.minaexplorer.com/graphql"
      );
      Mina.setActiveInstance(Berkeley);
    },
    loadContract: async (args: {}) => {
      const { mCashZkApp } = await import('../../contracts/build/src/mCash.js');
      state.mCashZkApp = mCashZkApp;
    },
    compileContract: async (args: {}) => {
      await state.mCashZkApp!.compile();
    },
    fetchAccount: async (args: { publicKey58: string }) => {
      const publicKey = PublicKey.fromBase58(args.publicKey58);
      return await fetchAccount({ publicKey });
    },
    initZkappInstance: async (args: { publicKey58: string }) => {
      const publicKey = PublicKey.fromBase58(args.publicKey58);
      state.zkapp = new state.mCashZkApp!(publicKey);
    },
    // getNum: async (args: {}) => {
    //   const currentNum = await state.zkapp!.num.get();
    //   return JSON.stringify(currentNum.toJSON());
    // },
    // createUpdateTransaction: async (args: { feePayerPrivateKey58: string, transactionFee: number }) => {
    //   const feePayerKey = PrivateKey.fromBase58(args.feePayerPrivateKey58);
    //   const transaction = await Mina.transaction(
    //     { feePayerKey, fee: args.transactionFee },
    //     () => {
    //       state.zkapp!.update();
    //     }
    //   );
    //   state.transaction = transaction;
    // },
    getCommitmentRoot: async (args: {}) => {
      const commitmentRoot = await state.zkapp!.commitmentRoot.get();
      return JSON.stringify(commitmentRoot.toJSON());
    },
    getLastCommitment: async (args: {}) => {
      const lastCommitment = await state.zkapp!.lastCommitment.get();
      return JSON.stringify(lastCommitment.toJSON());
    },
    createDepositTransaction: async(
      args: {
        nullifier: string,
        secret: string,
        commitmentWitness: any,
        caller: string,
      }
    ) => {
      const nullifier = Field.fromJSON(args.nullifier);
      const secret = Field.fromJSON(args.secret);
      // create merkle witness from json
      console.log('Commitment Arg Witness', args.commitmentWitness);
      let witness: any = []
      args.commitmentWitness.isLeft.forEach((isLeft: any, index: any) => {
        witness.push({
          isLeft: isLeft,
          sibling: Field.fromJSON(args.commitmentWitness.path[index])
        })
      })
      const commitmentWitness = new MerkleWitness256(witness);
      console.log('Commitment Witness', commitmentWitness);
      const caller = PrivateKey.fromBase58(args.caller);
      console.log('PrivateKey', caller)
      const transaction = await Mina.transaction(
        {
          feePayerKey: caller,
          fee: 1e8
        },
        () => {
          state.zkapp!.deposit(nullifier, secret, commitmentWitness!, caller);
        }
      );
      state.transaction = transaction;
    },
    createWithdrawTransaction: async(
      args: {
        nullifier: string,
        secret: string,
        commitmentWitness: MerkleWitness256,
        nullifierWitness: MerkleWitness256,
        caller: string,
      }) => {
      const nullifier = Field.fromJSON(args.nullifier);
      const secret = Field.fromJSON(args.secret);
      const commitmentWitness = args.commitmentWitness;
      const nullifierWitness = args.nullifierWitness;
      const caller = PrivateKey.fromBase58(args.caller);
      const transaction = await Mina.transaction(
        {
          feePayerKey: caller,
          fee: 1e8
        },
        () => {
          state.zkapp!.withdraw(nullifier, secret, commitmentWitness, nullifierWitness, caller);
        }
      );
      state.transaction = transaction;
    },  
    proveUpdateTransaction: async (args: {}) => {
      await state.transaction!.prove();
    },
    sendUpdateTransaction: async (args: {}) => {
      var txn_res = await state.transaction!.send();
      const transactionHash = await txn_res!.hash();
      return transactionHash;
    },
  };
  
  // ---------------------------------------------------------------------------------------
  
  export type WorkerFunctions = keyof typeof functions;
  
  export type ZkappWorkerRequest = {
    id: number,
    fn: WorkerFunctions,
    args: any
  }
  
  export type ZkappWorkerReponse = {
    id: number,
    data: any
  }
  if (process.browser) {
    addEventListener('message', async (event: MessageEvent<ZkappWorkerRequest>) => {
      const returnData = await functions[event.data.fn](event.data.args);
  
      const message: ZkappWorkerReponse = {
        id: event.data.id,
        data: returnData,
      }
      postMessage(message)
    });
  }