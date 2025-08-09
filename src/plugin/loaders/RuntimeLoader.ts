/**
 * @fileoverview Runtime Plugin Loader
 *
 * Consolidated runtime/in-memory plugin loader that handles loading plugins
 * from memory using various strategies (instances, factories, constructors).
 * Replaces InMemoryPluginInstanceLoader, InMemoryPluginFactoryLoader,
 * and provides runtime plugin registration capabilities.
 */

import { Either } from '@/either';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { PluginError as PluginError } from '../errors/PluginError';
import {
  Plugin,
  PluginConfig
} from '../types/CoreTypes';
import {
  BasePluginLoader,
  PluginConstructor,
  PluginFactory,
  PluginSource
} from './PluginLoader';

/**
 * Runtime plugin registration entry
 */
interface PluginRegistration {
  source: PluginSource;
  type: 'instance' | 'factory' | 'constructor';
  metadata?: Record<string, any>;
  registeredAt: Date;
}

/**
 * Runtime plugin loading configuration
 */
export interface RuntimeLoaderConfig {
  /** Whether to enable plugin validation on registration */
  validateOnRegistration: boolean;
  /** Whether to cache created instances */
  enableInstanceCache: boolean;
  /** Maximum number of cached instances */
  maxCacheSize: number;
}

/**
 * Consolidated Runtime Plugin Loader
 *
 * Handles loading plugins from memory using multiple strategies:
 * - Direct plugin instances
 * - Factory functions that create plugins
 * - Constructor functions for plugin classes
 *
 * Provides runtime registration and management of plugin sources.
 */
