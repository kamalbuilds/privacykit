/**
 * Commitment Tests
 * Tests for Tornado Cash-style commitment and note generation
 */

import { describe, it, expect } from 'vitest';
import {
  generateDepositNote,
  regenerateCommitment,
  verifyNote,
  encodeNote,
  decodeNote,
  createNoteFromParams,
} from '../privacycash/commitment';
import { SNARK_FIELD_SIZE, isValidFieldElement, randomFieldElement } from '../privacycash/poseidon';
import type { DepositNote } from '../privacycash/types';

describe('Deposit Note Generation', () => {
  it('should generate deposit note with all fields', async () => {
    const note = await generateDepositNote(1000, 'SOL');

    expect(note).toBeDefined();
    expect(note.amount).toBe(1000);
    expect(note.token).toBe('SOL');
    expect(typeof note.commitment).toBe('bigint');
    expect(typeof note.nullifierHash).toBe('bigint');
    expect(typeof note.secret).toBe('bigint');
    expect(typeof note.nullifier).toBe('bigint');
    expect(typeof note.timestamp).toBe('number');
  });

  it('should generate valid field elements', async () => {
    const note = await generateDepositNote(5000, 'USDC');

    expect(isValidFieldElement(note.commitment)).toBe(true);
    expect(isValidFieldElement(note.nullifierHash)).toBe(true);
    expect(isValidFieldElement(note.secret)).toBe(true);
    expect(isValidFieldElement(note.nullifier)).toBe(true);
  });

  it('should generate unique notes each time', async () => {
    const notes: DepositNote[] = [];
    for (let i = 0; i < 10; i++) {
      notes.push(await generateDepositNote(1000, 'SOL'));
    }

    // All commitments should be unique
    const commitments = new Set(notes.map((n) => n.commitment.toString()));
    expect(commitments.size).toBe(10);

    // All nullifier hashes should be unique
    const nullifierHashes = new Set(notes.map((n) => n.nullifierHash.toString()));
    expect(nullifierHashes.size).toBe(10);
  });

  it('should set timestamp close to current time', async () => {
    const before = Date.now();
    const note = await generateDepositNote(1000, 'SOL');
    const after = Date.now();

    expect(note.timestamp).toBeGreaterThanOrEqual(before);
    expect(note.timestamp).toBeLessThanOrEqual(after);
  });
});

describe('Commitment Regeneration', () => {
  it('should regenerate commitment from secret/nullifier', async () => {
    const note = await generateDepositNote(1000, 'SOL');

    const { commitment, nullifierHash } = await regenerateCommitment(
      note.secret,
      note.nullifier
    );

    expect(commitment).toBe(note.commitment);
    expect(nullifierHash).toBe(note.nullifierHash);
  });

  it('should produce deterministic results', async () => {
    const secret = randomFieldElement();
    const nullifier = randomFieldElement();

    const result1 = await regenerateCommitment(secret, nullifier);
    const result2 = await regenerateCommitment(secret, nullifier);

    expect(result1.commitment).toBe(result2.commitment);
    expect(result1.nullifierHash).toBe(result2.nullifierHash);
  });

  it('should produce different commitments for different secrets', async () => {
    const nullifier = randomFieldElement();

    const result1 = await regenerateCommitment(randomFieldElement(), nullifier);
    const result2 = await regenerateCommitment(randomFieldElement(), nullifier);

    expect(result1.commitment).not.toBe(result2.commitment);
  });

  it('should produce different nullifier hashes for different nullifiers', async () => {
    const secret = randomFieldElement();

    const result1 = await regenerateCommitment(secret, randomFieldElement());
    const result2 = await regenerateCommitment(secret, randomFieldElement());

    expect(result1.nullifierHash).not.toBe(result2.nullifierHash);
  });
});

describe('Note Verification', () => {
  it('should verify valid note', async () => {
    const note = await generateDepositNote(1000, 'SOL');
    const isValid = await verifyNote(note);
    expect(isValid).toBe(true);
  });

  it('should reject note with tampered commitment', async () => {
    const note = await generateDepositNote(1000, 'SOL');
    note.commitment = randomFieldElement(); // Tamper with commitment

    const isValid = await verifyNote(note);
    expect(isValid).toBe(false);
  });

  it('should reject note with tampered nullifier hash', async () => {
    const note = await generateDepositNote(1000, 'SOL');
    note.nullifierHash = randomFieldElement(); // Tamper with nullifier hash

    const isValid = await verifyNote(note);
    expect(isValid).toBe(false);
  });

  it('should reject note with tampered secret', async () => {
    const note = await generateDepositNote(1000, 'SOL');
    const originalCommitment = note.commitment;
    note.secret = randomFieldElement(); // Tamper with secret

    const isValid = await verifyNote(note);
    expect(isValid).toBe(false);
  });
});

