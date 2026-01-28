export { BaseAdapter } from './base';
export { ShadowWireAdapter } from './shadowwire';
export { ArciumAdapter } from './arcium';
export { NoirAdapter } from './noir';
export { PrivacyCashAdapter } from './privacycash';

import type { PrivacyProviderAdapter } from '../types';
import { PrivacyProvider } from '../types';
import { ShadowWireAdapter } from './shadowwire';
import { ArciumAdapter } from './arcium';
import { NoirAdapter } from './noir';
import { PrivacyCashAdapter } from './privacycash';

/**
 * Create an adapter instance for a provider
 */
export function createAdapter(provider: PrivacyProvider): PrivacyProviderAdapter {
  switch (provider) {
    case PrivacyProvider.SHADOWWIRE:
      return new ShadowWireAdapter();
    case PrivacyProvider.ARCIUM:
      return new ArciumAdapter();
    case PrivacyProvider.NOIR:
      return new NoirAdapter();
    case PrivacyProvider.PRIVACY_CASH:
      return new PrivacyCashAdapter();
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Get all available adapters
 */
export function getAllAdapters(): PrivacyProviderAdapter[] {
  return [
    new ShadowWireAdapter(),
    new ArciumAdapter(),
    new NoirAdapter(),
    new PrivacyCashAdapter(),
  ];
}
