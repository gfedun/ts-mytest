/**
 * @fileoverview Plugin Engine - Core Plugin Lifecycle Management
 *
 * Focused plugin engine that handles only essential plugin lifecycle operations:
 * load, initialize, start, stop, cleanup. Configuration, metrics, and events
 * are delegated to the context layer.
 */

import { Either } from '@/either';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Logger } from '@/logger';
import { Maybe } from '@/maybe';
import { ServiceRegistry } from '@/service';
import { IPluginEngine } from "./IPluginEngine";
// Use new refined error system
import { PluginError as PluginError } from '../errors/PluginError';
// Use new focused registry from xplugin
import { FocusedPluginRegistry as PluginRegistry } from '../registry/PluginRegistry';
// Updated imports to use new xplugin structure consistently
import {
  Plugin,
  PluginConfig,
  PluginLoadInfo,
  PluginState
} from '../types/CoreTypes';
import { LifecyclePhase } from '../types/LifecycleTypes';
import { PluginLoader } from '../types/LoaderTypes';

/**
 * Core plugin engine state
 */
export enum PluginEngineState {
  STOPPED = 'stopped',
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  STOPPING = 'stopping'
}

/**
 * Minimal configuration for the core plugin engine
 */
export interface PluginEngineConfig {
  readonly logger: Logger;
  readonly pluginRegistry: PluginRegistry;
  readonly serviceRegistry: ServiceRegistry;
  readonly pluginLoaders: PluginLoader[];
}

/**
 * Hook for lifecycle events (simple callback pattern)
 */
export type LifecycleHook = (
  phase: LifecyclePhase,
  pluginId: string,
  plugin?: Plugin,
  error?: Error
) => void;

const LOGGER_NAMESPACE = "[PluginEngine]" as const;

/**
 * Core Plugin Engine - Focused on Essential Plugin Lifecycle Operations
 *
 * Responsibilities:
 * - Plugin loading via configured loaders
 * - Plugin lifecycle management (initialize, start, stop, cleanup)
 * - Basic dependency resolution and ordering
 * - Plugin state tracking
 * - Essential error handling
 *
 * NOT responsible for:
 * - Configuration management (delegated to context services)
 * - Metrics collection (delegated to context services)
 * - Event broadcasting (delegated to context services)
 * - Complex dependency analysis (delegated to context services)
 */
