/**
 * @fileoverview Focused Plugin Registry
 *
 * Simplified plugin registry that handles only essential plugin storage,
 * lookup, and basic queries. Complex filtering, metrics, and health checks
 * are delegated to context package services.
 */

import { Either } from '@/either';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Maybe } from '@/maybe';
import { PluginError as PluginError } from '../errors/PluginError';
import {
  Plugin,
  PluginState,
  PluginType
} from '../types/CoreTypes';

/**
 * Basic plugin registry statistics
 */
export interface PluginRegistryStats {
  /** Total number of registered plugins */
  totalPlugins: number;
  /** Number of plugins by state */
  pluginsByState: Record<PluginState, number>;
  /** Number of plugins by type */
  pluginsByType: Record<PluginType, number>;
}

/**
 * Plugin registration result
 */
export interface PluginRegistrationResult {
  /** Whether registration was successful */
  success: boolean;
  /** Plugin that was registered (if successful) */
  plugin?: Plugin;
  /** Error message (if failed) */
  error?: string;
  /** Whether this was a replacement of existing plugin */
  replaced: boolean;
}

/**
 * Focused Plugin Registry
 *
 * Handles ONLY essential plugin storage and lookup operations:
 * - Plugin registration and unregistration
 * - Plugin lookup by ID
 * - Basic queries (all plugins, by state, by type)
 * - Simple validation
 *
 * Does NOT handle:
 * - Complex filtering and search (context services)
 * - Metrics collection and monitoring (context services)
 * - Health checks and status monitoring (context services)
 * - Plugin lifecycle notifications (context services)
 * - Performance tracking (context services)
 * - Plugin dependencies management (handled by dependency resolver)
 */
export class FocusedPluginRegistry {
  private readonly plugins = new Map<string, Plugin>();
  private readonly pluginsByType = new Map<PluginType, Set<string>>();
  private readonly pluginsByState = new Map<PluginState, Set<string>>();
  
  /**
   * Register a plugin in the registry
   */
  public register(plugin: Plugin): Either<PluginError, void> {
    const result = this.registerPlugin(plugin);
    if (Either.isLeft(result)) {
      return Either.left(result.left);
    }
    return Either.right(undefined as void);
  }
  
