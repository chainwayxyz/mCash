import { Field, Poseidon } from 'snarkyjs';

export type Witness = {
  isLeft: boolean;
  sibling: Field;
}[];

/**
 * Levels are indexed from leafs (level 0) to root (level N - 1).
 */
export class MerkleTree {
  private nodes: Record<number, Record<string, Field>> = {};
  private zeroes: Field[];

  constructor(public readonly height: number) {
    this.zeroes = [Field(0)];
    for (let i = 1; i < height; i++) {
      this.zeroes.push(Poseidon.hash([this.zeroes[i - 1], this.zeroes[i - 1]]));
    }
  }

  getNode(level: number, index: bigint): Field {
    return this.nodes[level]?.[index.toString()] ?? this.zeroes[level];
  }

  getRoot(): Field {
    return this.getNode(this.height - 1, BigInt(0));
  }

  private setNode(level: number, index: bigint, value: Field) {
    (this.nodes[level] ??= {})[index.toString()] = value;
  }

  setLeaf(index: bigint, leaf: Field) {
    this.setNode(0, index, leaf);
    let currIndex = index;
    for (let level = 1; level < this.height; level++) {
      currIndex = currIndex / BigInt(2);

      const left = this.getNode(level - 1, currIndex * BigInt(2));
      const right = this.getNode(level - 1, currIndex * BigInt(2) + BigInt(1));

      this.setNode(level, currIndex, Poseidon.hash([left, right]));
    }
  }

  getWitness(index: bigint): Witness {
    const witness = [];
    for (let level = 0; level < this.height - 1; level++) {
      const isLeft = index % BigInt(2) === BigInt(0);
      witness.push({
        isLeft,
        sibling: this.getNode(
          level,
          isLeft ? index + BigInt(1) : index - BigInt(1)
        ),
      });
      index = index / BigInt(2);
    }
    return witness;
  }

  validate(index: bigint): boolean {
    const path = this.getWitness(index);
    let hash = this.getNode(0, index);
    for (const node of path) {
      hash = Poseidon.hash(
        node.isLeft ? [hash, node.sibling] : [node.sibling, hash]
      );
    }

    return hash.toString() === this.getRoot().toString();
  }

  fill(leaves: Field[]) {
    leaves.forEach((value, index) => {
      this.setLeaf(BigInt(index), value);
    });
  }
}
