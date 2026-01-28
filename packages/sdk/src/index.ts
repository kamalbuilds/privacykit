/**
 * PrivacyKit SDK
 *
 * A unified privacy SDK for Solana that provides access to multiple
 * privacy-preserving technologies through a single, easy-to-use interface.
 *
 * @packageDocumentation
 */

// Main SDK class
export {
  PrivacyKit,
  PipelineBuilder,
  type PrivacyKitEvents,
} from './core/privacykit';

// Re-export default
export { default } from './core/privacykit';

// Router
export { PrivacyRouter, type SelectionCriteria, type SelectionResult } from './core/router';

// Types
export {
  // Enums
  PrivacyLevel,
  PrivacyProvider,

  // Config types
  type PrivacyKitConfig,
  type NetworkCluster,
  type WalletAdapter,

  // Request/Response types
  type TransferRequest,
  type TransferResult,
  type TransferOptions,
  type DepositRequest,
  type DepositResult,
  type WithdrawRequest,
  type WithdrawResult,
  type ProveRequest,
  type ProveResult,
  type BalanceResult,
  type EstimateRequest,
  type EstimateResult,

  // Pipeline types
  type PipelineStep,
  type PipelineResult,

  // Token types
  type SupportedToken,

  // Adapter interface
  type PrivacyProviderAdapter,
} from './types';

// Token utilities
export {
  SUPPORTED_TOKENS,
  PROVIDER_FEES,
  MINIMUM_AMOUNTS,
  getTokenInfo,
  getProviderFee,
  getMinimumAmount,
  isTokenSupported,
  getProvidersForToken,
  toSmallestUnit,
  fromSmallestUnit,
} from './types/tokens';

// Adapters
export {
  BaseAdapter,
  ShadowWireAdapter,
  ArciumAdapter,
  NoirAdapter,
  PrivacyCashAdapter,
  createAdapter,
  getAllAdapters,
} from './adapters';

// Utils
export {
  // Logger
  Logger,
  LogLevel,
  defaultLogger,
  createDebugLogger,

  // Errors
  PrivacyKitError,
  ProviderNotAvailableError,
  UnsupportedTokenError,
  UnsupportedPrivacyLevelError,
  InsufficientBalanceError,
  RecipientNotFoundError,
  TransactionError,
  WalletNotConnectedError,
  ProofGenerationError,
  ProofVerificationError,
  AmountBelowMinimumError,
  NetworkError,
  isPrivacyKitError,
  wrapError,

  // Constants
  DEFAULT_RPC_ENDPOINTS,
  HELIUS_RPC_ENDPOINTS,
  PROVIDER_ENDPOINTS,
  NATIVE_SOL_MINT,
  COMPUTE_UNITS,
  DEFAULT_CONFIRMATION,
  TIMEOUTS,
  VERSION,

  // Helper functions
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
} from './utils';
