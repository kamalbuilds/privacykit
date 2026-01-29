/**
 * Poseidon Hash Tests
 * Tests for real Poseidon hash implementation with BN254 curve
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  poseidonHash,
  poseidonHashSingle,
  poseidonHashMany,
  SNARK_FIELD_SIZE,
  isValidFieldElement,
  randomFieldElement,
  bytesToField,
  fieldToBytes,
  fieldToHex,
  hexToField,
  initPoseidon,
} from '../privacycash/poseidon';

describe('Poseidon Constants', () => {
  it('should have correct BN254 field size', () => {
    expect(SNARK_FIELD_SIZE).toBe(
      BigInt('21888242871839275222246405745257275088548364400416034343698204186575808495617')
    );
  });

  it('should validate field elements correctly', () => {
    expect(isValidFieldElement(BigInt(0))).toBe(true);
    expect(isValidFieldElement(BigInt(1))).toBe(true);
    expect(isValidFieldElement(SNARK_FIELD_SIZE - BigInt(1))).toBe(true);
    expect(isValidFieldElement(SNARK_FIELD_SIZE)).toBe(false);
    expect(isValidFieldElement(SNARK_FIELD_SIZE + BigInt(1))).toBe(false);
  });
});

describe('Random Field Element Generation', () => {
  it('should generate random field element', () => {
    const element = randomFieldElement();
    expect(typeof element).toBe('bigint');
    expect(isValidFieldElement(element)).toBe(true);
  });

  it('should generate different values each time', () => {
    const elements = new Set<string>();
    for (let i = 0; i < 100; i++) {
      elements.add(randomFieldElement().toString());
    }
    // All should be unique
    expect(elements.size).toBe(100);
  });
});

describe('Field Conversion Functions', () => {
  it('should convert bytes to field element', () => {
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const field = bytesToField(bytes);
    expect(typeof field).toBe('bigint');
    expect(isValidFieldElement(field)).toBe(true);
  });

  it('should convert field to bytes and back', () => {
    const original = BigInt(12345678901234567890n);
    const bytes = fieldToBytes(original);
    const recovered = bytesToField(bytes);
    expect(recovered).toBe(original);
  });

  it('should convert field to hex and back', () => {
    const original = BigInt('0x1234567890abcdef');
    const hex = fieldToHex(original);
    const recovered = hexToField(hex);
    expect(recovered).toBe(original);
  });

  it('should handle zero value', () => {
    const hex = fieldToHex(BigInt(0));
    expect(hexToField(hex)).toBe(BigInt(0));
  });
});

describe('Poseidon Hash Functions', () => {
  describe('poseidonHash (2 inputs)', () => {
    it('should hash two elements', async () => {
      const hash = await poseidonHash(BigInt(1), BigInt(2));
      expect(typeof hash).toBe('bigint');
      expect(isValidFieldElement(hash)).toBe(true);
    });

    it('should produce deterministic results', async () => {
      const a = BigInt(12345);
      const b = BigInt(67890);
      const hash1 = await poseidonHash(a, b);
      const hash2 = await poseidonHash(a, b);
      expect(hash1).toBe(hash2);
    });

    it('should produce different hashes for different inputs', async () => {
      const hash1 = await poseidonHash(BigInt(1), BigInt(2));
      const hash2 = await poseidonHash(BigInt(2), BigInt(3));
      expect(hash1).not.toBe(hash2);
    });

    it('should be order-sensitive', async () => {
      const hash1 = await poseidonHash(BigInt(1), BigInt(2));
      const hash2 = await poseidonHash(BigInt(2), BigInt(1));
      expect(hash1).not.toBe(hash2);
    });
  });

  describe('poseidonHashSingle', () => {
    it('should hash a single element', async () => {
      const hash = await poseidonHashSingle(BigInt(12345));
      expect(typeof hash).toBe('bigint');
      expect(isValidFieldElement(hash)).toBe(true);
    });

    it('should produce deterministic results', async () => {
      const input = BigInt(99999);
      const hash1 = await poseidonHashSingle(input);
      const hash2 = await poseidonHashSingle(input);
      expect(hash1).toBe(hash2);
    });
  });

  describe('poseidonHashMany', () => {
    it('should hash multiple elements', async () => {
      const hash = await poseidonHashMany([BigInt(1), BigInt(2), BigInt(3)]);
      expect(typeof hash).toBe('bigint');
      expect(isValidFieldElement(hash)).toBe(true);
    });

    it('should handle 2 elements', async () => {
      const hash1 = await poseidonHashMany([BigInt(1), BigInt(2)]);
      const hash2 = await poseidonHash(BigInt(1), BigInt(2));
      expect(hash1).toBe(hash2);
    });

    it('should throw for empty input', async () => {
      await expect(poseidonHashMany([])).rejects.toThrow();
    });
  });
});

describe('Poseidon Cryptographic Properties', () => {
  it('should be collision resistant (basic test)', async () => {
    const hashes = new Set<string>();
    const numTests = 100;

    for (let i = 0; i < numTests; i++) {
      const hash = await poseidonHashSingle(BigInt(i));
      const hashStr = hash.toString();
      expect(hashes.has(hashStr)).toBe(false);
      hashes.add(hashStr);
    }

    expect(hashes.size).toBe(numTests);
  });

  it('should produce uniform distribution (basic test)', async () => {
    const hashes: bigint[] = [];
    const numTests = 50;

    for (let i = 0; i < numTests; i++) {
      hashes.push(await poseidonHashSingle(BigInt(i * 12345)));
    }

    // Check that hashes are spread across the field
    const threshold = SNARK_FIELD_SIZE / BigInt(2);
    const belowThreshold = hashes.filter((h) => h < threshold).length;
    const aboveThreshold = hashes.filter((h) => h >= threshold).length;

    // Should have some distribution on both sides
    expect(belowThreshold).toBeGreaterThan(5);
    expect(aboveThreshold).toBeGreaterThan(5);
  });

  it('should handle edge cases', async () => {
    // Zero
    const hash0 = await poseidonHashSingle(BigInt(0));
    expect(isValidFieldElement(hash0)).toBe(true);

    // One
    const hash1 = await poseidonHashSingle(BigInt(1));
    expect(isValidFieldElement(hash1)).toBe(true);

    // Large value (near field boundary)
    const hashLarge = await poseidonHashSingle(SNARK_FIELD_SIZE - BigInt(1));
    expect(isValidFieldElement(hashLarge)).toBe(true);
  });
});

describe('initPoseidon', () => {
  it('should initialize poseidon function', async () => {
    const poseidon = await initPoseidon();
    expect(typeof poseidon).toBe('function');
  });

  it('should return cached instance on subsequent calls', async () => {
    const poseidon1 = await initPoseidon();
    const poseidon2 = await initPoseidon();
    expect(poseidon1).toBe(poseidon2);
  });
});
