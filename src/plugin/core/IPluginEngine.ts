/**
 * @fileoverview Plugin Engine Interface
 *
 * Defines the clear contract for what the core plugin engine provides.
 * This interface serves as the abstraction between the core engine and
 * the context orchestration layer, ensuring clean boundaries and testability.
 */

import { Either } from '@/either';
import { Logger } from '@/logger';
import { Maybe } from '@/maybe';
import { ServiceRegistry } from '@/service';

// Use new refined error system from xplugin
import { PluginError as PluginError } from '../errors/PluginError';
// Use new focused registry from xplugin
import { FocusedPluginRegistry as PluginRegistry } from '../registry/PluginRegistry';
import {
  Plugin,
  PluginConfig,
  PluginLoadInfo
} from '../types/CoreTypes';
import { LifecyclePhase } from '../types/LifecycleTypes';
import { PluginLoader } from '../types/LoaderTypes';

/**
 * Plugin engine state enumeration
 */
export enum PluginEngineState {
  STOPPED = 'stopped',
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  STOPPING = 'stopping'
}

/**
 * Minimal configuration required by the core plugin engine
 */
export interface PluginEngineConfig {
  readonly logger: Logger;
  readonly pluginRegistry: PluginRegistry;
  readonly serviceRegistry: ServiceRegistry;
  readonly pluginLoaders: PluginLoader[];
}

/**
 * Lifecycle hook callback for context integration
 */
export type LifecycleHook = (
  phase: LifecyclePhase,
  pluginId: string,
  plugin?: Plugin,
  error?: Error
) => void;

/**
 * Plugin Engine Interface
 *
 * Defines the contract for the core plugin engine that handles essential
 * plugin lifecycle operations. This interface is consumed by:
 * - PluginManagerContext (orchestration layer)
 * - ApplicationContext (application coordination layer)
 *
 * The core engine is responsible ONLY for:
 * - Plugin loading via configured loaders
 * - Plugin lifecycle management (initialize, start, stop, cleanup)
 * - Basic dependency resolution and ordering
 * - Plugin state tracking
 * - Essential error handling
 *
 * The core engine is NOT responsible for:
 * - Configuration management (delegated to context services)
 * - Metrics collection (delegated to context services)
 * - Event broadcasting (delegated to context services)
 * - Complex dependency analysis (delegated to context services)
 */
export interface IPluginEngine {
  // ==========================================================================
  // STATE MANAGEMENT
  // ==========================================================================
  
  /**
   * Get the current state of the plugin engine
   */
  getState(): PluginEngineState;
  
  // ==========================================================================
  // LIFECYCLE HOOKS
  // ==========================================================================
  
  /**
   * Set lifecycle hook for context integration
   * Allows the context layer to receive notifications about plugin lifecycle events
   */
  setLifecycleHook(hook: LifecycleHook): void;
  
  // ==========================================================================
  // PLUGIN INFORMATION ACCESS
  // ==========================================================================
  
  /**
   * Get loaded plugin information by ID
   */
  getLoadedPlugin(pluginId: string): Maybe<PluginLoadInfo>;
  
  /**
   * Get all loaded plugins
   */
  getAllLoadedPlugins(): ReadonlyMap<string, PluginLoadInfo>;
  
  // ==========================================================================
  // CORE LIFECYCLE OPERATIONS
  // ==========================================================================
  
  /**
   * Initialize the plugin engine with plugin configurations
   *
   * This method:
   * 1. Loads all enabled plugins using configured loaders
   * 2. Resolves dependencies and determines startup order
   * 3. Initializes plugins in dependency order
   *
   * @param pluginConfigs Array of plugin configurations to load and initialize
   * @returns Either success (void) or PluginError
   */
  initialize(pluginConfigs: PluginConfig[]): Promise<Either<PluginError, void>>;
  
  /**
   * Start all initialized plugins
   *
   * Starts plugins in dependency order, allowing individual plugin failures
   * without stopping the entire startup process.
   *
   * @returns Either success (void) or PluginError
   */
  start(): Promise<Either<PluginError, void>>;
  
  /**
   * Stop all running plugins
   *
   * Stops plugins in reverse dependency order (shutdown order).
   * Individual plugin stop failures are logged but don't prevent
   * other plugins from stopping.
   *
   * @returns Either success (void) or PluginError
   */
  stop(): Promise<Either<PluginError, void>>;
  
  /**
   * Cleanup all plugins and reset engine state
   *
   * Performs cleanup on all loaded plugins and resets the engine
   * to its initial state. This is typically called during shutdown
   * or when resetting the engine.
   */
  cleanup(): Promise<void>;
}

/**
 * Plugin Engine Factory Interface
 *
 * Defines how plugin engines should be created. This abstraction
 * allows the context layer to create engines without depending
 * on concrete implementations.
 */
