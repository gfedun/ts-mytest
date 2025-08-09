/**
 * @fileoverview Core Plugin Types
 *
 * Essential types for the core plugin engine - interfaces and types that
 * define the fundamental plugin contracts and basic operations.
 */

import { Either } from '@/either';
import { Maybe } from '@/maybe';
import { ServiceRegistry } from '@/service';
import { PluginError } from "@/plugin/errors/PluginError";

/**
 * Plugin metadata describing a plugin's properties
 */
export interface PluginMetadata {
  /** Unique plugin identifier */
  readonly id: string;
  /** Human-readable plugin name */
  readonly name: string;
  /** Plugin version */
  readonly version?: string;
  /** Plugin description */
  readonly description?: string;
  /** Plugin author/vendor */
  readonly author?: string;
  /** Required dependencies (other plugin IDs) */
  readonly dependencies?: readonly string[];
  readonly configSchema?: Record<string, any>;
}

/**
 * Plugin lifecycle states
 */
export enum PluginState {
  /** Plugin is registered but not loaded */
  Registered = 'registered',
  /** Plugin is loaded and ready for initialization */
  Loaded = 'loaded',
  /** Plugin is initialized and active */
  Active = 'active',
  /** Plugin is suspended and inactive */
  Suspended = 'suspended',
  /** Plugin has failed to load or initialize */
  Failed = 'failed',
  /** Plugin is unloaded and removed */
  Unloaded = 'unloaded'
}

/**
 * Simple plugin health interface for plugin implementations
 */
export interface PluginHealth {
  /** Health status indicator */
  status: 'healthy' | 'unhealthy';
  /** Additional health details */
  details?: Record<string, any> | undefined;
  /** Timestamp of health check */
  timestamp: Date;
  /** Whether the plugin is considered healthy */
  healthy: boolean;
}

/**
 * Plugin lookup interface for dependency injection
 */
export interface PluginLookup {
  /**
   * Get a plugin by ID
   */
  getPlugin(id: string): Maybe<Plugin>;
}

/**
 * Core plugin interface - defines the contract all plugins must implement
 */
export interface Plugin {
  readonly id: string;
  readonly state: PluginState;
  readonly metadata: PluginMetadata;
  
  initialize(
    config: Record<string, any>,
    pluginLookup: PluginLookup
  ): Promise<Either<PluginError, void>>;
  
  start(
    serviceRegistry: ServiceRegistry,
    services?: any
  ): Promise<Either<PluginError, void>>;
  
  stop(): Promise<Either<PluginError, void>>;
  
  cleanup(): Promise<void>;
  
  getHealth(): Promise<PluginHealth>;
}

/**
 * Plugin types defining load order and categorization
 */
export enum PluginType {
  /** System plugins - loaded first, highest priority */
  System = 'system',
  /** Library plugins - loaded second, medium priority */
  Library = 'library',
  /** User plugins - loaded last, lowest priority */
  User = 'user'
}

/**
 * Plugin load information container for core engine
 */
export interface PluginLoadInfo {
  /** Original plugin configuration from external source */
  readonly config: PluginConfig;
  /** Loaded plugin instance */
  readonly plugin: Plugin;
  /** Merged dependencies from both config and plugin metadata */
  readonly dependencies: string[];
}

/**
 * Core plugin configuration (minimal for engine)
 */
export interface PluginConfig {
  /** Plugin identifier */
  readonly id: string;
  /** Plugin comments */
  readonly comments?: string;
  /** Whether plugin is enabled */
  readonly enabled?: boolean;
  /** Plugin-specific configuration */
  readonly config?: Record<string, any>;
  /** Plugin type determining load order */
  readonly type?: PluginType;
  /** Load priority (higher = earlier) */
  readonly priority?: number;
  /** Required dependencies (other plugin IDs) */
  readonly dependencies?: readonly string[];
}
