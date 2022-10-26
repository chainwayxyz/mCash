// import { Mina, PrivateKey, Bool, PublicKey, Field } from 'snarkyjs';
// import {mCashZkApp, MerkleWitness} from './mCash';
import { MerkleTree } from './MerkleTree';

export class MerkleNode {
  public nullifierTree = new MerkleTree(256);
  public commitmentTree = new MerkleTree(256);
}