export class RuntimeLoader
  extends BasePluginLoader {
  public readonly name = 'RuntimeLoader';
  
  private readonly config: RuntimeLoaderConfig;
  private readonly registeredPlugins = new Map<string, PluginRegistration>();
  private readonly instanceCache = new Map<string, Plugin>();
  
  constructor(config: Partial<RuntimeLoaderConfig> = {}) {
    super();
    
    this.config = {
      validateOnRegistration: config.validateOnRegistration !== undefined ? config.validateOnRegistration : true,
      enableInstanceCache: config.enableInstanceCache !== undefined ? config.enableInstanceCache : true,
      maxCacheSize: config.maxCacheSize || 100
    };
  }
  
  /**
   * Check if this loader can handle the plugin
   */
  public canLoad(
    pluginId: string,
    config: PluginConfig
  ): boolean {
    return this.registeredPlugins.has(pluginId);
  }
  
  /**
   * Load a plugin from runtime registration
   */
  public async loadPlugin(
    pluginId: string,
    config: PluginConfig
  ): Promise<Either<PluginError, Plugin>> {
    const registration = this.registeredPlugins.get(pluginId);
    
    if (!registration) {
      return Either.left(PluginError.create(
        UnifiedErrorCode.PLUGIN_NOT_FOUND,
        `Plugin not registered in runtime: ${ pluginId }`,
        'loadPlugin',
        { pluginId }
      ));
    }
    
    try {
      // Check cache first
      if (this.config.enableInstanceCache && this.instanceCache.has(pluginId)) {
        const cachedPlugin = this.instanceCache.get(pluginId)!;
        return Either.right(cachedPlugin);
      }
      
      // Create plugin instance based on registration type
      const instanceResult = await this.createPluginFromRegistration(pluginId, registration);
      
      if (Either.isLeft(instanceResult)) {
        return Either.left(PluginError.create(
          UnifiedErrorCode.PLUGIN_INITIALIZATION_FAILED,
          `Failed to create plugin instance: ${ instanceResult.left.message }`,
          'loadPlugin',
          { pluginId },
          undefined,
          instanceResult.left
        ));
      }
      
      const plugin = instanceResult.right;
      
      // Cache the instance if enabled
      if (this.config.enableInstanceCache) {
        this.cacheInstance(pluginId, plugin);
      }
      
      return Either.right(plugin);
      
    } catch (error) {
      return Either.left(PluginError.create(
        UnifiedErrorCode.PLUGIN_LOAD_FAILED,
        `Runtime plugin loading failed: ${ error instanceof Error ? error.message : String(error) }`,
        'loadPlugin',
        { pluginId },
        undefined,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  /**
   * Register a plugin instance directly
   */
  public registerInstance(
    pluginId: string,
    plugin: Plugin,
    metadata?: Record<string, any>
  ): Either<PluginError, void> {
    // Validate plugin if configured
    if (this.config.validateOnRegistration && !this.validatePlugin(plugin, pluginId)) {
      return Either.left(PluginError.create(
        UnifiedErrorCode.INVALID_PLUGIN_FORMAT,
        `Invalid plugin instance structure for: ${ pluginId }`,
        'registerInstance',
        { pluginId }
      ));
    }
    
    const registration: PluginRegistration = {
      source: plugin,
      type: 'instance',
      metadata: metadata || {},
      registeredAt: new Date()
    };
    
    this.registeredPlugins.set(pluginId, registration);
    
    return Either.right(undefined as void);
  }
  
  /**
   * Register a plugin factory function
   */
  public registerFactory(
    pluginId: string,
    factory: PluginFactory,
    metadata?: Record<string, any>
  ): Either<PluginError, void> {
    if (typeof factory !== 'function') {
      return Either.left(PluginError.create(
        UnifiedErrorCode.INVALID_PLUGIN_FORMAT,
        `Plugin factory must be a function for: ${ pluginId }`,
        'registerFactory',
        { pluginId }
      ));
    }
    
    const registration: PluginRegistration = {
      source: factory,
      type: 'factory',
      metadata: metadata || {},
      registeredAt: new Date()
    };
    
    this.registeredPlugins.set(pluginId, registration);
    
    return Either.right(undefined as void);
  }
  
  /**
   * Register a plugin constructor
   */
  public registerConstructor(
    pluginId: string,
    constructor: PluginConstructor,
    metadata?: Record<string, any>
  ): Either<PluginError, void> {
    if (typeof constructor !== 'function' || !constructor.prototype) {
      return Either.left(PluginError.create(
        UnifiedErrorCode.INVALID_PLUGIN_FORMAT,
        `Plugin constructor must be a constructor function for: ${ pluginId }`,
        'registerConstructor',
        { pluginId }
      ));
    }
    
    const registration: PluginRegistration = {
      source: constructor,
      type: 'constructor',
      metadata: metadata || {},
      registeredAt: new Date()
    };
    
    this.registeredPlugins.set(pluginId, registration);
    
    return Either.right(undefined as void);
  }
  
  /**
   * Register multiple plugins from a map
   */
  public registerBatch(
    plugins: Map<string, PluginSource>,
    metadata?: Record<string, any>
  ): Either<PluginError, void> {
    const errors: string[] = [];
    
    for (const [pluginId, source] of plugins) {
      let result: Either<PluginError, void>;
      
      if (typeof source === 'function') {
        // Determine if it's a constructor or factory
        if (source.prototype && source.prototype.constructor === source) {
          result = this.registerConstructor(pluginId, source as PluginConstructor, metadata);
        } else {
          result = this.registerFactory(pluginId, source as PluginFactory, metadata);
        }
      } else {
        result = this.registerInstance(pluginId, source as Plugin, metadata);
      }
      
      if (Either.isLeft(result)) {
        errors.push(`${ pluginId }: ${ result.left.message }`);
      }
    }
    
    if (errors.length > 0) {
      return Either.left(PluginError.create(
        UnifiedErrorCode.PLUGIN_REGISTRATION_FAILED,
        `Batch registration failed for plugins: ${ errors.join(', ') }`,
        'registerBatch',
        { pluginId: 'batch-operation' }
      ));
    }
    
    return Either.right(undefined as void);
  }
  
  /**
   * Unregister a plugin
   */
  public unregister(pluginId: string): boolean {
    const wasRegistered = this.registeredPlugins.has(pluginId);
    
    if (wasRegistered) {
      this.registeredPlugins.delete(pluginId);
      this.instanceCache.delete(pluginId);
    }
    
    return wasRegistered;
  }
  
  /**
   * Get registration information
   */
  public getRegistration(pluginId: string): PluginRegistration | undefined {
    return this.registeredPlugins.get(pluginId);
  }
  
  /**
   * List all registered plugin IDs
   */
  public getRegisteredPlugins(): string[] {
    return Array.from(this.registeredPlugins.keys());
  }
  
  /**
   * Get registration statistics
   */
  public getStats(): {
    totalRegistered: number;
    byType: Record<string, number>;
    cachedInstances: number;
    oldestRegistration?: Date;
    newestRegistration?: Date;
  } {
    const registrations = Array.from(this.registeredPlugins.values());
    const byType = registrations.reduce((
      acc,
      reg
    ) => {
      acc[reg.type] = (acc[reg.type] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const dates = registrations.map(r => r.registeredAt);
    const oldestDate = dates.length > 0 ? new Date(Math.min(...dates.map(d => d.getTime()))) : undefined;
    const newestDate = dates.length > 0 ? new Date(Math.max(...dates.map(d => d.getTime()))) : undefined;
    
    return {
      totalRegistered: this.registeredPlugins.size,
      byType,
      cachedInstances: this.instanceCache.size,
      ...(oldestDate && { oldestRegistration: oldestDate }),
      ...(newestDate && { newestRegistration: newestDate })
    };
  }
  
  /**
   * Clear all registrations
   */
  public clear(): void {
    this.registeredPlugins.clear();
    this.instanceCache.clear();
  }
  
  /**
   * Clear instance cache
   */
  public clearCache(): void {
    this.instanceCache.clear();
  }
  
  // ==========================================================================
  // PRIVATE IMPLEMENTATION
  // ==========================================================================
  
  /**
   * Create plugin instance from registration
   */
  private async createPluginFromRegistration(
    pluginId: string,
    registration: PluginRegistration
  ): Promise<Either<Error, Plugin>> {
    switch (registration.type) {
      case 'instance':
        // Return direct instance (clone if needed to avoid shared state issues)
        return Either.right(registration.source as Plugin);
      
      case 'factory':
      case 'constructor':
        return this.createPluginInstance(registration.source, pluginId);
      
      default:
        return Either.left(new Error(`Unknown registration type: ${ (registration as any).type }`));
    }
  }
  
  /**
   * Cache plugin instance with size management
   */
  private cacheInstance(
    pluginId: string,
    plugin: Plugin
  ): void {
    // Remove oldest entries if cache is full
    if (this.instanceCache.size >= this.config.maxCacheSize) {
      const oldestKey = this.instanceCache.keys().next().value;
      if (oldestKey) {
        this.instanceCache.delete(oldestKey);
      }
    }
    
    this.instanceCache.set(pluginId, plugin);
  }
}
