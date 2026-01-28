# PrivacyKit API Reference

Complete API documentation for the PrivacyKit SDK.

## Table of Contents

- [Types & Enums](#types--enums)
- [Adapters](#adapters)
- [Router](#router)
- [Utility Functions](#utility-functions)
- [Error Classes](#error-classes)
- [React Hooks](#react-hooks)

---

## Types & Enums

### PrivacyLevel

Enum representing available privacy levels.

```typescript
enum PrivacyLevel {
  /** Amount is hidden using Bulletproofs (ShadowWire) */
  AMOUNT_HIDDEN = 'amount-hidden',

  /** Sender identity is hidden */
  SENDER_HIDDEN = 'sender-hidden',

  /** Full encryption of all transaction data (Arcium MPC) */
  FULL_ENCRYPTED = 'full-encrypted',

  /** Zero-knowledge proof based privacy (Noir) */
  ZK_PROVEN = 'zk-proven',

  /** Compliant privacy with proof of innocence (Privacy Cash) */
  COMPLIANT_POOL = 'compliant-pool',

  /** No privacy - regular Solana transaction */
  NONE = 'none',
}
```

### PrivacyProvider

Enum representing supported privacy providers.

```typescript
enum PrivacyProvider {
  SHADOWWIRE = 'shadowwire',
  ARCIUM = 'arcium',
  NOIR = 'noir',
  PRIVACY_CASH = 'privacycash',
  INCO = 'inco',
}
```

### NetworkCluster

Type for Solana network clusters.

```typescript
type NetworkCluster = 'mainnet-beta' | 'devnet' | 'testnet' | 'localnet';
```

### WalletAdapter

Interface for wallet adapters compatible with PrivacyKit.

```typescript
interface WalletAdapter {
  /** Wallet public key */
  publicKey: PublicKey;

  /** Sign a single transaction */
  signTransaction: <T extends { serialize(): Uint8Array }>(tx: T) => Promise<T>;

  /** Sign multiple transactions */
  signAllTransactions: <T extends { serialize(): Uint8Array }>(txs: T[]) => Promise<T[]>;

  /** Sign a message */
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
}
```

### PrivacyKitConfig

Configuration options for PrivacyKit initialization.

```typescript
interface PrivacyKitConfig {
  /** Solana network cluster */
  network: NetworkCluster;

  /** RPC endpoint URL (optional, uses default for network) */
  rpcUrl?: string;

  /** Enabled privacy providers */
  providers?: PrivacyProvider[];

  /** Wallet adapter for signing */
  wallet?: WalletAdapter;

  /** Enable debug logging */
  debug?: boolean;

  /** Custom RPC headers (for authenticated endpoints) */
  rpcHeaders?: Record<string, string>;
}
```

### TransferRequest

Parameters for a transfer operation.

```typescript
interface TransferRequest {
  /** Recipient address (public key or stealth address) */
  recipient: string | PublicKey;

  /** Amount to transfer (in token units, not lamports) */
  amount: number;

  /** Token symbol (e.g., 'SOL', 'USDC') */
  token: string;

  /** Desired privacy level */
  privacy: PrivacyLevel;

  /** Force specific provider (optional, auto-selected if not specified) */
  provider?: PrivacyProvider;

  /** Additional options */
  options?: TransferOptions;
}
```

### TransferOptions

Additional options for transfers.

```typescript
interface TransferOptions {
  /** Maximum fee willing to pay (in token units) */
  maxFee?: number;

  /** Memo/note for the transfer */
  memo?: string;

  /** Priority fee for faster confirmation (in SOL) */
  priorityFee?: number;

  /** Custom proof data (for ZK transfers) */
  customProof?: Uint8Array;
}
```

### TransferResult

Result of a successful transfer.

```typescript
interface TransferResult {
  /** Transaction signature */
  signature: TransactionSignature;

  /** Provider used for the transfer */
  provider: PrivacyProvider;

  /** Privacy level achieved */
  privacyLevel: PrivacyLevel;

  /** Fee paid (in token units) */
  fee: number;

  /** Block time of confirmation */
  blockTime?: number;

  /** Anonymity set size (if applicable) */
  anonymitySet?: number;
}
```

### DepositRequest

Parameters for depositing into a privacy pool.

```typescript
interface DepositRequest {
  /** Amount to deposit */
  amount: number;

  /** Token symbol */
  token: string;

  /** Target provider */
  provider?: PrivacyProvider;
}
```

### DepositResult

Result of a successful deposit.

```typescript
interface DepositResult {
  /** Transaction signature */
  signature: TransactionSignature;

  /** Provider used */
  provider: PrivacyProvider;

  /** Commitment/note for future withdrawal */
  commitment?: string;

  /** Fee paid */
  fee: number;
}
```

### WithdrawRequest

Parameters for withdrawing from a privacy pool.

```typescript
interface WithdrawRequest {
  /** Amount to withdraw */
  amount: number;

  /** Token symbol */
  token: string;

  /** Recipient address */
  recipient: string | PublicKey;

  /** Provider to withdraw from */
  provider?: PrivacyProvider;

  /** Commitment/note from deposit */
  commitment?: string;
}
```

### WithdrawResult

Result of a successful withdrawal.

```typescript
interface WithdrawResult {
  /** Transaction signature */
  signature: TransactionSignature;

  /** Provider used */
  provider: PrivacyProvider;

  /** Fee paid */
  fee: number;
}
```

### EstimateRequest

Parameters for cost estimation.

```typescript
interface EstimateRequest {
  /** Type of operation */
  operation: 'transfer' | 'deposit' | 'withdraw' | 'prove';

  /** Amount (if applicable) */
  amount?: number;

  /** Token */
  token?: string;

  /** Privacy level */
  privacy?: PrivacyLevel;

  /** Specific provider */
  provider?: PrivacyProvider;
}
```

### EstimateResult

Result of cost estimation.

```typescript
interface EstimateResult {
  /** Estimated fee in token units */
  fee: number;

  /** Estimated fee in token (if applicable) */
  tokenFee?: number;

  /** Provider that would be used */
  provider: PrivacyProvider;

  /** Estimated latency in milliseconds */
  latencyMs: number;

  /** Estimated anonymity set size */
  anonymitySet?: number;

  /** Warnings or considerations */
  warnings: string[];
}
```

### BalanceResult

Result of balance query.

```typescript
interface BalanceResult {
  /** Public (visible) balance */
  public: number;

  /** Shielded (private) balance per provider */
  shielded: Partial<Record<PrivacyProvider, number>>;

  /** Total balance */
  total: number;

  /** Token symbol */
  token: string;
}
```

---

## Adapters

### BaseAdapter

Abstract base class for all provider adapters.

#### Properties

| Property | Type | Description |
|----------|------|-------------|
| `provider` | `PrivacyProvider` | Provider identifier |
| `name` | `string` | Human-readable name |
| `supportedLevels` | `PrivacyLevel[]` | Supported privacy levels |
| `supportedTokens` | `string[]` | Supported token symbols |

#### Methods

##### initialize

Initialize the adapter with connection and wallet.

```typescript
async initialize(connection: Connection, wallet?: WalletAdapter): Promise<void>
```

**Parameters:**
- `connection` - Solana RPC connection
- `wallet` - Optional wallet adapter for signing

##### isReady

Check if the adapter is ready for use.

```typescript
isReady(): boolean
```

**Returns:** `true` if initialized and ready

##### getBalance

Get shielded balance for a token.

```typescript
async getBalance(token: string, address?: string): Promise<number>
```

**Parameters:**
- `token` - Token symbol (e.g., 'SOL')
- `address` - Optional address (defaults to connected wallet)

**Returns:** Shielded balance amount

##### transfer

Execute a private transfer.

```typescript
async transfer(request: TransferRequest): Promise<TransferResult>
```

**Parameters:**
- `request` - Transfer parameters

**Returns:** Transfer result with signature and details

**Throws:**
- `InsufficientBalanceError` - Not enough balance
- `AmountBelowMinimumError` - Amount below minimum
- `TransactionError` - Transaction failed

##### deposit

Deposit tokens into privacy pool.

```typescript
async deposit(request: DepositRequest): Promise<DepositResult>
```

**Parameters:**
- `request` - Deposit parameters

**Returns:** Deposit result with commitment

##### withdraw

Withdraw tokens from privacy pool.

```typescript
async withdraw(request: WithdrawRequest): Promise<WithdrawResult>
```

**Parameters:**
- `request` - Withdrawal parameters

**Returns:** Withdrawal result

##### estimate

Estimate costs for an operation.

```typescript
async estimate(request: EstimateRequest): Promise<EstimateResult>
```

**Parameters:**
- `request` - Estimation parameters

**Returns:** Estimated costs and latency

##### supports

Check if an operation is supported.

```typescript
supports(operation: string, token: string, privacy: PrivacyLevel): boolean
```

**Returns:** `true` if operation is supported

---

### ShadowWireAdapter

Adapter for ShadowWire privacy protocol.

#### Supported Features
- Privacy Levels: `AMOUNT_HIDDEN`, `SENDER_HIDDEN`
- Tokens: SOL, USDC, USDT, BONK, RADR, ORE, and more

#### Additional Methods

##### setApiUrl

Configure custom API endpoint.

```typescript
setApiUrl(url: string): void
```

##### getFeePercentage

Get fee percentage for a token.

```typescript
getFeePercentage(token: string): number
```

##### getMinimumAmount

Get minimum transfer amount for a token.

```typescript
getMinimumAmount(token: string): number
```

##### calculateFee

Calculate fee breakdown for an amount.

```typescript
calculateFee(amount: number, token: string): {
  fee: number;
  netAmount: number;
  feePercent: number;
}
```

#### Example

```typescript
import { ShadowWireAdapter } from '@privacykit/sdk/adapters';

const adapter = new ShadowWireAdapter();
await adapter.initialize(connection, wallet);

// Check fee
const feePercent = adapter.getFeePercentage('SOL');
console.log(`SOL fee: ${feePercent * 100}%`);

// Execute transfer
const result = await adapter.transfer({
  recipient: 'ABC...',
  amount: 1.5,
  token: 'SOL',
  privacy: PrivacyLevel.AMOUNT_HIDDEN,
});
```

---

### ArciumAdapter

Adapter for Arcium MPC privacy protocol.

#### Supported Features
- Privacy Levels: `FULL_ENCRYPTED`, `AMOUNT_HIDDEN`, `SENDER_HIDDEN`
- Tokens: SOL, USDC

#### Example

```typescript
import { ArciumAdapter } from '@privacykit/sdk/adapters';

const adapter = new ArciumAdapter();
await adapter.initialize(connection, wallet);

const result = await adapter.transfer({
  recipient: 'ABC...',
  amount: 5,
  token: 'SOL',
  privacy: PrivacyLevel.FULL_ENCRYPTED,
});
```

---

### PrivacyCashAdapter

Adapter for Privacy Cash compliant privacy protocol.

#### Supported Features
- Privacy Levels: `COMPLIANT_POOL`, `SENDER_HIDDEN`
- Tokens: SOL, USDC

#### Example

```typescript
import { PrivacyCashAdapter } from '@privacykit/sdk/adapters';

const adapter = new PrivacyCashAdapter();
await adapter.initialize(connection, wallet);

const result = await adapter.transfer({
  recipient: 'ABC...',
  amount: 1000,
  token: 'USDC',
  privacy: PrivacyLevel.COMPLIANT_POOL,
});
```

---

### NoirAdapter

Adapter for Noir ZK proof-based privacy.

#### Supported Features
- Privacy Levels: `ZK_PROVEN`
- Tokens: Any token (via custom circuits)

---

### createAdapter

Factory function to create an adapter instance.

```typescript
function createAdapter(provider: PrivacyProvider): PrivacyProviderAdapter
```

**Example:**

```typescript
import { createAdapter } from '@privacykit/sdk/adapters';

const adapter = createAdapter(PrivacyProvider.SHADOWWIRE);
await adapter.initialize(connection, wallet);
```

### getAllAdapters

Get instances of all available adapters.

```typescript
function getAllAdapters(): PrivacyProviderAdapter[]
```

---

## Router

### PrivacyRouter

Intelligent routing engine that selects the optimal privacy provider.

#### Methods

##### registerAdapter

Register an adapter with the router.

```typescript
registerAdapter(adapter: PrivacyProviderAdapter): void
```

##### getAdapter

Get a registered adapter by provider.

```typescript
getAdapter(provider: PrivacyProvider): PrivacyProviderAdapter | undefined
```

##### getAdapters

Get all registered adapters.

```typescript
getAdapters(): PrivacyProviderAdapter[]
```

##### selectProvider

Select the best provider for given criteria.

```typescript
async selectProvider(criteria: SelectionCriteria): Promise<SelectionResult>
```

**SelectionCriteria:**

```typescript
interface SelectionCriteria {
  privacyLevel: PrivacyLevel;
  token: string;
  amount?: number;
  maxFee?: number;
  maxLatency?: number;
  preferredProvider?: PrivacyProvider;
  requireOnChainVerification?: boolean;
  requireCompliance?: boolean;
}
```

**SelectionResult:**

```typescript
interface SelectionResult {
  provider: PrivacyProvider;
  adapter: PrivacyProviderAdapter;
  estimate: EstimateResult;
  score: number;
  reasons: string[];
}
```

##### getRecommendation

Get routing recommendation with alternatives.

```typescript
async getRecommendation(request: TransferRequest): Promise<{
  recommended: SelectionResult;
  alternatives: SelectionResult[];
  explanation: string;
}>
```

##### getDefaultProvider

Get the default provider for a privacy level.

```typescript
getDefaultProvider(privacyLevel: PrivacyLevel): PrivacyProvider
```

#### Example

```typescript
import { PrivacyRouter } from '@privacykit/sdk/core/router';

const router = new PrivacyRouter();
router.registerAdapter(shadowWireAdapter);
router.registerAdapter(arciumAdapter);

// Get recommendation
const { recommended, alternatives, explanation } = await router.getRecommendation({
  recipient: 'ABC...',
  amount: 100,
  token: 'USDC',
  privacy: PrivacyLevel.AMOUNT_HIDDEN,
});

console.log(explanation);
// Recommended: ShadowWire
// Reasons:
//   - Supports amount-hidden privacy
//   - Supports USDC token
// Estimated fee: 1.0000 USDC
// Estimated latency: 5.0s
// Anonymity set: ~500 users
```

---

## Utility Functions

### Token Utilities

```typescript
import {
  getTokenInfo,
  getProviderFee,
  getMinimumAmount,
  isTokenSupported,
  getProvidersForToken,
  toSmallestUnit,
  fromSmallestUnit,
} from '@privacykit/sdk/types/tokens';
```

#### getTokenInfo

Get information about a supported token.

```typescript
function getTokenInfo(symbol: string): SupportedToken | undefined
```

#### getProviderFee

Get fee percentage for a provider and token.

```typescript
function getProviderFee(provider: PrivacyProvider, token: string): number
```

#### getMinimumAmount

Get minimum amount for a provider and token.

```typescript
function getMinimumAmount(provider: PrivacyProvider, token: string): number
```

#### isTokenSupported

Check if a token is supported by a provider.

```typescript
function isTokenSupported(token: string, provider: PrivacyProvider): boolean
```

#### getProvidersForToken

Get all providers that support a token.

```typescript
function getProvidersForToken(token: string): PrivacyProvider[]
```

#### toSmallestUnit

Convert amount to smallest units (lamports).

```typescript
function toSmallestUnit(amount: number, token: string): bigint
```

#### fromSmallestUnit

Convert from smallest units to token amount.

```typescript
function fromSmallestUnit(amount: bigint, token: string): number
```

### General Utilities

```typescript
import {
  isValidPublicKey,
  toPublicKey,
  sleep,
  retry,
  randomBytes,
  bytesToBase58,
  base58ToBytes,
  bytesToHex,
  hexToBytes,
  formatSol,
  formatTokenAmount,
  truncateAddress,
  isBrowser,
  isWasmSupported,
} from '@privacykit/sdk/utils';
```

#### isValidPublicKey

Validate a Solana public key string.

```typescript
function isValidPublicKey(address: string): boolean
```

#### toPublicKey

Parse address to PublicKey.

```typescript
function toPublicKey(address: string | PublicKey): PublicKey
```

#### retry

Retry a function with exponential backoff.

```typescript
async function retry<T>(
  fn: () => Promise<T>,
  options?: {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    shouldRetry?: (error: unknown) => boolean;
  }
): Promise<T>
```

#### formatTokenAmount

Format token amount for display.

```typescript
function formatTokenAmount(amount: number, decimals: number, symbol: string): string
```

#### truncateAddress

Truncate address for display.

```typescript
function truncateAddress(address: string, chars?: number): string
```

---

## Error Classes

### PrivacyKitError

Base error class for all PrivacyKit errors.

```typescript
class PrivacyKitError extends Error {
  code: string;
  cause?: Error;
}
```

### ProviderNotAvailableError

Thrown when a provider is not initialized or unavailable.

```typescript
class ProviderNotAvailableError extends PrivacyKitError {
  provider: PrivacyProvider;
}
```

### UnsupportedTokenError

Thrown when a token is not supported.

```typescript
class UnsupportedTokenError extends PrivacyKitError {
  token: string;
  provider?: PrivacyProvider;
}
```

### UnsupportedPrivacyLevelError

Thrown when a privacy level is not supported.

```typescript
class UnsupportedPrivacyLevelError extends PrivacyKitError {
  level: PrivacyLevel;
  provider?: PrivacyProvider;
}
```

### InsufficientBalanceError

Thrown when balance is insufficient.

```typescript
class InsufficientBalanceError extends PrivacyKitError {
  required: number;
  available: number;
  token: string;
}
```

### RecipientNotFoundError

Thrown when recipient is not found or invalid.

```typescript
class RecipientNotFoundError extends PrivacyKitError {
  recipient: string;
}
```

### TransactionError

Thrown when a transaction fails.

```typescript
class TransactionError extends PrivacyKitError {
  signature?: string;
}
```

### AmountBelowMinimumError

Thrown when amount is below minimum.

```typescript
class AmountBelowMinimumError extends PrivacyKitError {
  amount: number;
  minimum: number;
  token: string;
  provider: PrivacyProvider;
}
```

### NetworkError

Thrown when network/RPC connection fails.

```typescript
class NetworkError extends PrivacyKitError {}
```

### Error Handling Utilities

```typescript
import { isPrivacyKitError, wrapError } from '@privacykit/sdk/utils/errors';

// Type guard
if (isPrivacyKitError(error)) {
  console.log(error.code);
}

// Wrap unknown errors
const wrappedError = wrapError(error, 'Operation failed');
```

---

## React Hooks

### usePrivacyKit

Main hook for accessing PrivacyKit context.

```typescript
function usePrivacyKit(): {
  isInitialized: boolean;
  isLoading: boolean;
  error: Error | null;
  network: NetworkCluster;
  availableProviders: PrivacyProvider[];
  balances: Partial<Record<string, BalanceResult>>;
  refreshBalances: () => Promise<void>;
  transfer: (request: TransferRequest) => Promise<TransferResult>;
  deposit: (request: DepositRequest) => Promise<DepositResult>;
  withdraw: (request: WithdrawRequest) => Promise<WithdrawResult>;
  estimate: (operation: string, params: object) => Promise<EstimateResult>;
  getRecommendedProvider: (request: TransferRequest) => Promise<{ provider: PrivacyProvider; explanation: string }>;
  getSupportedTokens: (provider?: PrivacyProvider) => string[];
  getSupportedPrivacyLevels: (provider?: PrivacyProvider) => PrivacyLevel[];
}
```

### usePrivateTransfer

Hook for executing private transfers.

```typescript
function usePrivateTransfer(): {
  isLoading: boolean;
  isEstimating: boolean;
  error: Error | null;
  result: TransferResult | null;
  estimate: EstimateResult | null;
  executeTransfer: (params: TransferParams) => Promise<TransferResult>;
  estimateFee: (params: EstimateParams) => Promise<EstimateResult>;
  reset: () => void;
}
```

### usePrivateBalance

Hook for fetching private balance.

```typescript
function usePrivateBalance(token: string): {
  balance: BalanceResult | null;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}
```

### useAllPrivateBalances

Hook for fetching all private balances.

```typescript
function useAllPrivateBalances(): {
  balances: Partial<Record<string, BalanceResult>>;
  isLoading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}
```

### useBalanceByProvider

Hook for getting balance breakdown by provider.

```typescript
function useBalanceByProvider(token: string): {
  balanceByProvider: Partial<Record<PrivacyProvider, number>>;
  totalShielded: number;
  isLoading: boolean;
}
```

### PrivacyKitProvider

React context provider for PrivacyKit.

```typescript
function PrivacyKitProvider({
  children,
  network = 'devnet',
  providers = [PrivacyProvider.SHADOWWIRE, PrivacyProvider.ARCIUM, PrivacyProvider.PRIVACY_CASH],
}: {
  children: ReactNode;
  network?: NetworkCluster;
  providers?: PrivacyProvider[];
}): JSX.Element
```

---

## Constants

### Default RPC Endpoints

```typescript
import { DEFAULT_RPC_ENDPOINTS, HELIUS_RPC_ENDPOINTS } from '@privacykit/sdk/utils/constants';

// DEFAULT_RPC_ENDPOINTS['mainnet-beta'] = 'https://api.mainnet-beta.solana.com'
// DEFAULT_RPC_ENDPOINTS['devnet'] = 'https://api.devnet.solana.com'
```

### Provider Endpoints

```typescript
import { PROVIDER_ENDPOINTS } from '@privacykit/sdk/utils/constants';

// PROVIDER_ENDPOINTS.shadowwire.api = 'https://api.radr.fun'
// PROVIDER_ENDPOINTS.arcium.api = 'https://api.arcium.com'
```

### Compute Units

```typescript
import { COMPUTE_UNITS } from '@privacykit/sdk/utils/constants';

// COMPUTE_UNITS.SIMPLE_TRANSFER = 200_000
// COMPUTE_UNITS.PRIVATE_TRANSFER = 400_000
// COMPUTE_UNITS.ZK_VERIFY = 1_000_000
```

### Timeouts

```typescript
import { TIMEOUTS } from '@privacykit/sdk/utils/constants';

// TIMEOUTS.RPC_CALL = 30_000
// TIMEOUTS.TRANSACTION_CONFIRM = 60_000
// TIMEOUTS.PROOF_GENERATION = 120_000
```

---

## Events

PrivacyKit emits events for monitoring operations.

```typescript
type PrivacyKitEvent =
  | { type: 'initialized'; providers: PrivacyProvider[] }
  | { type: 'transfer:start'; request: TransferRequest }
  | { type: 'transfer:complete'; result: TransferResult }
  | { type: 'transfer:error'; error: Error }
  | { type: 'deposit:start'; request: DepositRequest }
  | { type: 'deposit:complete'; result: DepositResult }
  | { type: 'withdraw:start'; request: WithdrawRequest }
  | { type: 'withdraw:complete'; result: WithdrawResult }
  | { type: 'prove:start'; request: ProveRequest }
  | { type: 'prove:complete'; result: ProveResult };
```

---

## TypeScript Support

PrivacyKit is written in TypeScript and includes full type definitions. All exports are fully typed:

```typescript
// Import types
import type {
  PrivacyLevel,
  PrivacyProvider,
  TransferRequest,
  TransferResult,
  WalletAdapter,
  PrivacyKitConfig,
} from '@privacykit/sdk';

// Import values
import {
  PrivacyLevel,
  PrivacyProvider,
} from '@privacykit/sdk';
```