export interface IPluginEngineFactory {
  /**
   * Create a new plugin engine instance
   */
  create(config: PluginEngineConfig): IPluginEngine;
}

/**
 * Plugin Engine Builder Interface
 *
 * Defines a fluent builder for creating plugin engine configurations.
 * This provides a clean way for the context layer to configure
 * the core engine without complex constructor parameters.
 */
export interface IPluginEngineBuilder {
  /**
   * Set the logger for the plugin engine
   */
  withLogger(logger: Logger): IPluginEngineBuilder;
  
  /**
   * Set the plugin registry for the plugin engine
   */
  withPluginRegistry(registry: PluginRegistry): IPluginEngineBuilder;
  
  /**
   * Set the service registry for the plugin engine
   */
  withServiceRegistry(registry: ServiceRegistry): IPluginEngineBuilder;
  
  /**
   * Add a plugin loader to the engine
   */
  addPluginLoader(loader: PluginLoader): IPluginEngineBuilder;
  
  /**
   * Add multiple plugin loaders to the engine
   */
  addPluginLoaders(loaders: PluginLoader[]): IPluginEngineBuilder;
  
  /**
   * Build the plugin engine configuration
   */
  buildConfig(): Either<PluginError, PluginEngineConfig>;
  
  /**
   * Build and create the plugin engine instance
   */
  build(): Either<PluginError, IPluginEngine>;
}

/**
 * Plugin Engine Health Status
 *
 * Defines the health information that can be queried from a plugin engine.
 * This allows the context layer to monitor engine health without
 * depending on internal implementation details.
 */
export interface PluginEngineHealth {
  /** Engine state */
  state: PluginEngineState;
  /** Total number of plugins */
  totalPlugins: number;
  /** Number of successfully loaded plugins */
  loadedPlugins: number;
  /** Number of failed plugins */
  failedPlugins: number;
  /** List of failed plugin IDs */
  failedPluginIds: string[];
  /** Engine uptime in milliseconds */
  uptime: number;
  /** Last operation timestamp */
  lastOperationTime: Date;
}

/**
 * Extended Plugin Engine Interface with Health Monitoring
 *
 * Optional extension interface that provides health monitoring
 * capabilities. The context layer can check if an engine
 * implements this interface to enable health monitoring features.
 */
export interface IPluginEngineWithHealth
  extends IPluginEngine {
  /**
   * Get engine health status
   */
  getHealth(): PluginEngineHealth;
}

/**
 * Plugin Engine Events
 *
 * Defines the event types that can be emitted by the plugin engine
 * through the lifecycle hook. This provides a clear contract for
 * what events the context layer can expect.
 */
export const PluginEngineEvents = {
  /** Engine state changed */
  STATE_CHANGED: 'engine:state-changed',
  /** Plugin loaded */
  PLUGIN_LOADED: 'plugin:loaded',
  /** Plugin initialized */
  PLUGIN_INITIALIZED: 'plugin:initialized',
  /** Plugin started */
  PLUGIN_STARTED: 'plugin:started',
  /** Plugin stopped */
  PLUGIN_STOPPED: 'plugin:stopped',
  /** Plugin cleanup completed */
  PLUGIN_CLEANUP: 'plugin:cleanup',
  /** Plugin operation failed */
  PLUGIN_FAILED: 'plugin:failed',
  /** Engine operation failed */
  ENGINE_FAILED: 'engine:failed'
} as const;

/**
 * Type for plugin engine event names
 */
export type PluginEngineEventName = typeof PluginEngineEvents[keyof typeof PluginEngineEvents];

/**
 * Plugin Engine Statistics
 *
 * Defines statistical information that can be gathered from a plugin engine.
 * This allows the context layer to collect performance metrics without
 * depending on internal implementation details.
 */
export interface PluginEngineStats {
  /** Total initialization time in milliseconds */
  totalInitTime: number;
  /** Total startup time in milliseconds */
  totalStartTime: number;
  /** Average plugin load time in milliseconds */
  averageLoadTime: number;
  /** Average plugin init time in milliseconds */
  averageInitTime: number;
  /** Average plugin start time in milliseconds */
  averageStartTime: number;
  /** Number of successful operations */
  successfulOperations: number;
  /** Number of failed operations */
  failedOperations: number;
  /** Success rate (0-1) */
  successRate: number;
}

/**
 * Extended Plugin Engine Interface with Statistics
 *
 * Optional extension interface that provides statistical information.
 * The context layer can check if an engine implements this interface
 * to enable performance monitoring and metrics collection.
 */
export interface IPluginEngineWithStats
  extends IPluginEngine {
  /**
   * Get engine statistics
   */
  getStats(): PluginEngineStats;
  
  /**
   * Reset statistics counters
   */
  resetStats(): void;
}