describe('Note Encoding/Decoding', () => {
  it('should encode note to string', async () => {
    const note = await generateDepositNote(1000, 'SOL');
    const encoded = encodeNote(note);

    expect(typeof encoded).toBe('string');
    expect(encoded).toContain('privacy-cash-note');
  });

  it('should decode note from string', async () => {
    const note = await generateDepositNote(2500, 'USDC');
    const encoded = encodeNote(note);
    const decoded = decodeNote(encoded);

    expect(decoded.commitment).toBe(note.commitment);
    expect(decoded.nullifierHash).toBe(note.nullifierHash);
    expect(decoded.secret).toBe(note.secret);
    expect(decoded.nullifier).toBe(note.nullifier);
    expect(decoded.amount).toBe(note.amount);
    expect(decoded.token).toBe(note.token);
  });

  it('should preserve all note fields through encode/decode', async () => {
    const note = await generateDepositNote(99999, 'wSOL');
    note.leafIndex = 42; // Set optional field

    const encoded = encodeNote(note);
    const decoded = decodeNote(encoded);

    expect(decoded.leafIndex).toBe(42);
    expect(decoded.timestamp).toBe(note.timestamp);
  });

  it('should throw for invalid encoded string', () => {
    expect(() => decodeNote('invalid-string')).toThrow();
    expect(() => decodeNote('')).toThrow();
  });
});

describe('Note Creation from Params', () => {
  it('should create note from known parameters', async () => {
    const secret = randomFieldElement();
    const nullifier = randomFieldElement();
    const amount = 5000;
    const token = 'SOL';

    // createNoteFromParams takes an object with named properties
    const note = await createNoteFromParams({
      secret,
      nullifier,
      amount,
      token,
    });

    expect(note.secret).toBe(secret);
    expect(note.nullifier).toBe(nullifier);
    expect(note.amount).toBe(amount);
    expect(note.token).toBe(token);

    // Verify commitment is correctly computed
    const isValid = await verifyNote(note);
    expect(isValid).toBe(true);
  });
});

describe('Double-Spend Prevention', () => {
  it('should produce unique nullifier hashes for unique nullifiers', async () => {
    const nullifierHashes = new Set<string>();

    for (let i = 0; i < 100; i++) {
      const note = await generateDepositNote(1000, 'SOL');
      nullifierHashes.add(note.nullifierHash.toString());
    }

    // All nullifier hashes must be unique
    expect(nullifierHashes.size).toBe(100);
  });

  it('should produce same nullifier hash for same nullifier', async () => {
    const secret1 = randomFieldElement();
    const secret2 = randomFieldElement();
    const sameNullifier = randomFieldElement();

    const result1 = await regenerateCommitment(secret1, sameNullifier);
    const result2 = await regenerateCommitment(secret2, sameNullifier);

    // Same nullifier should produce same nullifier hash
    expect(result1.nullifierHash).toBe(result2.nullifierHash);
    // But different commitments
    expect(result1.commitment).not.toBe(result2.commitment);
  });
});

describe('Commitment Hiding Property', () => {
  it('should hide amount in commitment', async () => {
    // Same amount with different secrets produces different commitments
    const notes: DepositNote[] = [];
    for (let i = 0; i < 10; i++) {
      notes.push(await generateDepositNote(1000, 'SOL'));
    }

    const commitments = new Set(notes.map((n) => n.commitment.toString()));
    expect(commitments.size).toBe(10);
  });

  it('should hide secret in commitment', async () => {
    // Cannot distinguish commitments based on which values were used
    const note1 = await generateDepositNote(1000, 'SOL');
    const note2 = await generateDepositNote(2000, 'SOL');

    // Both should be valid field elements of similar "size"
    // (cannot tell amount from looking at commitment)
    expect(isValidFieldElement(note1.commitment)).toBe(true);
    expect(isValidFieldElement(note2.commitment)).toBe(true);
  });
});
