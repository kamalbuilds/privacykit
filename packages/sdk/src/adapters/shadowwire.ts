import type {
  TransferRequest,
  TransferResult,
  DepositRequest,
  DepositResult,
  WithdrawRequest,
  WithdrawResult,
  EstimateRequest,
  EstimateResult,
  WalletAdapter,
} from '../types';
import { PrivacyProvider, PrivacyLevel } from '../types';
import { BaseAdapter } from './base';
import {
  InsufficientBalanceError,
  RecipientNotFoundError,
  TransactionError,
  AmountBelowMinimumError,
  NetworkError,
  wrapError,
} from '../utils/errors';
import { toPublicKey, retry } from '../utils';
import { getProviderFee, getMinimumAmount, toSmallestUnit, fromSmallestUnit } from '../types/tokens';

/**
 * ShadowWire API response types
 */
interface ShadowWireBalanceResponse {
  balance: number;
  token: string;
}

interface ShadowWireTransferResponse {
  success: boolean;
  transactionId: string;
  fee: number;
  error?: string;
}

interface ShadowWireDepositResponse {
  success: boolean;
  transactionId: string;
  commitment?: string;
  error?: string;
}

interface ShadowWireWithdrawResponse {
  success: boolean;
  transactionId: string;
  error?: string;
}

/**
 * ShadowWire token configuration
 */
const SHADOWWIRE_TOKENS: Record<string, { decimals: number; fee: number; minAmount: number }> = {
  SOL: { decimals: 9, fee: 0.005, minAmount: 0.01 },
  RADR: { decimals: 9, fee: 0.003, minAmount: 0.1 },
  USDC: { decimals: 6, fee: 0.01, minAmount: 1 },
  ORE: { decimals: 11, fee: 0.003, minAmount: 0.001 },
  BONK: { decimals: 5, fee: 0.01, minAmount: 100000 },
  JIM: { decimals: 9, fee: 0.01, minAmount: 1 },
  GODL: { decimals: 11, fee: 0.01, minAmount: 0.001 },
  HUSTLE: { decimals: 9, fee: 0.003, minAmount: 0.1 },
  ZEC: { decimals: 9, fee: 0.01, minAmount: 0.01 },
  CRT: { decimals: 9, fee: 0.01, minAmount: 1 },
  BLACKCOIN: { decimals: 6, fee: 0.01, minAmount: 1 },
  GIL: { decimals: 6, fee: 0.01, minAmount: 1 },
  ANON: { decimals: 9, fee: 0.01, minAmount: 1 },
  WLFI: { decimals: 6, fee: 0.01, minAmount: 1 },
  USD1: { decimals: 6, fee: 0.01, minAmount: 1 },
  AOL: { decimals: 6, fee: 0.01, minAmount: 1 },
  IQLABS: { decimals: 9, fee: 0.005, minAmount: 0.1 },
  SANA: { decimals: 6, fee: 0.01, minAmount: 1 },
  POKI: { decimals: 9, fee: 0.01, minAmount: 1 },
  RAIN: { decimals: 6, fee: 0.02, minAmount: 1 },
  HOSICO: { decimals: 9, fee: 0.01, minAmount: 1 },
  SKR: { decimals: 6, fee: 0.005, minAmount: 1 },
};

/**
 * ShadowWire Adapter
 *
 * Real production integration with ShadowWire API for private transfers
 * using Bulletproof zero-knowledge proofs.
 *
 * Features:
 * - Internal transfers: Amount hidden using ZK proofs
 * - External transfers: Sender anonymous, amount visible
 * - Supports 22+ tokens
 * - Client-side proof generation option
 */
export class ShadowWireAdapter extends BaseAdapter {
  readonly provider = PrivacyProvider.SHADOWWIRE;
  readonly name = 'ShadowWire';
  readonly supportedLevels: PrivacyLevel[] = [
    PrivacyLevel.AMOUNT_HIDDEN,
    PrivacyLevel.SENDER_HIDDEN,
  ];
  readonly supportedTokens = Object.keys(SHADOWWIRE_TOKENS);

  private apiBaseUrl = 'https://api.radr.fun';
  private wasmInitialized = false;

  /**
   * Initialize ShadowWire adapter
   */
  protected async onInitialize(): Promise<void> {
    // Verify API is reachable
    try {
      const response = await fetch(`${this.apiBaseUrl}/health`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        this.logger.warn('ShadowWire API health check failed, will retry on operations');
      }
    } catch (error) {
      this.logger.warn('Could not reach ShadowWire API during init, will retry on operations');
    }
  }

  /**
   * Configure API base URL (useful for testing)
   */
  setApiUrl(url: string): void {
    this.apiBaseUrl = url;
  }

