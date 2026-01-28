/**
 * Privacy Cash Integration Tests
 *
 * Tests for the production Privacy Cash implementation including:
 * - Poseidon hashing
 * - Merkle tree operations
 * - Commitment generation
 * - Proof generation (simulated)
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  initPoseidon,
  poseidonHash,
  poseidonHashSingle,
  bytesToField,
  fieldToHex,
  hexToField,
  randomFieldElement,
  SNARK_FIELD_SIZE,
} from '../poseidon';
import {
  createMerkleTree,
  verifyMerkleProof,
  DEFAULT_TREE_DEPTH,
} from '../merkle';
import {
  generateDepositNote,
  encodeNote,
  decodeNote,
  verifyNote,
  regenerateCommitment,
} from '../commitment';
import {
  initProver,
  generateWithdrawalProof,
  serializeProof,
  deserializeProof,
  getProverStatus,
} from '../prover';

describe('Poseidon Hash', () => {
  beforeAll(async () => {
    await initPoseidon();
  });

  it('should hash two values consistently', async () => {
    const a = BigInt(123);
    const b = BigInt(456);

    const hash1 = await poseidonHash(a, b);
    const hash2 = await poseidonHash(a, b);

    expect(hash1).toBe(hash2);
    expect(hash1 > BigInt(0)).toBe(true);
    expect(hash1 < SNARK_FIELD_SIZE).toBe(true);
  });

  it('should hash a single value', async () => {
    const a = BigInt(789);

    const hash = await poseidonHashSingle(a);

    expect(hash > BigInt(0)).toBe(true);
    expect(hash < SNARK_FIELD_SIZE).toBe(true);
  });

  it('should produce different hashes for different inputs', async () => {
    const hash1 = await poseidonHash(BigInt(1), BigInt(2));
    const hash2 = await poseidonHash(BigInt(1), BigInt(3));
    const hash3 = await poseidonHash(BigInt(2), BigInt(2));

    expect(hash1).not.toBe(hash2);
    expect(hash1).not.toBe(hash3);
    expect(hash2).not.toBe(hash3);
  });

  it('should convert between field and hex correctly', () => {
    const field = randomFieldElement();
    const hex = fieldToHex(field);
    const recovered = hexToField(hex);

    expect(recovered).toBe(field);
  });
});

describe('Merkle Tree', () => {
  it('should create tree with correct depth', async () => {
    const tree = await createMerkleTree(20);
    const stats = tree.getStats();

    expect(stats.depth).toBe(20);
    expect(stats.leaves).toBe(0);
    expect(stats.capacity).toBe(Math.pow(2, 20));
  });

  it('should insert leaves and update root', async () => {
    const tree = await createMerkleTree(10);
    const initialRoot = tree.getRoot();

    const leaf1 = randomFieldElement();
    await tree.insert(leaf1);

    const newRoot = tree.getRoot();
    expect(newRoot).not.toBe(initialRoot);
    expect(tree.getNextIndex()).toBe(1);
  });

  it('should generate and verify Merkle proofs', async () => {
    const tree = await createMerkleTree(10);

    // Insert multiple leaves
    const leaves: bigint[] = [];
    for (let i = 0; i < 5; i++) {
      const leaf = randomFieldElement();
      leaves.push(leaf);
      await tree.insert(leaf);
    }

    // Verify proof for each leaf
    for (let i = 0; i < leaves.length; i++) {
      const proof = await tree.generateProof(i);
      const isValid = await verifyMerkleProof(leaves[i], proof);
      expect(isValid).toBe(true);
    }
  });

  it('should maintain root history', async () => {
    const tree = await createMerkleTree(10);
    const roots: bigint[] = [];

    for (let i = 0; i < 5; i++) {
      await tree.insert(randomFieldElement());
      roots.push(tree.getRoot());
    }

    // All historical roots should be known
    for (const root of roots) {
      expect(tree.isKnownRoot(root)).toBe(true);
    }
  });
});

describe('Commitment Generation', () => {
  it('should generate valid deposit notes', async () => {
    const note = await generateDepositNote(1.5, 'SOL');

    expect(note.amount).toBe(1.5);
    expect(note.token).toBe('SOL');
    expect(note.commitment > BigInt(0)).toBe(true);
    expect(note.nullifierHash > BigInt(0)).toBe(true);
    expect(note.secret > BigInt(0)).toBe(true);
    expect(note.nullifier > BigInt(0)).toBe(true);
  });

  it('should verify notes correctly', async () => {
    const note = await generateDepositNote(2.0, 'USDC');
    const isValid = await verifyNote(note);
    expect(isValid).toBe(true);
  });

  it('should encode and decode notes consistently', async () => {
    const original = await generateDepositNote(5.0, 'SOL');
    const encoded = encodeNote(original);
    const decoded = decodeNote(encoded);

    expect(decoded.commitment).toBe(original.commitment);
    expect(decoded.nullifierHash).toBe(original.nullifierHash);
    expect(decoded.secret).toBe(original.secret);
    expect(decoded.nullifier).toBe(original.nullifier);
    expect(decoded.amount).toBe(original.amount);
    expect(decoded.token).toBe(original.token);
  });

  it('should regenerate commitment from secret and nullifier', async () => {
    const note = await generateDepositNote(1.0, 'SOL');
    const regenerated = await regenerateCommitment(note.secret, note.nullifier);

    expect(regenerated.commitment).toBe(note.commitment);
    expect(regenerated.nullifierHash).toBe(note.nullifierHash);
  });
});

describe('Proof Generation', () => {
  beforeAll(async () => {
    await initProver();
  });

  it('should report prover status', () => {
    const status = getProverStatus();
    expect(status.initialized).toBeDefined();
    expect(status.realProvingAvailable).toBeDefined();
    expect(status.artifactsLoaded).toBeDefined();
  });

  it('should generate simulated withdrawal proof', async () => {
    // Create a note
    const note = await generateDepositNote(1.0, 'SOL');

    // Create a Merkle tree and insert the commitment
    const tree = await createMerkleTree(20);
    note.leafIndex = await tree.insert(note.commitment);

    // Generate Merkle proof
    const merkleProof = await tree.generateProof(note.leafIndex);

    // Generate withdrawal proof
    const proof = await generateWithdrawalProof(
      note,
      merkleProof,
      'So11111111111111111111111111111111111111112', // Fake recipient
      undefined,
      0,
      0
    );

    expect(proof.proof).toBeDefined();
    expect(proof.proof.protocol).toBe('groth16');
    expect(proof.proof.curve).toBe('bn128');
    expect(proof.publicSignals).toBeDefined();
    expect(proof.publicSignals.nullifierHash).toBeDefined();
  });

  it('should serialize and deserialize proofs', async () => {
    const note = await generateDepositNote(1.0, 'SOL');
    const tree = await createMerkleTree(20);
    note.leafIndex = await tree.insert(note.commitment);
    const merkleProof = await tree.generateProof(note.leafIndex);

    const originalProof = await generateWithdrawalProof(
      note,
      merkleProof,
      'So11111111111111111111111111111111111111112',
      undefined,
      0,
      0
    );

    const serialized = serializeProof(originalProof);
    expect(serialized).toBeInstanceOf(Uint8Array);
    expect(serialized.length).toBeGreaterThan(0);

    const deserialized = deserializeProof(serialized);
    expect(deserialized.proof.protocol).toBe('groth16');
    expect(deserialized.publicSignals.nullifierHash).toBeDefined();
  });
});

describe('End-to-End Flow', () => {
  it('should complete full deposit-withdraw cycle', async () => {
    // 1. Initialize
    await initPoseidon();
    await initProver();

    // 2. Create Merkle tree (simulating on-chain state)
    const tree = await createMerkleTree(DEFAULT_TREE_DEPTH);

    // 3. Generate deposit note
    const note = await generateDepositNote(10.0, 'SOL');

    // 4. Encode note for storage
    const encodedNote = encodeNote(note);
    expect(encodedNote.startsWith('privacy-cash-note-v')).toBe(true);

    // 5. Insert commitment into tree (simulating on-chain deposit)
    note.leafIndex = await tree.insert(note.commitment);

    // 6. Later: Decode note for withdrawal
    const recoveredNote = decodeNote(encodedNote);
    recoveredNote.leafIndex = note.leafIndex;

    // 7. Verify note integrity
    const isValid = await verifyNote(recoveredNote);
    expect(isValid).toBe(true);

    // 8. Generate Merkle proof
    const merkleProof = await tree.generateProof(recoveredNote.leafIndex!);

    // 9. Verify Merkle proof
    const merkleValid = await verifyMerkleProof(
      recoveredNote.commitment,
      merkleProof
    );
    expect(merkleValid).toBe(true);

    // 10. Generate withdrawal proof
    const withdrawalProof = await generateWithdrawalProof(
      recoveredNote,
      merkleProof,
      'RecipientAddress11111111111111111111111111',
      undefined,
      0.05, // 0.05 SOL fee
      0
    );

    // 11. Verify proof structure
    expect(withdrawalProof.proof.pi_a).toHaveLength(3);
    expect(withdrawalProof.proof.pi_b).toHaveLength(3);
    expect(withdrawalProof.proof.pi_c).toHaveLength(3);
    expect(withdrawalProof.publicSignals.root).toBeDefined();
    expect(withdrawalProof.publicSignals.nullifierHash).toBe(
      recoveredNote.nullifierHash.toString()
    );

    // 12. Serialize for on-chain submission
    const serializedProof = serializeProof(withdrawalProof);
    expect(serializedProof.length).toBeGreaterThan(100); // Should have substantial data
  });
});
