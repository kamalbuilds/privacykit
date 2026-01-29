/**
 * ShadowWire/ShadowPay API Tests
 * Tests for API client and authentication
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ShadowPayApiClient,
  ShadowPayApiErrorClass,
  createShadowPayClient,
  DEFAULT_CIRCUIT_URLS,
  SHADOWPAY_PROGRAM_ID,
  SHADOWPAY_TOKENS,
} from '../shadowwire/api';
import {
  SHADOWPAY_API_URL,
  API_VERSION,
  createAuthHeaders,
} from '../shadowwire/auth';
import {
  type PrivateTransferRequest,
  type DepositRequest,
  type WithdrawalRequest,
  ShadowPayErrorCode,
} from '../shadowwire/types';

describe('ShadowPay Constants', () => {
  it('should have correct API URL', () => {
    expect(SHADOWPAY_API_URL).toBe('https://shadow.radr.fun');
  });

  it('should have valid API version', () => {
    expect(API_VERSION).toBe('shadowpay/v1');
  });

  it('should have valid program ID', () => {
    expect(SHADOWPAY_PROGRAM_ID).toBeDefined();
    expect(typeof SHADOWPAY_PROGRAM_ID).toBe('string');
    expect(SHADOWPAY_PROGRAM_ID).toBe('GQBqwwoikYh7p6KEUHDUu5r9dHHXx9tMGskAPubmFPzD');
  });

  it('should have supported tokens defined', () => {
    expect(SHADOWPAY_TOKENS).toBeDefined();
    expect(SHADOWPAY_TOKENS.SOL).toBeDefined();
    expect(SHADOWPAY_TOKENS.SOL.decimals).toBe(9);
    expect(SHADOWPAY_TOKENS.USDC).toBeDefined();
    expect(SHADOWPAY_TOKENS.USDC.decimals).toBe(6);
  });

  it('should have circuit URLs defined', () => {
    expect(DEFAULT_CIRCUIT_URLS).toBeDefined();
    expect(DEFAULT_CIRCUIT_URLS.wasm).toContain('circuit.wasm');
    expect(DEFAULT_CIRCUIT_URLS.zkey).toContain('circuit_final.zkey');
    expect(DEFAULT_CIRCUIT_URLS.vkey).toContain('verification_key.json');
  });
});

describe('ShadowPay API Client', () => {
  let client: ShadowPayApiClient;

  beforeEach(() => {
    client = new ShadowPayApiClient();
  });

  describe('constructor', () => {
    it('should create client with default config', () => {
      expect(client).toBeDefined();
      expect(client).toBeInstanceOf(ShadowPayApiClient);
    });

    it('should create client with custom config', () => {
      const customClient = new ShadowPayApiClient({
        baseUrl: 'https://custom.api.com',
        timeout: 60000,
      });
      expect(customClient).toBeDefined();
    });

    it('should create client with API key', () => {
      const authClient = new ShadowPayApiClient({
        apiKey: 'test-api-key',
      });
      expect(authClient).toBeDefined();
    });
  });

  describe('createShadowPayClient factory', () => {
    it('should create client instance', () => {
      const factoryClient = createShadowPayClient();
      expect(factoryClient).toBeInstanceOf(ShadowPayApiClient);
    });

    it('should create client with options', () => {
      const factoryClient = createShadowPayClient({
        apiKey: 'test-key',
        timeout: 60000,
      });
      expect(factoryClient).toBeDefined();
    });
  });

  describe('API methods structure', () => {
    it('should have transfer method', () => {
      expect(typeof client.transfer).toBe('function');
    });

    it('should have deposit method', () => {
      expect(typeof client.deposit).toBe('function');
    });

    it('should have withdraw method', () => {
      expect(typeof client.withdraw).toBe('function');
    });

    it('should have getBalance method', () => {
      expect(typeof client.getBalance).toBe('function');
    });

    it('should have verifyPayment method', () => {
      expect(typeof client.verifyPayment).toBe('function');
    });
  });
});

describe('ShadowPay API Error', () => {
  it('should create error with status code', () => {
    // Constructor: (message, code, status, details?)
    const error = new ShadowPayApiErrorClass('Bad request', ShadowPayErrorCode.INVALID_AMOUNT, 400);
    expect(error.status).toBe(400);
    expect(error.message).toBe('Bad request');
  });

  it('should create error with code', () => {
    const error = new ShadowPayApiErrorClass('Bad request', ShadowPayErrorCode.INVALID_AMOUNT, 400);
    expect(error.code).toBe(ShadowPayErrorCode.INVALID_AMOUNT);
  });

  it('should have name set correctly', () => {
    const error = new ShadowPayApiErrorClass('Server error', ShadowPayErrorCode.INTERNAL_ERROR, 500);
    expect(error.name).toBe('ShadowPayApiError');
  });

  it('should be instanceof Error', () => {
    const error = new ShadowPayApiErrorClass('Not found', ShadowPayErrorCode.UNKNOWN_ERROR, 404);
    expect(error).toBeInstanceOf(Error);
  });
});

describe('ShadowPay Authentication', () => {
  describe('createAuthHeaders', () => {
    it('should create headers with content-type', () => {
      const headers = createAuthHeaders({});
      expect(headers['Content-Type']).toBe('application/json');
    });

    it('should include API key when provided', () => {
      const headers = createAuthHeaders({ apiKey: 'my-api-key' });
      expect(headers['X-API-Key']).toBe('my-api-key');
    });

    it('should include access token when provided', () => {
      const headers = createAuthHeaders({ accessToken: 'my-access-token' });
      expect(headers['X-Access-Token']).toBe('my-access-token');
    });

    it('should include both API key and access token', () => {
      const headers = createAuthHeaders({
        apiKey: 'key',
        accessToken: 'token',
      });
      expect(headers['X-API-Key']).toBe('key');
      expect(headers['X-Access-Token']).toBe('token');
    });
  });
});

describe('ShadowPay Token Configuration', () => {
  it('should have SOL configuration', () => {
    const sol = SHADOWPAY_TOKENS.SOL;
    expect(sol.symbol).toBe('SOL');
    expect(sol.decimals).toBe(9);
    expect(sol.fee).toBeGreaterThan(0);
    expect(sol.minAmount).toBeGreaterThan(0);
  });

  it('should have USDC configuration with mint address', () => {
    const usdc = SHADOWPAY_TOKENS.USDC;
    expect(usdc.symbol).toBe('USDC');
    expect(usdc.decimals).toBe(6);
    expect(usdc.mint).toBeDefined();
    expect(usdc.mint).toBe('EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v');
  });

  it('should have USDT configuration', () => {
    const usdt = SHADOWPAY_TOKENS.USDT;
    expect(usdt.symbol).toBe('USDT');
    expect(usdt.decimals).toBe(6);
    expect(usdt.mint).toBe('Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB');
  });
});

describe('ShadowWire Module Exports', () => {
  it('should export all public APIs from index', async () => {
    const shadowwire = await import('../shadowwire');

    // API Client
    expect(shadowwire.ShadowPayApiClient).toBeDefined();
    expect(shadowwire.createShadowPayClient).toBeDefined();
    expect(shadowwire.ShadowPayApiErrorClass).toBeDefined();

    // Constants
    expect(shadowwire.SHADOWPAY_API_URL).toBeDefined();
    expect(shadowwire.SHADOWPAY_PROGRAM_ID).toBeDefined();
    expect(shadowwire.DEFAULT_CIRCUIT_URLS).toBeDefined();
    expect(shadowwire.SHADOWPAY_TOKENS).toBeDefined();

    // Auth
    expect(shadowwire.createAuthHeaders).toBeDefined();
    expect(shadowwire.API_VERSION).toBeDefined();
  });
});

describe('Type Definitions', () => {
  it('should define valid PrivateTransferRequest', () => {
    const request: PrivateTransferRequest = {
      proof: new Uint8Array([1, 2, 3]),
      publicSignals: ['0x1', '0x2'],
      recipientCommitment: '0xabc',
      fee: 1000n,
    };

    expect(request.proof).toBeDefined();
    expect(request.publicSignals.length).toBe(2);
    expect(request.recipientCommitment).toBeDefined();
  });

  it('should define valid DepositRequest', () => {
    const request: DepositRequest = {
      commitment: '0x123',
      amount: 1000000n,
      token: 'SOL',
    };

    expect(request.commitment).toBeDefined();
    expect(request.amount).toBe(1000000n);
    expect(request.token).toBe('SOL');
  });

  it('should define valid WithdrawalRequest', () => {
    const request: WithdrawalRequest = {
      proof: new Uint8Array([1, 2, 3]),
      publicSignals: ['0x1', '0x2', '0x3'],
      nullifierHash: '0xdef',
      recipient: 'SomePublicKeyBase58',
      relayer: 'RelayerPublicKey',
      fee: 500n,
    };

    expect(request.proof).toBeDefined();
    expect(request.nullifierHash).toBeDefined();
    expect(request.recipient).toBeDefined();
  });
});
