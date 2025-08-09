/**
 * @fileoverview XPlugin Package - Main Entry Point
 *
 * This file serves as the main entry point for the xplugin package,
 * providing a comprehensive and organized export interface for all
 * xplugin functionality.
 */

// ============================================================================
// CORE ENGINE EXPORTS
// ============================================================================

// Core interfaces and implementations
export { IPluginEngine } from './core/IPluginEngine';
export { PluginEngine } from './core/PluginEngine';

// Engine builder pattern
export {
  PluginEngineBuilder,
  createPluginEngineBuilder,
  type PluginEngineBuilderConfig
} from './builder/PluginEngineBuilder';

// ============================================================================
// INTEGRATION EXPORTS
// ============================================================================

// Service hooks integration
export {
  ServiceHooks,
  createServiceHooks,
  type LifecycleHookData,
  type LoadingHookData,
  type DependencyHookData,
  type ConfigurationHookData,
  type RegistryHookData,
  type ErrorHookData,
  type MetricsHookData,
  HookPriority
} from './integration/ServiceHooks';

// Context bridge integration
export {
  ContextBridge,
  createContextBridge,
  type ContextBridgeConfig,
  type EventEmitter,
  type MetricsCollector,
  type ConfigurationInjector
} from './integration/ContextBridge';

// ============================================================================
// TYPE SYSTEM EXPORTS
// ============================================================================

// Re-export all consolidated types
export * from './types';

// Individual type modules (for specific imports if needed)
export * from './types/CoreTypes';
export * from './types/ConfigTypes';
export * from './types/LifecycleTypes';
export * from './types/LoaderTypes';

// ============================================================================
// ERROR HANDLING EXPORTS
// ============================================================================

// Error types and utilities
export * from './errors/PluginError';

// ============================================================================
// SELECTIVE EXPORTS FOR AVAILABLE MODULES
// ============================================================================

// Only export modules that exist - others can be added when implemented

// Registry exports (if FocusedPluginRegistry exists)
try {
  // This will be a conditional export when the module exists
  // export * from './registry/FocusedPluginRegistry';
} catch {
  // Module not available yet
}

// ============================================================================
// PACKAGE INFORMATION
// ============================================================================

/**
 * XPlugin package metadata
 */
export const XPluginPackageInfo = {
  name: 'xplugin',
  version: '1.0.0',
  description: 'Enhanced plugin architecture for TypeScript applications',
  author: 'Plugin Architecture Team'
} as const;

// ============================================================================
// CONVENIENCE FACTORIES AND UTILITIES
// ============================================================================

// Import required types and functions at the top level
import {
  createPluginEngineBuilder,
  type PluginEngineBuilderConfig
} from './builder/PluginEngineBuilder';
import {
  type ContextBridgeConfig,
  createContextBridge
} from './integration/ContextBridge';
import { createServiceHooks } from './integration/ServiceHooks';

/**
 * Create a complete plugin engine with default configuration
 */
export function createDefaultPluginEngine(config?: Partial<PluginEngineBuilderConfig>) {
  return createPluginEngineBuilder()
    .fromConfig(config || {})
    .withDefaults()
    .build();
}

/**
 * Create plugin engine with service hooks integration
 */
export function createPluginEngineWithServiceHooks(
  config?: Partial<PluginEngineBuilderConfig>
) {
  return createPluginEngineBuilder()
    .fromConfig({
      ...config,
      serviceHooksEnabled: true,
      contextBridgeEnabled: true
    })
    .withDefaults()
    .build();
}

/**
 * Create context bridge with default event handlers
 */
export function createDefaultContextBridge(logger: any) {
  return createContextBridge({
    logger,
    eventEmitter: (event: any) => {
      logger.debug('ContextBridge event emitted', { event });
    },
    metricsCollector: (metrics: any) => {
      logger.debug('ContextBridge metrics collected', { metrics });
    },
    configurationInjector: async (pluginId: string) => {
      logger.debug('ContextBridge configuration injected', { pluginId });
      return {};
    }
  });
}

/**
 * Create service hooks with default handlers
 */
export function createDefaultServiceHooks(logger: any) {
  const hooks = createServiceHooks(logger);
  
  // Enable all hooks by default
  hooks.enable();
  
  return hooks;
}

// ============================================================================
// VERSION AND COMPATIBILITY
// ============================================================================

/**
 * Current XPlugin API version
 */
export const XPLUGIN_API_VERSION = '1.0.0' as const;

/**
 * Supported plugin engine versions
 */
export const SUPPORTED_ENGINE_VERSIONS = ['1.0.0'] as const;

/**
 * Check if a plugin engine version is supported
 */
export function isEngineVersionSupported(version: string): boolean {
  return SUPPORTED_ENGINE_VERSIONS.includes(version as any);
}

/**
 * Get XPlugin package runtime information
 */
export function getXPluginInfo() {
  return {
    ...XPluginPackageInfo,
    apiVersion: XPLUGIN_API_VERSION,
    supportedEngineVersions: SUPPORTED_ENGINE_VERSIONS,
    timestamp: new Date(),
    runtime: {
      nodeVersion: typeof process !== 'undefined' ? process.version : 'unknown',
      platform: typeof process !== 'undefined' ? process.platform : 'unknown'
    }
  };
}

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

/**
 * Default export providing core XPlugin functionality
 */
export default {
  // Core
  createDefaultPluginEngine,
  createPluginEngineWithServiceHooks,
  
  // Integration
  createDefaultContextBridge,
  createDefaultServiceHooks,
  
  // Package Info
  ...XPluginPackageInfo,
  XPLUGIN_API_VERSION,
  getXPluginInfo,
  isEngineVersionSupported
} as const;