  /**
   * Get balance for a token in the ShadowWire privacy pool
   */
  async getBalance(token: string, address?: string): Promise<number> {
    this.ensureReady();

    const walletAddress = address || this.wallet?.publicKey.toBase58();
    if (!walletAddress) {
      throw new Error('No wallet address provided');
    }

    const normalizedToken = token.toUpperCase();
    if (!SHADOWWIRE_TOKENS[normalizedToken]) {
      throw new Error(`Token ${token} not supported by ShadowWire`);
    }

    try {
      const response = await retry(
        async () => {
          const res = await fetch(
            `${this.apiBaseUrl}/v1/balance/${walletAddress}?token=${normalizedToken}`,
            {
              method: 'GET',
              headers: { 'Content-Type': 'application/json' },
            }
          );

          if (!res.ok) {
            const error = await res.text();
            throw new NetworkError(`Failed to get balance: ${error}`);
          }

          return res.json() as Promise<ShadowWireBalanceResponse>;
        },
        { maxRetries: 3 }
      );

      return response.balance;
    } catch (error) {
      throw wrapError(error, 'Failed to get ShadowWire balance');
    }
  }

  /**
   * Execute a private transfer via ShadowWire
   */
  async transfer(request: TransferRequest): Promise<TransferResult> {
    this.ensureReady();
    const wallet = this.ensureWallet();

    const token = request.token.toUpperCase();
    const tokenConfig = SHADOWWIRE_TOKENS[token];

    if (!tokenConfig) {
      throw new Error(`Token ${request.token} not supported by ShadowWire`);
    }

    // Validate minimum amount
    if (request.amount < tokenConfig.minAmount) {
      throw new AmountBelowMinimumError(
        request.amount,
        tokenConfig.minAmount,
        token,
        this.provider
      );
    }

    // Determine transfer type based on privacy level
    const transferType =
      request.privacy === PrivacyLevel.AMOUNT_HIDDEN ? 'internal' : 'external';

    const recipient =
      typeof request.recipient === 'string'
        ? request.recipient
        : request.recipient.toBase58();

    this.logger.info(`Initiating ${transferType} transfer of ${request.amount} ${token}`);

    try {
      // Create the transfer request message for signing
      const timestamp = Date.now();
      const message = new TextEncoder().encode(
        JSON.stringify({
          action: 'transfer',
          sender: wallet.publicKey.toBase58(),
          recipient,
          amount: request.amount,
          token,
          type: transferType,
          timestamp,
        })
      );

      // Sign the message with wallet
      const signature = await wallet.signMessage(message);

      // Execute the transfer via API
      const response = await retry(
        async () => {
          const res = await fetch(`${this.apiBaseUrl}/v1/transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              sender: wallet.publicKey.toBase58(),
              recipient,
              amount: request.amount,
              token,
              type: transferType,
              timestamp,
              signature: Buffer.from(signature).toString('base64'),
              ...(request.options?.customProof && {
                customProof: Buffer.from(request.options.customProof).toString('base64'),
              }),
            }),
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
            if (errorData.error?.includes('not found')) {
              throw new RecipientNotFoundError(recipient);
            }
            if (errorData.error?.includes('insufficient')) {
              throw new InsufficientBalanceError(request.amount, 0, token);
            }
            throw new TransactionError(errorData.error || 'Transfer failed');
          }

          return res.json() as Promise<ShadowWireTransferResponse>;
        },
        { maxRetries: 2 }
      );

      if (!response.success) {
        throw new TransactionError(response.error || 'Transfer failed');
      }

      this.logger.info(`Transfer complete: ${response.transactionId}`);

      return {
        signature: response.transactionId,
        provider: this.provider,
        privacyLevel: request.privacy,
        fee: response.fee || request.amount * tokenConfig.fee,
      };
    } catch (error) {
      if (error instanceof InsufficientBalanceError ||
          error instanceof RecipientNotFoundError ||
          error instanceof TransactionError) {
        throw error;
      }
      throw wrapError(error, 'ShadowWire transfer failed');
    }
  }

  /**
   * Deposit tokens into ShadowWire privacy pool
   */
  async deposit(request: DepositRequest): Promise<DepositResult> {
    this.ensureReady();
    const wallet = this.ensureWallet();

    const token = request.token.toUpperCase();
    const tokenConfig = SHADOWWIRE_TOKENS[token];

    if (!tokenConfig) {
      throw new Error(`Token ${request.token} not supported by ShadowWire`);
    }

    if (request.amount < tokenConfig.minAmount) {
      throw new AmountBelowMinimumError(
        request.amount,
        tokenConfig.minAmount,
        token,
        this.provider
      );
    }

    this.logger.info(`Depositing ${request.amount} ${token} into ShadowWire`);

    try {
      const timestamp = Date.now();
      const message = new TextEncoder().encode(
        JSON.stringify({
          action: 'deposit',
          wallet: wallet.publicKey.toBase58(),
          amount: request.amount,
          token,
          timestamp,
        })
      );

      const signature = await wallet.signMessage(message);

      const response = await retry(
        async () => {
          const res = await fetch(`${this.apiBaseUrl}/v1/deposit`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              wallet: wallet.publicKey.toBase58(),
              amount: toSmallestUnit(request.amount, token).toString(),
              token,
              timestamp,
              signature: Buffer.from(signature).toString('base64'),
            }),
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
            throw new TransactionError(errorData.error || 'Deposit failed');
          }

          return res.json() as Promise<ShadowWireDepositResponse>;
        },
        { maxRetries: 2 }
      );

      if (!response.success) {
        throw new TransactionError(response.error || 'Deposit failed');
      }

      this.logger.info(`Deposit complete: ${response.transactionId}`);

      return {
        signature: response.transactionId,
        provider: this.provider,
        commitment: response.commitment,
        fee: request.amount * tokenConfig.fee,
      };
    } catch (error) {
      if (error instanceof TransactionError) throw error;
      throw wrapError(error, 'ShadowWire deposit failed');
    }
  }

  /**
   * Withdraw tokens from ShadowWire privacy pool
   */
  async withdraw(request: WithdrawRequest): Promise<WithdrawResult> {
    this.ensureReady();
    const wallet = this.ensureWallet();

    const token = request.token.toUpperCase();
    const tokenConfig = SHADOWWIRE_TOKENS[token];

    if (!tokenConfig) {
      throw new Error(`Token ${request.token} not supported by ShadowWire`);
    }

    const recipient =
      typeof request.recipient === 'string'
        ? request.recipient
        : request.recipient.toBase58();

    this.logger.info(`Withdrawing ${request.amount} ${token} from ShadowWire`);

    try {
      const timestamp = Date.now();
      const message = new TextEncoder().encode(
        JSON.stringify({
          action: 'withdraw',
          wallet: wallet.publicKey.toBase58(),
          recipient,
          amount: request.amount,
          token,
          timestamp,
        })
      );

      const signature = await wallet.signMessage(message);

      const response = await retry(
        async () => {
          const res = await fetch(`${this.apiBaseUrl}/v1/withdraw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              wallet: wallet.publicKey.toBase58(),
              recipient,
              amount: toSmallestUnit(request.amount, token).toString(),
              token,
              timestamp,
              signature: Buffer.from(signature).toString('base64'),
            }),
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
            throw new TransactionError(errorData.error || 'Withdrawal failed');
          }

          return res.json() as Promise<ShadowWireWithdrawResponse>;
        },
        { maxRetries: 2 }
      );