  /**
   * Register a plugin in the registry (detailed interface)
   */
  private registerPlugin(plugin: Plugin): Either<PluginError, PluginRegistrationResult> {
    // Validate plugin parameter
    if (!plugin) {
      return Either.left(new PluginError(
        UnifiedErrorCode.INVALID_OPERATION,
        'Plugin cannot be null or undefined',
        {
          timestamp: new Date(),
          module: 'PluginRegistry',
          operation: 'register'
        }
      ));
    }
    
    // Validate plugin ID
    if (!plugin.id) {
      return Either.left(new PluginError(
        UnifiedErrorCode.INVALID_OPERATION,
        'Plugin ID is required',
        {
          timestamp: new Date(),
          module: 'PluginRegistry',
          operation: 'register'
        }
      ));
    }
    
    // Check if plugin already exists
    const existingPlugin = this.plugins.get(plugin.id);
    const replaced = existingPlugin !== undefined;
    
    // Remove existing plugin from indexes if replacing
    if (replaced) {
      this.removeFromIndexes(existingPlugin);
    }
    
    try {
      // Store plugin
      this.plugins.set(plugin.id, plugin);
      
      // Update indexes
      this.addToIndexes(plugin);
      
      return Either.right({
        success: true,
        plugin,
        replaced
      } as PluginRegistrationResult);
      
    } catch (error) {
      return Either.left(PluginError.create(
        UnifiedErrorCode.PLUGIN_REGISTRATION_FAILED,
        `Failed to register plugin: ${ error instanceof Error ? error.message : String(error) }`,
        'register',
        { pluginId: plugin.id },
        undefined,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  /**
   * Unregister a plugin from the registry
   */
  public unregister(pluginId: string): Either<PluginError, Plugin | null> {
    if (!pluginId) {
      return Either.left(PluginError.create(
        UnifiedErrorCode.INVALID_OPERATION, // Using INVALID_OPERATION instead of non-existent INVALID_PARAMETER
        'Plugin ID must be a valid string',
        'unregister',
        { pluginId }
      ));
    }
    
    const plugin = this.plugins.get(pluginId);
    
    if (!plugin) {
      // Not an error - plugin might not exist
      return Either.right(null as Plugin | null);
    }
    
    try {
      // Remove from main storage
      this.plugins.delete(pluginId);
      
      // Remove from indexes
      this.removeFromIndexes(plugin);
      
      return Either.right(plugin as Plugin | null);
      
    } catch (error) {
      return Either.left(PluginError.create(
        UnifiedErrorCode.PLUGIN_UNREGISTRATION_FAILED,
        `Failed to unregister plugin: ${ error instanceof Error ? error.message : String(error) }`,
        'unregister',
        { pluginId },
        undefined,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  /**
   * Get a plugin by ID
   */
  public getPlugin(pluginId: string): Maybe<Plugin> {
    if (!pluginId) {
      return Maybe.nothing<Plugin>();
    }
    
    return Maybe.fromNullable(this.plugins.get(pluginId));
  }
  
  /**
   * Check if a plugin is registered
   */
  public hasPlugin(pluginId: string): boolean {
    if (!pluginId) {
      return false;
    }
    
    return this.plugins.has(pluginId);
  }
  
  /**
   * Get all registered plugins
   */
  public getAllPlugins(): ReadonlyMap<string, Plugin> {
    return this.plugins;
  }
  
  /**
   * Get plugins by state
   */
  public getPluginsByState(state: PluginState): Plugin[] {
    const pluginIds = this.pluginsByState.get(state);
    if (!pluginIds) {
      return [];
    }
    
    const plugins: Plugin[] = [];
    for (const pluginId of pluginIds) {
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        plugins.push(plugin);
      }
    }
    
    return plugins;
  }
  
  /**
   * Get plugins by type
   */
  public getPluginsByType(type: PluginType): Plugin[] {
    const pluginIds = this.pluginsByType.get(type);
    if (!pluginIds) {
      return [];
    }
    
    const plugins: Plugin[] = [];
    for (const pluginId of pluginIds) {
      const plugin = this.plugins.get(pluginId);
      if (plugin) {
        plugins.push(plugin);
      }
    }
    
    return plugins;
  }
  
  /**
   * Get all plugin IDs
   */
  public getPluginIds(): string[] {
    return Array.from(this.plugins.keys());
  }
  
  /**
   * Get basic registry statistics
   */
  public getStats(): PluginRegistryStats {
    const stats: PluginRegistryStats = {
      totalPlugins: this.plugins.size,
      pluginsByState: {} as Record<PluginState, number>,
      pluginsByType: {} as Record<PluginType, number>
    };
    
    // Initialize counters
    for (const state of Object.values(PluginState)) {
      stats.pluginsByState[state] = 0;
    }
    
    for (const type of Object.values(PluginType)) {
      stats.pluginsByType[type] = 0;
    }
    
    // Count plugins by state and type
    for (const plugin of this.plugins.values()) {
      stats.pluginsByState[plugin.state]++;
      
      // Get plugin type from metadata or default to User
      const pluginType: PluginType = (plugin.metadata as any)?.type || PluginType.User;
      stats.pluginsByType[pluginType]++;
    }
    
    return stats;
  }
  
  /**
   * Get count of registered plugins
   */
  public size(): number {
    return this.plugins.size;
  }
  
  /**
   * Check if registry is empty
   */
  public isEmpty(): boolean {
    return this.plugins.size === 0;
  }
  
  /**
   * Clear all plugins from registry
   */
  public clear(): void {
    this.plugins.clear();
    this.pluginsByState.clear();
    this.pluginsByType.clear();
  }
  
  /**
   * Update plugin state in indexes (called when plugin state changes)
   */
  public updatePluginState(
    pluginId: string,
    oldState: PluginState,
    newState: PluginState
  ): void {
    // Remove from old state index
    const oldStateSet = this.pluginsByState.get(oldState);
    if (oldStateSet) {
      oldStateSet.delete(pluginId);
      if (oldStateSet.size === 0) {
        this.pluginsByState.delete(oldState);
      }
    }
    
    // Add to new state index
    let newStateSet = this.pluginsByState.get(newState);
    if (!newStateSet) {
      newStateSet = new Set();
      this.pluginsByState.set(newState, newStateSet);
    }
    newStateSet.add(pluginId);
  }
  
  // ==========================================================================
  // PRIVATE IMPLEMENTATION
  // ==========================================================================
  
  /**
   * Add plugin to indexes
   */
  private addToIndexes(plugin: Plugin): void {
    // Add to state index
    let stateSet = this.pluginsByState.get(plugin.state);
    if (!stateSet) {
      stateSet = new Set();
      this.pluginsByState.set(plugin.state, stateSet);
    }
    stateSet.add(plugin.id);
    
    // Add to type index
    const pluginType = (plugin.metadata as any)?.type || PluginType.User;
    let typeSet = this.pluginsByType.get(pluginType);
    if (!typeSet) {
      typeSet = new Set();
      this.pluginsByType.set(pluginType, typeSet);
    }
    typeSet.add(plugin.id);
  }
  
  /**
   * Remove plugin from indexes
   */
  private removeFromIndexes(plugin: Plugin): void {
    // Remove from state index
    const stateSet = this.pluginsByState.get(plugin.state);
    if (stateSet) {
      stateSet.delete(plugin.id);
      if (stateSet.size === 0) {
        this.pluginsByState.delete(plugin.state);
      }
    }
    
    // Remove from type index
    const pluginType = (plugin.metadata as any)?.type || PluginType.User;
    const typeSet = this.pluginsByType.get(pluginType);
    if (typeSet) {
      typeSet.delete(plugin.id);
      if (typeSet.size === 0) {
        this.pluginsByType.delete(pluginType);
      }
    }
  }
}

/**
 * Plugin registry interface for compatibility with existing code
 */
export interface IPluginRegistry {
  /**
   * Register a plugin
   */
  register(plugin: Plugin): Either<PluginError, void>;
  
  /**
   * Get a plugin by ID
   */
  getPlugin(pluginId: string): Maybe<Plugin>;
  
  /**
   * Check if plugin exists
   */
  hasPlugin(pluginId: string): boolean;
  
  /**
   * Get all plugins
   */
  getAllPlugins(): ReadonlyMap<string, Plugin>;
  
  /**
   * Unregister a plugin
   */
  unregister(pluginId: string): Either<PluginError, Plugin | null>;
}

/**
 * Adapter to make FocusedPluginRegistry compatible with existing interfaces
 */
export class PluginRegistryAdapter
  implements IPluginRegistry {
  constructor(private readonly registry: FocusedPluginRegistry) {}
  
  register(plugin: Plugin): Either<PluginError, void> {
    const result = this.registry.register(plugin);
    if (Either.isLeft(result)) {
      return result;
    }
    return Either.right(undefined as void);
  }
  
  getPlugin(pluginId: string): Maybe<Plugin> {
    return this.registry.getPlugin(pluginId);
  }
  
  hasPlugin(pluginId: string): boolean {
    return this.registry.hasPlugin(pluginId);
  }
  
  getAllPlugins(): ReadonlyMap<string, Plugin> {
    return this.registry.getAllPlugins();
  }
  
  unregister(pluginId: string): Either<PluginError, Plugin | null> {
    return this.registry.unregister(pluginId);
  }
}

/**
 * Factory function to create a focused plugin registry
 */
export function createFocusedPluginRegistry(): FocusedPluginRegistry {
  return new FocusedPluginRegistry();
}

/**
 * Factory function to create a compatible plugin registry adapter
 */
export function createPluginRegistry(): IPluginRegistry {
  const registry = new FocusedPluginRegistry();
  return new PluginRegistryAdapter(registry);
}

// Export the main registry class as default
export default FocusedPluginRegistry;
