/**
 * Merkle Tree Tests
 * Tests for real Merkle tree implementation with Poseidon hash
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  IncrementalMerkleTree,
  createMerkleTree,
  verifyMerkleProof,
  computeRootFromProof,
  initZeroValues,
  getZeroValue,
  DEFAULT_TREE_DEPTH,
} from '../privacycash/merkle';
import { SNARK_FIELD_SIZE, isValidFieldElement } from '../privacycash/poseidon';

describe('Merkle Tree Constants', () => {
  it('should have correct default tree depth', () => {
    expect(DEFAULT_TREE_DEPTH).toBe(20);
  });

  it('should initialize zero values', async () => {
    await initZeroValues(5);
    const zeroValue = await getZeroValue(0);
    expect(zeroValue).toBeDefined();
    expect(typeof zeroValue).toBe('bigint');
  });
});

describe('IncrementalMerkleTree Class', () => {
  let tree: IncrementalMerkleTree;

  beforeEach(async () => {
    tree = await createMerkleTree(10);
  });

  describe('constructor', () => {
    it('should create tree with specified depth', () => {
      expect(tree.depth).toBe(10);
    });

    it('should start with zero leaves', () => {
      expect(tree.getNextIndex()).toBe(0);
    });

    it('should have initial root', () => {
      const root = tree.getRoot();
      expect(typeof root).toBe('bigint');
      expect(isValidFieldElement(root)).toBe(true);
    });
  });

  describe('insert', () => {
    it('should insert leaf and return index', async () => {
      const leaf = BigInt(12345);
      const index = await tree.insert(leaf);
      expect(index).toBe(0);
      expect(tree.getNextIndex()).toBe(1);
    });

    it('should update root after insertion', async () => {
      const rootBefore = tree.getRoot();
      await tree.insert(BigInt(12345));
      const rootAfter = tree.getRoot();
      expect(rootAfter).not.toBe(rootBefore);
    });

    it('should insert multiple leaves', async () => {
      const indices: number[] = [];
      for (let i = 0; i < 10; i++) {
        indices.push(await tree.insert(BigInt(i * 1000)));
      }
      expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
      expect(tree.getNextIndex()).toBe(10);
    });

    it('should produce different roots for different leaves', async () => {
      const tree1 = await createMerkleTree(10);
      const tree2 = await createMerkleTree(10);

      await tree1.insert(BigInt(100));
      await tree2.insert(BigInt(200));

      expect(tree1.getRoot()).not.toBe(tree2.getRoot());
    });
  });

  describe('generateProof', () => {
    it('should generate valid proof for inserted leaf', async () => {
      const leaf = BigInt(12345);
      await tree.insert(leaf);

      const proof = await tree.generateProof(0);
      expect(proof).toBeDefined();
      expect(proof.pathElements.length).toBe(tree.depth);
      expect(proof.pathIndices.length).toBe(tree.depth);
      expect(proof.root).toBe(tree.getRoot());
    });

    it('should generate proof with binary path indices', async () => {
      await tree.insert(BigInt(12345));
      const proof = await tree.generateProof(0);

      // All path indices should be 0 or 1
      for (const idx of proof.pathIndices) {
        expect(idx === 0 || idx === 1).toBe(true);
      }
    });

    it('should generate different proofs for different leaves', async () => {
      await tree.insert(BigInt(100));
      await tree.insert(BigInt(200));

      const proof0 = await tree.generateProof(0);
      const proof1 = await tree.generateProof(1);

      // Proofs should have same root but different paths
      expect(proof0.root).toBe(proof1.root);
      expect(proof0.pathIndices).not.toEqual(proof1.pathIndices);
    });
  });

  describe('root history', () => {
    it('should track historical roots', async () => {
      // Insert leaves and track roots after each insertion
      const roots: bigint[] = [];

      for (let i = 0; i < 5; i++) {
        await tree.insert(BigInt((i + 1) * 1000));
        roots.push(tree.getRoot());
      }

      // All roots after insertions should be different
      const uniqueRoots = new Set(roots.map((r) => r.toString()));
      expect(uniqueRoots.size).toBe(roots.length);

      // Should be able to check known roots
      for (const root of roots) {
        expect(tree.isKnownRoot(root)).toBe(true);
      }
    });
  });
});

describe('Helper Functions', () => {
  describe('verifyMerkleProof', () => {
    it('should verify valid proof', async () => {
      const tree = await createMerkleTree(10);
      const leaf = BigInt(12345);
      await tree.insert(leaf);

      const proof = await tree.generateProof(0);
      const isValid = await verifyMerkleProof(leaf, proof);
      expect(isValid).toBe(true);
    });

    it('should reject invalid leaf', async () => {
      const tree = await createMerkleTree(10);
      const leaf = BigInt(12345);
      await tree.insert(leaf);

      const proof = await tree.generateProof(0);
      const isValid = await verifyMerkleProof(BigInt(99999), proof);
      expect(isValid).toBe(false);
    });

    it('should verify multiple leaves', async () => {
      const tree = await createMerkleTree(10);
      const leaves = [BigInt(100), BigInt(200), BigInt(300)];

      for (const leaf of leaves) {
        await tree.insert(leaf);
      }

      for (let i = 0; i < leaves.length; i++) {
        const proof = await tree.generateProof(i);
        expect(await verifyMerkleProof(leaves[i], proof)).toBe(true);
      }
    });
  });

  describe('computeRootFromProof', () => {
    it('should compute correct root', async () => {
      const tree = await createMerkleTree(10);
      const leaf = BigInt(12345);
      await tree.insert(leaf);

      const proof = await tree.generateProof(0);
      const computedRoot = await computeRootFromProof(leaf, proof);
      expect(computedRoot).toBe(tree.getRoot());
    });
  });
});

describe('Large Tree Tests', () => {
  it('should handle many insertions', async () => {
    const tree = await createMerkleTree(15);
    const leaves: bigint[] = [];

    for (let i = 0; i < 100; i++) {
      const leaf = BigInt(i * 12345 + 67890);
      leaves.push(leaf);
      await tree.insert(leaf);
    }

    expect(tree.getNextIndex()).toBe(100);

    // Verify random proofs
    for (const idx of [0, 50, 99]) {
      const proof = await tree.generateProof(idx);
      expect(await verifyMerkleProof(leaves[idx], proof)).toBe(true);
    }
  });
});
