/**
 * @fileoverview EventHub Package Index
 *
 * This module provides consolidated exports for the EventHub package core functionality.
 * Only exports essential public API elements used by other packages.
 *
 * @author
 * @version 1.0.0
 */

// Core EventHub implementations
export {
  EventHub,
  EventHubImpl
} from './EventHub';
export {
  EventHubFactory,
  EventHubFactoryImpl
} from './EventHubFactory';

// Event building utilities
export {
  EventBuilder,
  EventFactory
} from './EventBuilder';

// Core types and interfaces
export type {
  Event,
  BaseEvent,
  EventListener,
  EventHubConfig,
} from './types';

export {
  EventPriority
} from './types';

// Utility functions
export { createEvent } from './utils';

// Error handling
export {
  EventHubError
} from './EventHubError';

export {
  EventHubConfigurationError,
  EventHubCreationError
} from './EventHubFactory';

export type {
  EventHubErrorContext,
  EventHubErrorRecovery
} from './EventHubError';

// Re-export from sub-modules
export * from './topic';
export * from './queue';
export * from './ports';

// Type aliases for backward compatibility (these are all EventHubError now)
export type {
  TopicError,
  QueueError,
  SubscriptionError,
  EventProcessingError,
  EventHubStateError
} from './EventHubError';