      if (!response.success) {
        throw new TransactionError(response.error || 'Withdrawal failed');
      }

      this.logger.info(`Withdrawal complete: ${response.transactionId}`);

      return {
        signature: response.transactionId,
        provider: this.provider,
        fee: request.amount * tokenConfig.fee,
      };
    } catch (error) {
      if (error instanceof TransactionError) throw error;
      throw wrapError(error, 'ShadowWire withdrawal failed');
    }
  }

  /**
   * Estimate costs for an operation
   */
  async estimate(request: EstimateRequest): Promise<EstimateResult> {
    const token = (request.token || 'SOL').toUpperCase();
    const tokenConfig = SHADOWWIRE_TOKENS[token];

    if (!tokenConfig) {
      return {
        fee: 0,
        provider: this.provider,
        latencyMs: 0,
        warnings: [`Token ${token} not supported by ShadowWire`],
      };
    }

    const amount = request.amount || 0;
    const feePercent = tokenConfig.fee;
    const fee = amount * feePercent;

    const warnings: string[] = [];

    if (amount > 0 && amount < tokenConfig.minAmount) {
      warnings.push(
        `Amount ${amount} ${token} is below minimum ${tokenConfig.minAmount}`
      );
    }

    // Estimate latency based on operation type
    let latencyMs = 3000; // Base latency
    if (request.operation === 'transfer') {
      latencyMs = request.privacy === PrivacyLevel.AMOUNT_HIDDEN ? 5000 : 3000;
    } else if (request.operation === 'deposit' || request.operation === 'withdraw') {
      latencyMs = 4000;
    }

    return {
      fee,
      tokenFee: fee,
      provider: this.provider,
      latencyMs,
      anonymitySet: 500, // Estimated pool size
      warnings,
    };
  }

  /**
   * Get fee percentage for a token
   */
  getFeePercentage(token: string): number {
    const config = SHADOWWIRE_TOKENS[token.toUpperCase()];
    return config?.fee || 0.01;
  }

  /**
   * Get minimum amount for a token
   */
  getMinimumAmount(token: string): number {
    const config = SHADOWWIRE_TOKENS[token.toUpperCase()];
    return config?.minAmount || 0;
  }

  /**
   * Calculate fee breakdown for an amount
   */
  calculateFee(
    amount: number,
    token: string
  ): { fee: number; netAmount: number; feePercent: number } {
    const feePercent = this.getFeePercentage(token);
    const fee = amount * feePercent;
    return {
      fee,
      netAmount: amount - fee,
      feePercent,
    };
  }
}
