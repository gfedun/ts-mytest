/**
 * @fileoverview XPlugin Package - Consolidated Type Definitions
 *
 * This file consolidates and re-exports all type definitions from the xplugin package
 * to provide a single, comprehensive type interface for consumers.
 */

// Re-export all types from individual type modules
export * from './types/CoreTypes';
export * from './types/ConfigTypes';
export * from './types/LifecycleTypes';
export * from './types/LoaderTypes';

// Re-export integration types
export * from './integration/ServiceHooks';
export * from './integration/ContextBridge';

// Re-export error types
export * from './errors/PluginError';

// Additional consolidated types for the xplugin package

/**
 * XPlugin package version and metadata
 */
export interface PluginPackageInfo {
  readonly version: string;
  readonly name: string;
  readonly description: string;
  readonly author: string;
}

/**
 * XPlugin engine configuration union type
 */
export type PluginConfig = {
  engine?: {
    enableServiceHooks?: boolean;
    enableContextBridge?: boolean;
    enableMetrics?: boolean;
    enableErrorRecovery?: boolean;
  };
  registry?: {
    enableCaching?: boolean;
    cacheSize?: number;
    enableValidation?: boolean;
  };
  lifecycle?: {
    enableAutoRecovery?: boolean;
    maxRetryAttempts?: number;
    timeoutMs?: number;
  };
  integration?: {
    eventHubIntegration?: boolean;
    serviceHooksEnabled?: boolean;
    contextBridgeEnabled?: boolean;
  };
};

/**
 * XPlugin operation result wrapper
 */
export type PluginResult<T, E = Error> = {
  success: boolean;
  data?: T;
  error?: E;
  metadata?: Record<string, any>;
  timestamp: Date;
};

/**
 * XPlugin event data structure
 */
export interface PluginEventData {
  readonly eventType: string;
  readonly pluginId?: string;
  readonly timestamp: Date;
  readonly source: string;
  readonly metadata?: Record<string, any>;
}

/**
 * XPlugin hook priority levels
 */
export enum PluginHookPriority {
  HIGHEST = 1000,
  HIGH = 750,
  NORMAL = 500,
  LOW = 250,
  LOWEST = 100
}

/**
 * XPlugin service status
 */
export enum PluginServiceStatus {
  UNINITIALIZED = 'uninitialized',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  STARTING = 'starting',
  RUNNING = 'running',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error',
  DISPOSED = 'disposed'
}

/**
 * XPlugin feature flags
 */
export interface PluginFeatureFlags {
  enableServiceHooks: boolean;
  enableContextBridge: boolean;
  enableMetrics: boolean;
  enableErrorRecovery: boolean;
  enableAutoRetry: boolean;
  enableCaching: boolean;
  enableValidation: boolean;
  enableDebugMode: boolean;
}

/**
 * XPlugin metrics data structure
 */
export interface PluginMetrics {
  readonly pluginId?: string;
  readonly metricName: string;
  readonly value: number;
  readonly timestamp: Date;
  readonly metadata?: Record<string, any>;
}

/**
 * XPlugin health check result
 */
export interface PluginHealthCheck {
  readonly healthy: boolean;
  readonly status: PluginServiceStatus;
  readonly lastCheck: Date;
  readonly errors: string[];
  readonly warnings: string[];
  readonly uptime?: number;
  readonly metadata?: Record<string, any>;
}

/**
 * XPlugin dependency information
 */
export interface PluginDependency {
  readonly pluginId: string;
  readonly version?: string;
  readonly optional: boolean;
  readonly resolved: boolean;
  readonly resolvedVersion?: string;
  readonly metadata?: Record<string, any>;
}

/**
 * XPlugin registry entry
 */
export interface PluginRegistryEntry {
  readonly pluginId: string;
  readonly pluginName: string;
  readonly version: string;
  readonly status: PluginServiceStatus;
  readonly registrationTime: Date;
  readonly lastActivity: Date;
  readonly dependencies: PluginDependency[];
  readonly metadata?: Record<string, any>;
}

/**
 * XPlugin operation context
 */
export interface PluginOperationContext {
  readonly operationId: string;
  readonly pluginId?: string;
  readonly operation: string;
  readonly startTime: Date;
  readonly timeout?: number;
  readonly retryCount: number;
  readonly maxRetries: number;
  readonly metadata?: Record<string, any>;
}

/**
 * XPlugin error context
 */
export interface PluginErrorContext {
  readonly pluginId?: string;
  readonly operation?: string;
  readonly context: string;
  readonly timestamp: Date;
  readonly recoverable: boolean;
  readonly metadata?: Record<string, any>;
}

/**
 * Type guards for XPlugin types
 */
export const PluginTypeGuards = {
  isPluginResult: <T>(value: any): value is PluginResult<T> => {
    return value && typeof value === 'object' &&
           typeof value.success === 'boolean' &&
           value.timestamp instanceof Date;
  },

  isPluginEventData: (value: any): value is PluginEventData => {
    return value && typeof value === 'object' &&
           typeof value.eventType === 'string' &&
           typeof value.source === 'string' &&
           value.timestamp instanceof Date;
  },

  isPluginMetrics: (value: any): value is PluginMetrics => {
    return value && typeof value === 'object' &&
           typeof value.metricName === 'string' &&
           typeof value.value === 'number' &&
           typeof value.unit === 'string' &&
           value.timestamp instanceof Date;
  },

  isPluginHealthCheck: (value: any): value is PluginHealthCheck => {
    return value && typeof value === 'object' &&
           typeof value.healthy === 'boolean' &&
           typeof value.status === 'string' &&
           value.lastCheck instanceof Date;
  }
};

/**
 * XPlugin utility types
 */
export type PluginAsyncOperation<T> = Promise<PluginResult<T>>;
export type PluginEventHandler<T = any> = (data: T) => void | Promise<void>;
export type PluginHookHandler<T = any> = (data: T) => void | Promise<void>;
export type PluginFactory<T> = (...args: any[]) => T;
export type PluginValidator<T> = (value: T) => boolean | string;
export type PluginTransformer<T, U> = (input: T) => U;
