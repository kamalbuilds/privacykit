# Getting Started with PrivacyKit

This guide will walk you through setting up PrivacyKit and executing your first private transfer on Solana.

## Prerequisites

Before you begin, make sure you have:

- Node.js 18 or higher
- npm, yarn, or pnpm
- A Solana wallet (Phantom, Solflare, or Backpack recommended)
- SOL for transaction fees
- Basic understanding of Solana and TypeScript

## Installation

Install the PrivacyKit SDK in your project:

```bash
# Using npm
npm install @privacykit/sdk @solana/web3.js

# Using yarn
yarn add @privacykit/sdk @solana/web3.js

# Using pnpm
pnpm add @privacykit/sdk @solana/web3.js
```

## Basic Setup

### 1. Import Required Modules

```typescript
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import {
  PrivacyLevel,
  PrivacyProvider,
  TransferRequest,
  WalletAdapter,
} from '@privacykit/sdk';
import { ShadowWireAdapter, createAdapter } from '@privacykit/sdk/adapters';
import { PrivacyRouter } from '@privacykit/sdk/core/router';
```

### 2. Create a Connection

```typescript
// Use a public RPC or your own Helius/QuickNode endpoint
const connection = new Connection(
  process.env.RPC_URL || 'https://api.devnet.solana.com',
  'confirmed'
);
```

### 3. Set Up Your Wallet

For production applications, use a wallet adapter:

```typescript
// Using @solana/wallet-adapter-react
import { useWallet } from '@solana/wallet-adapter-react';

function MyComponent() {
  const wallet = useWallet();

  // wallet.publicKey, wallet.signTransaction, etc.
}
```

For scripts or testing, create a wallet adapter from a keypair:

```typescript
function createWalletAdapter(keypair: Keypair): WalletAdapter {
  return {
    publicKey: keypair.publicKey,
    signTransaction: async (tx) => {
      // Sign with keypair
      return tx;
    },
    signAllTransactions: async (txs) => txs,
    signMessage: async (message) => {
      // Sign message with nacl
      return new Uint8Array(64);
    },
  };
}
```

### 4. Initialize an Adapter

```typescript
// Create ShadowWire adapter
const adapter = new ShadowWireAdapter();

// Initialize with connection and wallet
await adapter.initialize(connection, wallet);

// Check if ready
if (adapter.isReady()) {
  console.log('Adapter initialized successfully!');
}
```

## Your First Private Transfer

### Simple Amount-Hidden Transfer

```typescript
const result = await adapter.transfer({
  recipient: 'RecipientPublicKey...',
  amount: 1.5, // 1.5 SOL
  token: 'SOL',
  privacy: PrivacyLevel.AMOUNT_HIDDEN,
});

console.log('Transfer complete!');
console.log('Transaction signature:', result.signature);
console.log('Provider used:', result.provider);
console.log('Fee paid:', result.fee);
```

### Transfer with Options

```typescript
const result = await adapter.transfer({
  recipient: 'RecipientPublicKey...',
  amount: 100,
  token: 'USDC',
  privacy: PrivacyLevel.SENDER_HIDDEN,
  options: {
    maxFee: 2, // Max 2 USDC in fees
    memo: 'Payment for services',
    priorityFee: 0.001, // Priority fee in SOL
  },
});
```

## Understanding Privacy Levels

### Amount Hidden

Hides the transfer amount using Bulletproof zero-knowledge proofs. The sender and recipient addresses are visible, but the amount is encrypted.

```typescript
const request = {
  recipient: 'ABC...',
  amount: 5,
  token: 'SOL',
  privacy: PrivacyLevel.AMOUNT_HIDDEN, // Amount is hidden
};
```

**Best for:** Regular private payments where you want to hide how much you're sending.

### Sender Hidden

Anonymizes the sender's identity. The transfer comes from a privacy pool, making it impossible to trace back to you.

```typescript
const request = {
  recipient: 'ABC...',
  amount: 5,
  token: 'SOL',
  privacy: PrivacyLevel.SENDER_HIDDEN, // Your address is anonymized
};
```

**Best for:** Anonymous donations, privacy-focused payments.

### Full Encrypted

Uses Multi-Party Computation (MPC) to encrypt all transaction data. Both amount and addresses are hidden from public view.

```typescript
const request = {
  recipient: 'ABC...',
  amount: 5,
  token: 'SOL',
  privacy: PrivacyLevel.FULL_ENCRYPTED,
  provider: PrivacyProvider.ARCIUM, // Uses Arcium MPC network
};
```

**Best for:** Maximum privacy requirements, enterprise use cases.

### Compliant Pool

Privacy with regulatory compliance. Includes proof of innocence that can be verified if needed.

```typescript
const request = {
  recipient: 'ABC...',
  amount: 1000,
  token: 'USDC',
  privacy: PrivacyLevel.COMPLIANT_POOL,
  provider: PrivacyProvider.PRIVACY_CASH,
};
```

**Best for:** Business payments, regulated environments.

## Depositing into Privacy Pools

Before making internal (amount-hidden) transfers, you may need to deposit tokens into the privacy pool:

```typescript
// Deposit 10 SOL into the privacy pool
const depositResult = await adapter.deposit({
  amount: 10,
  token: 'SOL',
});

console.log('Deposit complete:', depositResult.signature);
console.log('Commitment:', depositResult.commitment); // Save this for withdrawal
```

## Checking Private Balances

```typescript
// Get shielded balance
const balance = await adapter.getBalance('SOL');
console.log('Shielded SOL balance:', balance);

// Get balance for specific address
const otherBalance = await adapter.getBalance('USDC', 'SomeAddress...');
```

## Withdrawing from Privacy Pools

