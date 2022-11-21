import {
    fetchAccount,
    PublicKey,
    PrivateKey,
    Field,
    MerkleWitness
  } from 'snarkyjs'
  
  
class MerkleWitness256 extends MerkleWitness(256) {}
  import type { ZkappWorkerRequest, ZkappWorkerReponse, WorkerFunctions } from './zkappWorker';
  
  export default class ZkappWorkerClient {
  
    // ---------------------------------------------------------------------------------------
  
    loadSnarkyJS() {
      return this._call('loadSnarkyJS', {});
    }
  
    setActiveInstanceToBerkeley() {
      return this._call('setActiveInstanceToBerkeley', {});
    }
  
    loadContract() {
      return this._call('loadContract', {});
    }
  
    compileContract() {
      return this._call('compileContract', {});
    }
  
    fetchAccount({ publicKey }: { publicKey: PublicKey }): ReturnType<typeof fetchAccount> {
      const result = this._call('fetchAccount', { publicKey58: publicKey.toBase58() });
      return (result as ReturnType<typeof fetchAccount>);
    }
  
    initZkappInstance(publicKey: PublicKey) {
      return this._call('initZkappInstance', { publicKey58: publicKey.toBase58() });
    }

    async getCommitmentRoot() {
      const result = await this._call('getCommitmentRoot', {});
      return Field.fromJSON(JSON.parse(result as string));
    }

    async getLastCommitment() {
      const result = await this._call('getLastCommitment', {});
      return Field.fromJSON(JSON.parse(result as string));
    }

    createDepositTransaction(
      nullifier: Field,
      secret: Field,
      commitmentWitness: MerkleWitness256,
      caller: PrivateKey
    ) {
      return this._call('createDepositTransaction', { 
        nullifier: nullifier.toJSON(),
        secret: secret.toJSON(),
        commitmentWitness: commitmentWitness.toJSON(),
        caller: caller.toBase58(),
       });
    }

    createWithdrawTransaction(
      nullifier: Field,
      secret: Field,
      caller: PrivateKey,
      commitmentWitness: MerkleWitness256,
      nullifierWitness: MerkleWitness256,
    ) {
      console.log('caller', caller);
      return this._call('createWithdrawTransaction', { 
        nullifier: nullifier.toJSON(),
        secret: secret.toJSON(),
        commitmentWitness: commitmentWitness.toJSON(),
        nullifierWitness: nullifierWitness.toJSON(),
        caller: caller.toBase58(),
       });
    }
  
    // async getNum(): Promise<Field> {
    //   const result = await this._call('getNum', {});
    //   return Field.fromJSON(JSON.parse(result as string));
    // }
  
    // createUpdateTransaction(feePayerPrivateKey: PrivateKey, transactionFee: number) {
    //   const feePayerPrivateKey58 = feePayerPrivateKey.toBase58();
    //   return this._call('createUpdateTransaction', { feePayerPrivateKey58, transactionFee });
    // }
  
    proveUpdateTransaction() {
      return this._call('proveUpdateTransaction', {});
    }
  
    async sendUpdateTransaction() {
      const result = await this._call('sendUpdateTransaction', {});
      return result as string;
    }
  
    // ---------------------------------------------------------------------------------------
  
    worker: Worker;
  
    promises: { [id: number]: { resolve: (res: any) => void, reject: (err: any) => void } };
  
    nextId: number;
  
    constructor() {
      this.worker = new Worker(new URL('./zkappWorker.ts', import.meta.url))
      this.promises = {};
      this.nextId = 0;
  
      this.worker.onmessage = (event: MessageEvent<ZkappWorkerReponse>) => {
        this.promises[event.data.id].resolve(event.data.data);
        delete this.promises[event.data.id];
      };
    }
  
    _call(fn: WorkerFunctions, args: any) {
      return new Promise((resolve, reject) => {
        this.promises[this.nextId] = { resolve, reject }
  
        const message: ZkappWorkerRequest = {
          id: this.nextId,
          fn,
          args,
        };
  
        this.worker.postMessage(message);
  
        this.nextId++;
      });
    }
  }
  