/**
 * @fileoverview Unified Plugin Loader Interface
 *
 * Consolidated plugin loader interface that replaces the complex inheritance
 * hierarchy of 7 different loaders with a clean, focused contract.
 */

import { Either } from '@/either';
import {
  Plugin,
  PluginConfig
} from '../types/CoreTypes';
import {
  LoadingOptions,
  LoadingResult,
  PluginLoader
} from '../types/LoaderTypes';

// Re-export the core interface for convenience
export { PluginLoader } from '../types/LoaderTypes';

/**
 * Plugin factory function type for creating plugin instances
 */
export type PluginFactory = () => Plugin | Promise<Plugin>;

/**
 * Plugin class constructor type
 */
export type PluginConstructor = new (...args: any[]) => Plugin;

/**
 * Plugin source types supported by loaders
 */
export type PluginSource = Plugin | PluginFactory | PluginConstructor;

/**
 * Base plugin loader implementation with common functionality
 */
export abstract class BasePluginLoader
  implements PluginLoader {
  public abstract readonly name: string;
  
  /**
   * Check if this loader can handle the specified plugin
   */
  public abstract canLoad(
    pluginId: string,
    config: PluginConfig
  ): boolean;
  
  /**
   * Load a plugin instance
   */
  public abstract loadPlugin(
    pluginId: string,
    config: PluginConfig
  ): Promise<Either<any, Plugin>>;
  
  /**
   * Validate that an object is a valid plugin instance
   */
  protected validatePlugin(
    plugin: any,
    pluginId: string
  ): plugin is Plugin {
    if (!plugin || typeof plugin !== 'object') {
      return false;
    }
    
    // Check for required properties
    const requiredProps = ['id', 'state', 'metadata'];
    for (const prop of requiredProps) {
      if (!(prop in plugin)) {
        return false;
      }
    }
    
    // Check for required methods
    const requiredMethods = ['initialize', 'start', 'stop', 'cleanup', 'getHealth'];
    for (const method of requiredMethods) {
      if (typeof plugin[method] !== 'function') {
        return false;
      }
    }
    
    // Validate plugin ID matches expected ID
    if (plugin.id !== pluginId) {
      return false;
    }
    
    return true;
  }
  
  /**
   * Create a plugin instance from various source types
   */
  protected async createPluginInstance(
    source: PluginSource,
    pluginId: string
  ): Promise<Either<Error, Plugin>> {
    try {
      let plugin: Plugin;
      
      if (typeof source === 'function') {
        // Handle constructor or factory function
        if (source.prototype && source.prototype.constructor === source) {
          // Constructor function
          plugin = new (source as PluginConstructor)();
        } else {
          // Factory function
          const result = (source as PluginFactory)();
          plugin = result instanceof Promise ? await result : result;
        }
      } else {
        // Direct plugin instance
        plugin = source as Plugin;
      }
      
      // Validate the created plugin
      if (!this.validatePlugin(plugin, pluginId)) {
        return Either.left(new Error(`Invalid plugin structure for: ${ pluginId }`));
      }
      
      return Either.right(plugin);
      
    } catch (error) {
      return Either.left(
        error instanceof Error
          ? error
          : new Error(`Failed to create plugin instance: ${ String(error) }`)
      );
    }
  }
  
  /**
   * Load plugin with timing and metadata
   */
  protected async loadWithMetadata(
    pluginId: string,
    config: PluginConfig,
    loadFn: () => Promise<Either<any, Plugin>>,
    options?: LoadingOptions
  ): Promise<Either<any, LoadingResult>> {
    const startTime = Date.now();
    
    try {
      const result = await loadFn();
      
      if (Either.isLeft(result)) {
        return Either.left(result.left);
      }
      
      const duration = Date.now() - startTime;
      const loadingResult: LoadingResult = {
        plugin: result.right,
        strategy: options?.strategy || 'runtime' as any,
        loaderName: this.name,
        duration,
        fromCache: false, // Base implementation doesn't use cache
        metadata: {
          pluginId,
          loadTime: new Date(),
          ...options?.loaderOptions
        }
      };
      
      return Either.right(loadingResult);
      
    } catch (error) {
      return Either.left(
        error instanceof Error
          ? error
          : new Error(`Plugin loading failed: ${ String(error) }`)
      );
    }
  }
}