export class PluginEngine
  implements IPluginEngine {
  private readonly logger: Logger;
  private readonly pluginRegistry: PluginRegistry;
  private readonly serviceRegistry: ServiceRegistry;
  private readonly pluginLoaders: PluginLoader[];
  
  // Core engine state
  private state: PluginEngineState = PluginEngineState.STOPPED;
  private loadedPlugins: Map<string, PluginLoadInfo> = new Map();
  private startupOrder: string[] = [];
  
  // Optional lifecycle hook for context integration
  private lifecycleHook?: LifecycleHook;
  
  constructor(config: PluginEngineConfig) {
    this.logger = config.logger;
    this.pluginRegistry = config.pluginRegistry;
    this.serviceRegistry = config.serviceRegistry;
    this.pluginLoaders = config.pluginLoaders;
    
    this.debug('PluginEngine created with core configuration', {
      loadersCount: this.pluginLoaders.length,
      state: this.state
    });
  }
  
  /**
   * Set lifecycle hook for context integration
   */
  public setLifecycleHook(hook: LifecycleHook): void {
    this.lifecycleHook = hook;
  }
  
  /**
   * Get current engine state
   */
  public getState(): PluginEngineState {
    return this.state;
  }
  
  /**
   * Get loaded plugin information
   */
  public getLoadedPlugin(pluginId: string): Maybe<PluginLoadInfo> {
    return Maybe.fromNullable(this.loadedPlugins.get(pluginId));
  }
  
  /**
   * Get all loaded plugins
   */
  public getAllLoadedPlugins(): ReadonlyMap<string, PluginLoadInfo> {
    return this.loadedPlugins;
  }
  
  /**
   * Initialize the plugin engine with plugin configurations
   */
  public async initialize(pluginConfigs: PluginConfig[]): Promise<Either<PluginError, void>> {
    if (this.state !== PluginEngineState.STOPPED) {
      return Either.left(new PluginError(
        UnifiedErrorCode.INVALID_STATE_TRANSITION,
        `Cannot initialize engine from state: ${ this.state }`,
        {
          timestamp: new Date(),
          module: 'PluginEngine',
          operation: 'initialize'
        }
      ));
    }
    
    try {
      this.state = PluginEngineState.INITIALIZING;
      this.notifyLifecycleHook(LifecyclePhase.LOAD, 'engine');
      
      this.info('Initializing PluginEngine', {
        pluginCount: pluginConfigs.length,
        state: this.state
      });
      
      // 1. Load all plugins
      const loadResult = await this.loadPlugins(pluginConfigs);
      if (Either.isLeft(loadResult)) {
        this.state = PluginEngineState.STOPPED;
        return loadResult;
      }
      
      // 2. Resolve dependencies and determine startup order
      const orderResult = this.resolveStartupOrder();
      if (Either.isLeft(orderResult)) {
        this.state = PluginEngineState.STOPPED;
        return Either.left(orderResult.left);
      }
      
      this.startupOrder = orderResult.right;
      
      // 3. Initialize plugins in dependency order
      const initResult = await this.initializePlugins();
      if (Either.isLeft(initResult)) {
        this.state = PluginEngineState.STOPPED;
        return initResult;
      }
      
      this.info('PluginEngine initialization complete', {
        loadedPlugins: this.loadedPlugins.size,
        startupOrder: this.startupOrder.length
      });
      
      return Either.right(undefined as void);
      
    } catch (error) {
      this.state = PluginEngineState.STOPPED;
      const pluginError = PluginError.engineFailed(
        'initialize',
        `Engine initialization failed: ${ error instanceof Error ? error.message : String(error) }`,
        error instanceof Error ? error : undefined
      );
      this.notifyLifecycleHook(LifecyclePhase.LOAD, 'engine', undefined, pluginError);
      return Either.left(pluginError);
    }
  }
  
  /**
   * Start all initialized plugins
   */
  public async start(): Promise<Either<PluginError, void>> {
    if (this.state !== PluginEngineState.INITIALIZING) {
      return Either.left(new PluginError(
        UnifiedErrorCode.INVALID_STATE_TRANSITION,
        `Cannot start engine from state: ${ this.state }`,
        {
          timestamp: new Date(),
          module: 'PluginEngine',
          operation: 'start'
        }
      ));
    }
    
    try {
      this.state = PluginEngineState.RUNNING;
      this.notifyLifecycleHook(LifecyclePhase.START, 'engine');
      
      this.info('Starting PluginEngine', {
        pluginCount: this.startupOrder.length
      });
      
      // Start plugins in dependency order
      for (const pluginId of this.startupOrder) {
        const loadInfo = this.loadedPlugins.get(pluginId);
        if (!loadInfo) {
          continue; // Skip if plugin not loaded
        }
        
        const startResult = await loadInfo.plugin.start(this.serviceRegistry);
        if (Either.isLeft(startResult)) {
          this.error(`Failed to start plugin: ${ pluginId }`, {
            error: startResult.left.message
          });
          this.notifyLifecycleHook(LifecyclePhase.START, pluginId, loadInfo.plugin, startResult.left);
          // Continue with other plugins - don't fail entire startup
          continue;
        }
        
        this.debug(`Plugin started successfully: ${ pluginId }`);
        this.notifyLifecycleHook(LifecyclePhase.START, pluginId, loadInfo.plugin);
      }
      
      this.info('PluginEngine startup complete');
      return Either.right(undefined as void);
      
    } catch (error) {
      const pluginError = PluginError.engineFailed(
        'start',
        `Engine startup failed: ${ error instanceof Error ? error.message : String(error) }`,
        error instanceof Error ? error : undefined
      );
      this.notifyLifecycleHook(LifecyclePhase.START, 'engine', undefined, pluginError);
      return Either.left(pluginError);
    }
  }
  
  /**
   * Stop all running plugins
   */
  public async stop(): Promise<Either<PluginError, void>> {
    if (this.state !== PluginEngineState.RUNNING) {
      return Either.left(new PluginError(
        UnifiedErrorCode.INVALID_STATE_TRANSITION,
        `Cannot stop engine from state: ${ this.state }`,
        {
          timestamp: new Date(),
          module: 'PluginEngine',
          operation: 'stop'
        }
      ));
    }
    
    try {
      this.state = PluginEngineState.STOPPING;
      this.notifyLifecycleHook(LifecyclePhase.STOP, 'engine');
      
      this.info('Stopping PluginEngine');
      
      // Stop plugins in reverse startup order
      const shutdownOrder = [...this.startupOrder].reverse();
      
      for (const pluginId of shutdownOrder) {
        const loadInfo = this.loadedPlugins.get(pluginId);
        if (!loadInfo) {
          continue;
        }
        
        if (loadInfo.plugin.state === PluginState.Active) {
          const stopResult = await loadInfo.plugin.stop();
          if (Either.isLeft(stopResult)) {
            this.error(`Failed to stop plugin: ${ pluginId }`, {
              error: stopResult.left.message
            });
            this.notifyLifecycleHook(LifecyclePhase.STOP, pluginId, loadInfo.plugin, stopResult.left);
          } else {
            this.debug(`Plugin stopped successfully: ${ pluginId }`);
            this.notifyLifecycleHook(LifecyclePhase.STOP, pluginId, loadInfo.plugin);
          }
        }
      }
      
      this.state = PluginEngineState.STOPPED;
      this.info('PluginEngine shutdown complete');
      
      return Either.right(undefined as void);
      
    } catch (error) {
      this.state = PluginEngineState.STOPPED;
      const pluginError = PluginError.engineFailed(
        'stop',
        `Engine shutdown failed: ${ error instanceof Error ? error.message : String(error) }`,
        error instanceof Error ? error : undefined
      );
      this.notifyLifecycleHook(LifecyclePhase.STOP, 'engine', undefined, pluginError);
      return Either.left(pluginError);
    }
  }
  
  /**
   * Cleanup all plugins and reset engine state
   */
  public async cleanup(): Promise<void> {
    this.info('Cleaning up PluginEngine');
    
    // Cleanup all loaded plugins
    for (const [pluginId, loadInfo] of this.loadedPlugins) {
      try {
        await loadInfo.plugin.cleanup();
        this.debug(`Plugin cleaned up: ${ pluginId }`);
        this.notifyLifecycleHook(LifecyclePhase.CLEANUP, pluginId, loadInfo.plugin);
      } catch (error) {
        this.error(`Plugin cleanup failed: ${ pluginId }`, { error });
        this.notifyLifecycleHook(
          LifecyclePhase.CLEANUP,
          pluginId,
          loadInfo.plugin,
          error instanceof Error ? error : new Error(String(error))
        );
      }
    }
    
    // Reset engine state
    this.loadedPlugins.clear();
    this.startupOrder = [];
    this.state = PluginEngineState.STOPPED;
    
    this.info('PluginEngine cleanup complete');
  }
  
  // ==========================================================================
  // PRIVATE IMPLEMENTATION
  // ==========================================================================
  
  /**
   * Load all plugins using configured loaders
   */
  private async loadPlugins(pluginConfigs: PluginConfig[]): Promise<Either<PluginError, void>> {
    for (const config of pluginConfigs) {
      if (!config.enabled) {
        this.debug(`Skipping disabled plugin: ${ config.id }`);
        continue;
      }
      
      // Find appropriate loader
      const loader = this.pluginLoaders.find(l => l.canLoad(config.id, config));
      if (!loader) {
        return Either.left(PluginError.loadFailed(
          config.id,
          `No loader found for plugin: ${ config.id }`
        ));
      }
      
      // Load plugin
      const pluginResult = await loader.loadPlugin(config.id, config);
      if (Either.isLeft(pluginResult)) {
        return Either.left(PluginError.loadFailed(
          config.id,
          `Failed to load plugin ${ config.id }: ${ pluginResult.left.message }`,
          pluginResult.left
        ));
      }
      
      const plugin = pluginResult.right;
      
      // Register plugin
      const registrationResult = this.pluginRegistry.register(plugin);
      if (Either.isLeft(registrationResult)) {
        return Either.left(PluginError.registrationFailed(
          config.id,
          `Failed to register plugin: ${ registrationResult.left.message }`,
          registrationResult.left
        ));
      }
      
      // Store load information
      this.loadedPlugins.set(config.id, {
        config,
        plugin,
        dependencies: [...(config.dependencies || [])]
      });
      
      this.debug(`Plugin loaded successfully: ${ config.id }`);
      this.notifyLifecycleHook(LifecyclePhase.LOAD, config.id, plugin);
    }
    
    return Either.right(undefined as void);
  }
  
  /**
   * Initialize all loaded plugins in dependency order
   */
  private async initializePlugins(): Promise<Either<PluginError, void>> {
    for (const pluginId of this.startupOrder) {
      const loadInfo = this.loadedPlugins.get(pluginId);
      if (!loadInfo) {
        continue;
      }
      
      // Create plugin lookup for dependency injection
      const pluginLookup = {
        getPlugin: (id: string) => {
          return this.pluginRegistry.getPlugin(id);
        }
      };
      
      const initResult = await loadInfo.plugin.initialize(
        loadInfo.config.config || {},
        pluginLookup
      );
      
      if (Either.isLeft(initResult)) {
        this.error(`Failed to initialize plugin: ${ pluginId }`, {
          error: initResult.left.message
        });
        this.notifyLifecycleHook(LifecyclePhase.INITIALIZE, pluginId, loadInfo.plugin, initResult.left);
        return initResult;
      }
      
      this.debug(`Plugin initialized successfully: ${ pluginId }`);
      this.notifyLifecycleHook(LifecyclePhase.INITIALIZE, pluginId, loadInfo.plugin);
    }
    
    return Either.right(undefined as void);
  }
  
  /**
   * Resolve plugin startup order based on dependencies (simple topological sort)
   */
  private resolveStartupOrder(): Either<PluginError, string[]> {
    const plugins = Array.from(this.loadedPlugins.keys());
    const resolved: string[] = [];
    const visiting = new Set<string>();
    const visited = new Set<string>();
    
    const visit = (pluginId: string): boolean => {
      if (visited.has(pluginId)) {
        return true;
      }
      
      if (visiting.has(pluginId)) {
        // Circular dependency detected
        return false;
      }
      
      visiting.add(pluginId);
      
      const loadInfo = this.loadedPlugins.get(pluginId);
      if (loadInfo) {
        // Visit dependencies first
        for (const depId of loadInfo.dependencies) {
          if (this.loadedPlugins.has(depId) && !visit(depId)) {
            return false;
          }
        }
      }
      
      visiting.delete(pluginId);
      visited.add(pluginId);
      resolved.push(pluginId);
      
      return true;
    };
    
    // Visit all plugins
    for (const pluginId of plugins) {
      if (!visited.has(pluginId)) {
        if (!visit(pluginId)) {
          return Either.left(PluginError.dependencyFailed(
            pluginId,
            'circular',
            [pluginId],
            { operation: 'resolve-dependencies' }
          ));
        }
      }
    }
    
    return Either.right(resolved);
  }
  
  /**
   * Notify lifecycle hook if configured
   */
  private notifyLifecycleHook(
    phase: LifecyclePhase,
    pluginId: string,
    plugin?: Plugin,
    error?: Error
  ): void {
    if (this.lifecycleHook) {
      try {
        this.lifecycleHook(phase, pluginId, plugin, error);
      } catch (hookError) {
        this.error('Lifecycle hook failed', { hookError, phase, pluginId });
      }
    }
  }
  
  // ==========================================================================
  // LOGGING HELPERS
  // ==========================================================================
  
  private info(
    message: string,
    metadata?: Record<string, any>
  ): void {
    this.logger.info(`${ LOGGER_NAMESPACE } ${ message }`, metadata);
  }
  
  private debug(
    message: string,
    metadata?: Record<string, any>
  ): void {
    this.logger.debug(`${ LOGGER_NAMESPACE } ${ message }`, metadata);
  }
  
  private error(
    message: string,
    metadata?: Record<string, any>
  ): void {
    this.logger.error(`${ LOGGER_NAMESPACE } ${ message }`, metadata);
  }
}
