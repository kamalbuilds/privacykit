/**
 * Arcium Module Tests
 * Tests for MPC encryption and client functionality
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  X25519,
  ArciumEncryption,
  serializeLE,
  deserializeLE,
} from '../arcium/encryption';
import {
  ArciumClient,
  createDevnetClient,
} from '../arcium/client';
import {
  CSPLTokenClient,
  CSPL_PROGRAM_IDS,
  CSPL_TOKEN_CONFIGS,
} from '../arcium/cspl';
import type {
  X25519KeyPair,
} from '../arcium/types';
import { PublicKey } from '@solana/web3.js';

describe('X25519 Key Exchange', () => {
  describe('generateSecretKey', () => {
    it('should generate 32-byte secret key', () => {
      const secretKey = X25519.generateSecretKey();
      expect(secretKey).toBeInstanceOf(Uint8Array);
      expect(secretKey.length).toBe(32);
    });

    it('should generate clamped key', () => {
      const secretKey = X25519.generateSecretKey();
      // Check clamping bits
      expect(secretKey[0] & 0x07).toBe(0); // Lower 3 bits cleared
      expect(secretKey[31] & 0x80).toBe(0); // Highest bit cleared
      expect(secretKey[31] & 0x40).toBe(0x40); // Second highest bit set
    });

    it('should generate unique keys', () => {
      const keys = new Set<string>();
      for (let i = 0; i < 100; i++) {
        keys.add(Buffer.from(X25519.generateSecretKey()).toString('hex'));
      }
      expect(keys.size).toBe(100);
    });
  });

  describe('generateKeyPair', () => {
    it('should generate valid key pair', () => {
      const keyPair = X25519.generateKeyPair();

      expect(keyPair).toBeDefined();
      expect(keyPair.secretKey).toBeInstanceOf(Uint8Array);
      expect(keyPair.publicKey).toBeInstanceOf(Uint8Array);
      expect(keyPair.secretKey.length).toBe(32);
      expect(keyPair.publicKey.length).toBe(32);
    });

    it('should derive consistent public key', () => {
      const keyPair = X25519.generateKeyPair();
      const derivedPublic = X25519.getPublicKey(keyPair.secretKey);
      expect(Buffer.from(keyPair.publicKey)).toEqual(Buffer.from(derivedPublic));
    });
  });

  describe('getSharedSecret', () => {
    it('should compute matching shared secrets (ECDH)', () => {
      const alice = X25519.generateKeyPair();
      const bob = X25519.generateKeyPair();

      const aliceShared = X25519.getSharedSecret(alice.secretKey, bob.publicKey);
      const bobShared = X25519.getSharedSecret(bob.secretKey, alice.publicKey);

      expect(Buffer.from(aliceShared).toString('hex')).toBe(
        Buffer.from(bobShared).toString('hex')
      );
    });

    it('should compute 32-byte shared secret', () => {
      const alice = X25519.generateKeyPair();
      const bob = X25519.generateKeyPair();

      const shared = X25519.getSharedSecret(alice.secretKey, bob.publicKey);
      expect(shared.length).toBe(32);
    });

    it('should produce different secrets with different peers', () => {
      const alice = X25519.generateKeyPair();
      const bob = X25519.generateKeyPair();
      const charlie = X25519.generateKeyPair();

      const sharedAB = X25519.getSharedSecret(alice.secretKey, bob.publicKey);
      const sharedAC = X25519.getSharedSecret(alice.secretKey, charlie.publicKey);

      expect(Buffer.from(sharedAB).toString('hex')).not.toBe(
        Buffer.from(sharedAC).toString('hex')
      );
    });
  });
});

describe('Serialization', () => {
  describe('serializeLE', () => {
    it('should serialize bigint to little-endian bytes', () => {
      const value = BigInt(256);
      const bytes = serializeLE(value, 8);
      expect(bytes[0]).toBe(0);
      expect(bytes[1]).toBe(1);
      expect(bytes.length).toBe(8);
    });

    it('should serialize zero correctly', () => {
      const bytes = serializeLE(BigInt(0), 8);
      expect(bytes.every((b) => b === 0)).toBe(true);
    });

    it('should serialize large values', () => {
      const value = BigInt('0xfedcba9876543210');
      const bytes = serializeLE(value, 8);
      expect(bytes[0]).toBe(0x10);
      expect(bytes[7]).toBe(0xfe);
    });
  });

  describe('deserializeLE', () => {
    it('should deserialize little-endian bytes to bigint', () => {
      const bytes = new Uint8Array([0, 1, 0, 0, 0, 0, 0, 0]);
      const value = deserializeLE(bytes);
      expect(value).toBe(BigInt(256));
    });

    it('should round-trip correctly', () => {
      const original = BigInt('123456789012345678901234567890');
      const bytes = serializeLE(original, 32);
      const recovered = deserializeLE(bytes);
      expect(recovered).toBe(original);
    });
  });
});

describe('ArciumEncryption Class', () => {
  let encryption: ArciumEncryption;
  let mxeKeyPair: X25519KeyPair;

  beforeEach(async () => {
    mxeKeyPair = X25519.generateKeyPair();
    encryption = new ArciumEncryption();
    await encryption.setMxePublicKey(mxeKeyPair.publicKey);
  });

  it('should create encryption instance', () => {
    expect(encryption).toBeDefined();
    expect(encryption).toBeInstanceOf(ArciumEncryption);
  });

  it('should encrypt bigint values', () => {
    const value = BigInt(50000);
    const encrypted = encryption.encrypt(value);

    expect(encrypted).toBeDefined();
    expect(encrypted.ciphertext.length).toBeGreaterThan(0);
  });

  it('should produce different ciphertexts for same value', () => {
    const value = BigInt(1000);
    const enc1 = encryption.encrypt(value);
    const enc2 = encryption.encrypt(value);

    // Ciphertexts should differ due to random nonce/IV
    expect(Buffer.from(enc1.ciphertext).toString('hex')).not.toBe(
      Buffer.from(enc2.ciphertext).toString('hex')
    );
  });

  it('should encrypt for CSPL', () => {
    const value = BigInt(1000000);
    const encrypted = encryption.encryptForCSPL(value);

    expect(encrypted).toBeDefined();
    expect(encrypted.ciphertext.length).toBeGreaterThan(0);
    expect(encrypted.nonce.length).toBe(16);
  });
});

describe('C-SPL Token Constants', () => {
  it('should have confidential transfer adapter program ID', () => {
    expect(CSPL_PROGRAM_IDS.confidentialTransferAdapter).toBeDefined();
    expect(CSPL_PROGRAM_IDS.confidentialTransferAdapter).toBeInstanceOf(PublicKey);
  });

  it('should have encrypted SPL token program ID', () => {
    expect(CSPL_PROGRAM_IDS.encryptedSplToken).toBeDefined();
    expect(CSPL_PROGRAM_IDS.encryptedSplToken).toBeInstanceOf(PublicKey);
  });

  it('should have token configs', () => {
    expect(CSPL_TOKEN_CONFIGS).toBeDefined();
    // Should have at least SOL config
    const tokens = Object.keys(CSPL_TOKEN_CONFIGS);
    expect(tokens.length).toBeGreaterThan(0);
    expect(CSPL_TOKEN_CONFIGS.SOL).toBeDefined();
    expect(CSPL_TOKEN_CONFIGS.SOL.decimals).toBe(9);
  });

  it('should have all C-SPL program IDs', () => {
    expect(CSPL_PROGRAM_IDS.confidentialAuditorAdapter).toBeInstanceOf(PublicKey);
    expect(CSPL_PROGRAM_IDS.confidentialAta).toBeInstanceOf(PublicKey);
    expect(CSPL_PROGRAM_IDS.tokenWrap).toBeInstanceOf(PublicKey);
  });
});

describe('Arcium Module Exports', () => {
  it('should export encryption classes', async () => {
    const arcium = await import('../arcium');

    expect(arcium.X25519).toBeDefined();
    expect(arcium.ArciumEncryption).toBeDefined();
  });

  it('should export client classes', async () => {
    const arcium = await import('../arcium');

    expect(arcium.ArciumClient).toBeDefined();
    expect(arcium.createDevnetClient).toBeDefined();
  });

  it('should export CSPL classes', async () => {
    const arcium = await import('../arcium');

    expect(arcium.CSPLTokenClient).toBeDefined();
    expect(arcium.CSPL_PROGRAM_IDS).toBeDefined();
    expect(arcium.CSPL_TOKEN_CONFIGS).toBeDefined();
  });

  it('should export serialization helpers', async () => {
    const arcium = await import('../arcium');

    expect(arcium.serializeLE).toBeDefined();
    expect(arcium.deserializeLE).toBeDefined();
  });
});