```typescript
// Withdraw to a new address for maximum privacy
const withdrawResult = await adapter.withdraw({
  amount: 5,
  token: 'SOL',
  recipient: 'NewRecipientAddress...',
  commitment: 'CommitmentFromDeposit...', // Optional
});

console.log('Withdrawal complete:', withdrawResult.signature);
```

## Using the Privacy Router

The router automatically selects the best provider based on your requirements:

```typescript
// Create and configure router
const router = new PrivacyRouter();

// Register multiple adapters
const shadowWire = new ShadowWireAdapter();
const arcium = new ArciumAdapter();
await shadowWire.initialize(connection, wallet);
await arcium.initialize(connection, wallet);

router.registerAdapter(shadowWire);
router.registerAdapter(arcium);

// Get recommendation
const { recommended, alternatives, explanation } = await router.getRecommendation({
  recipient: 'ABC...',
  amount: 100,
  token: 'USDC',
  privacy: PrivacyLevel.AMOUNT_HIDDEN,
  options: { maxFee: 2 },
});

console.log('Recommended provider:', recommended.provider);
console.log('Explanation:', explanation);

// Execute with recommended provider
const result = await recommended.adapter.transfer({
  recipient: 'ABC...',
  amount: 100,
  token: 'USDC',
  privacy: PrivacyLevel.AMOUNT_HIDDEN,
});
```

## Estimating Costs

Before executing transfers, estimate the costs:

```typescript
const estimate = await adapter.estimate({
  operation: 'transfer',
  amount: 100,
  token: 'USDC',
  privacy: PrivacyLevel.AMOUNT_HIDDEN,
});

console.log('Estimated fee:', estimate.fee, 'USDC');
console.log('Estimated time:', estimate.latencyMs / 1000, 'seconds');
console.log('Anonymity set:', estimate.anonymitySet, 'users');

if (estimate.warnings.length > 0) {
  console.warn('Warnings:', estimate.warnings);
}
```

## Error Handling

PrivacyKit provides specific error types for common issues:

```typescript
import {
  PrivacyKitError,
  InsufficientBalanceError,
  AmountBelowMinimumError,
  ProviderNotAvailableError,
  TransactionError,
} from '@privacykit/sdk';

try {
  await adapter.transfer(request);
} catch (error) {
  if (error instanceof InsufficientBalanceError) {
    console.error(`Insufficient balance: need ${error.required}, have ${error.available}`);
  } else if (error instanceof AmountBelowMinimumError) {
    console.error(`Amount too low: minimum is ${error.minimum} ${error.token}`);
  } else if (error instanceof ProviderNotAvailableError) {
    console.error(`Provider ${error.provider} is not available`);
  } else if (error instanceof TransactionError) {
    console.error(`Transaction failed: ${error.message}`);
    if (error.signature) {
      console.error(`Transaction signature: ${error.signature}`);
    }
  } else {
    throw error;
  }
}
```

## React Integration

For React applications, use the provided hooks and context:

```tsx
// In your app layout
import { PrivacyKitProvider } from '@privacykit/react';

function App({ children }) {
  return (
    <ConnectionProvider endpoint={rpcUrl}>
      <WalletProvider wallets={wallets}>
        <PrivacyKitProvider network="devnet">
          {children}
        </PrivacyKitProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}

// In your components
import { usePrivateTransfer, usePrivateBalance } from '@privacykit/react';

function TransferForm() {
  const { executeTransfer, isLoading, error, result } = usePrivateTransfer();
  const { balance, refresh } = usePrivateBalance('SOL');

  const handleSubmit = async (e) => {
    e.preventDefault();

    await executeTransfer({
      recipient: recipientAddress,
      amount: parseFloat(amount),
      token: 'SOL',
      privacy: PrivacyLevel.AMOUNT_HIDDEN,
    });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Form fields */}
      <button type="submit" disabled={isLoading}>
        {isLoading ? 'Sending...' : 'Send Private Transfer'}
      </button>
    </form>
  );
}
```

## Supported Tokens

| Token | ShadowWire | Arcium | Privacy Cash |
|-------|------------|--------|--------------|
| SOL | 0.5% fee | 0.2% fee | 0.5% fee |
| USDC | 1% fee | 0.2% fee | 0.5% fee |
| USDT | 1% fee | 0.2% fee | - |
| BONK | 1% fee | - | - |
| RADR | 0.3% fee | - | - |
| ORE | 0.3% fee | - | - |

## Best Practices

1. **Always estimate first**: Check fees and warnings before executing transfers
2. **Handle errors gracefully**: Use the specific error types for better UX
3. **Use the router**: Let PrivacyKit choose the best provider automatically
4. **Refresh balances**: Update balances after deposits/withdrawals
5. **Test on devnet**: Always test on devnet before mainnet

## Next Steps

- Explore the [API Reference](./api-reference.md) for complete documentation
- Check out the [examples](../examples) for working code
- Join our [Discord](https://discord.gg/privacykit) for community support

## Troubleshooting

### "Provider not available" Error

Make sure you've initialized the adapter with a valid connection and wallet:

```typescript
await adapter.initialize(connection, wallet);
```

### "Insufficient balance" Error

Check your shielded balance and ensure you've deposited enough tokens:

```typescript
const balance = await adapter.getBalance('SOL');
console.log('Available:', balance);
```

### "Amount below minimum" Error

Each provider has minimum transfer amounts. Check the estimate for warnings:

```typescript
const estimate = await adapter.estimate({
  operation: 'transfer',
  amount: yourAmount,
  token: 'SOL',
});
console.log('Warnings:', estimate.warnings);
```

### Transaction Timeouts

For large transfers or during network congestion, increase the timeout:

```typescript
// Set environment variable or configure in your code
process.env.PRIVACY_KIT_TIMEOUT = '120000'; // 2 minutes
```
