/**
 * @fileoverview Loader Types
 *
 * Types related to plugin loading mechanisms, plugin loaders,
 * and plugin source management. Used by the core engine for
 * loading plugins from various sources.
 */

import { Either } from '@/either';
import { Plugin, PluginConfig } from './CoreTypes';

// Forward declaration for PluginError to avoid circular dependencies
type PluginError = any;

/**
 * Plugin loader interface for loading plugins from various sources
 */
export interface PluginLoader {
  /** Loader identifier */
  readonly name: string;
  
  /**
   * Check if loader can handle the plugin
   */
  canLoad(pluginId: string, config: PluginConfig): boolean;
  
  /**
   * Load a plugin instance
   */
  loadPlugin(
    pluginId: string,
    config: PluginConfig
  ): Promise<Either<PluginError, Plugin>>;
}

/**
 * Plugin configuration source interface
 */
export interface PluginConfigSource {
  /** Source identifier */
  readonly name: string;
  
  /**
   * Load plugin configurations from this source
   */
  loadConfigurations(): Promise<Either<PluginError, PluginConfig[]>>;
}

/**
 * Combined plugin loader and configuration source
 */
export interface PluginSourceLoader extends PluginLoader, PluginConfigSource {
}

/**
 * Plugin loading strategies
 */
export enum LoadingStrategy {
  /** Load from file system */
  FILESYSTEM = 'filesystem',
  /** Load from memory/runtime */
  RUNTIME = 'runtime',
  /** Load from module system */
  MODULE = 'module',
  /** Load from factory function */
  FACTORY = 'factory'
}

/**
 * Plugin loading options
 */
export interface LoadingOptions {
  /** Loading strategy to use */
  strategy?: LoadingStrategy;
  /** Whether to cache loaded plugins */
  cache?: boolean;
  /** Timeout for loading operations in milliseconds */
  timeout?: number;
  /** Whether to validate plugin after loading */
  validate?: boolean;
  /** Additional loader-specific options */
  loaderOptions?: Record<string, any>;
}

/**
 * Plugin loading result with metadata
 */
export interface LoadingResult {
  /** Loaded plugin instance */
  plugin: Plugin;
  /** Loading strategy used */
  strategy: LoadingStrategy;
  /** Loader that handled the loading */
  loaderName: string;
  /** Loading duration in milliseconds */
  duration: number;
  /** Whether plugin was loaded from cache */
  fromCache: boolean;
  /** Additional loading metadata */
  metadata?: Record<string, any>;
}

/**
 * Plugin validation result
 */
export interface PluginValidationResult {
  /** Whether plugin is valid */
  isValid: boolean;
  /** Validation errors if any */
  errors: string[];
  /** Validation warnings if any */
  warnings: string[];
  /** Validation metadata */
  metadata?: Record<string, any>;
}
