/**
 * @fileoverview Plugin Engine Builder
 *
 * Simplified builder focused on core engine configuration only.
 * Context-specific configuration is delegated to PluginManagerContext.
 *
 * This builder handles ONLY core engine essentials:
 * - Logger configuration
 * - Plugin registry setup
 * - Service registry integration
 * - Plugin loader registration
 * - Basic validation
 */

import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Logger } from '@/logger';
import { ServiceRegistry } from '@/service';

import {
  IPluginEngine,
  PluginEngineConfig
} from '../core/IPluginEngine';
import { PluginEngine } from '../core/PluginEngine';
import { PluginError } from '../errors/PluginError';
import { FileSystemLoader } from '../loaders/FileSystemLoader';
import { RuntimeLoader } from '../loaders/RuntimeLoader';
import { FocusedPluginRegistry } from '../registry/PluginRegistry';
import { PluginLoader } from '../types/LoaderTypes';

/**
 * Builder configuration options
 */
export interface PluginEngineBuilderConfig {
  readonly logger?: Logger;
  readonly pluginRegistry?: FocusedPluginRegistry;
  readonly serviceRegistry?: ServiceRegistry;
  readonly pluginLoaders?: PluginLoader[];
  readonly serviceHooksEnabled?: boolean;
  readonly contextBridgeEnabled?: boolean;
}

/**
 * Plugin Engine Builder
 *
 * Simplified builder that creates and configures the core plugin engine
 * with only essential dependencies. Advanced configuration and orchestration
 * capabilities are handled by PluginManagerContext.
 */
export class PluginEngineBuilder {
  private logger?: Logger;
  private pluginRegistry?: FocusedPluginRegistry;
  private serviceRegistry?: ServiceRegistry;
  private pluginLoaders: PluginLoader[] = [];
  
  constructor() {
    // Initialize with default loaders
    this.pluginLoaders = [
      new FileSystemLoader(),
      new RuntimeLoader()
    ];
  }
  
  /**
   * Set the logger for the plugin engine
   */
  withLogger(logger: Logger): PluginEngineBuilder {
    this.logger = logger;
    return this;
  }
  
  /**
   * Set the plugin registry
   */
  withPluginRegistry(registry: FocusedPluginRegistry): PluginEngineBuilder {
    this.pluginRegistry = registry;
    return this;
  }
  
  /**
   * Set the service registry
   */
  withServiceRegistry(registry: ServiceRegistry): PluginEngineBuilder {
    this.serviceRegistry = registry;
    return this;
  }
  
  /**
   * Add a plugin loader
   */
  withLoader(loader: PluginLoader): PluginEngineBuilder {
    this.pluginLoaders.push(loader);
    return this;
  }
  
  /**
   * Set plugin loaders (replaces existing loaders)
   */
  withLoaders(loaders: PluginLoader[]): PluginEngineBuilder {
    this.pluginLoaders = [...loaders];
    return this;
  }
  
  /**
   * Remove all plugin loaders
   */
  clearLoaders(): PluginEngineBuilder {
    this.pluginLoaders = [];
    return this;
  }
  
  /**
   * Apply configuration from options object
   */
  fromConfig(config: PluginEngineBuilderConfig): PluginEngineBuilder {
    if (config.logger) {
      this.withLogger(config.logger);
    }
    if (config.pluginRegistry) {
      this.withPluginRegistry(config.pluginRegistry);
    }
    if (config.serviceRegistry) {
      this.withServiceRegistry(config.serviceRegistry);
    }
    if (config.pluginLoaders) {
      this.withLoaders(config.pluginLoaders);
    }
    return this;
  }
  
  /**
   * Create default dependencies if not provided
   */
  withDefaults(): PluginEngineBuilder {
    if (!this.logger) {
      this.logger = console as any; // Fallback logger
    }
    if (!this.pluginRegistry) {
      this.pluginRegistry = new FocusedPluginRegistry();
    }
    if (!this.serviceRegistry) {
      // Create a minimal service registry if none provided
      // Note: ServiceRegistry constructor is protected, so we need to handle this differently
      // For now, we'll require it to be provided externally
      throw new PluginError(
        UnifiedErrorCode.REGISTRY_CONFIGURATION_ERROR,
        'Service registry must be provided - cannot create default',
        {
          timestamp: new Date(),
          module: 'PluginEngineBuilder',
          operation: 'withDefaults',
          engineState: 'building'
        }
      );
    }
    if (this.pluginLoaders.length === 0) {
      // Add default loaders if none configured
      this.pluginLoaders = [
        new FileSystemLoader(),
        new RuntimeLoader()
      ];
    }
    return this;
  }
  
  /**
   * Validate the builder configuration
   */
  validate(): void {
    const errors: string[] = [];
    
    if (!this.logger) {
      errors.push('Logger is required');
    }
    if (!this.pluginRegistry) {
      errors.push('Plugin registry is required');
    }
    if (!this.serviceRegistry) {
      errors.push('Service registry is required');
    }
    if (this.pluginLoaders.length === 0) {
      errors.push('At least one plugin loader is required');
    }
    
    // Validate loader names are unique
    const loaderNames = new Set<string>();
    for (const loader of this.pluginLoaders) {
      if (loaderNames.has(loader.name)) {
        errors.push(`Duplicate loader name: ${ loader.name }`);
      }
      loaderNames.add(loader.name);
    }
    
    if (errors.length > 0) {
      throw new PluginError(
        UnifiedErrorCode.INVALID_CONFIGURATION,
        `Builder validation failed: ${ errors.join(', ') }`,
        {
          timestamp: new Date(),
          module: 'PluginEngineBuilder',
          operation: 'validate',
          engineState: 'validation',
          configurationErrors: errors
        }
      );
    }
  }
  
  /**
   * Build and return the configured plugin engine
   */
  build(): IPluginEngine {
    // Apply defaults if needed
    this.withDefaults();
    
    // Validate configuration
    this.validate();
    
    // Create the engine configuration
    const config: PluginEngineConfig = {
      logger: this.logger!,
      pluginRegistry: this.pluginRegistry!,
      serviceRegistry: this.serviceRegistry!,
      pluginLoaders: [...this.pluginLoaders]
    };
    
    // Create and return the plugin engine
    return new PluginEngine(config);
  }
  
  /**
   * Build and return both the engine and its configuration
   * Useful for context layer integration
   */
  buildWithConfig(): { engine: IPluginEngine; config: PluginEngineConfig } {
    // Apply defaults if needed
    this.withDefaults();
    
    // Validate configuration
    this.validate();
    
    // Create the engine configuration
    const config: PluginEngineConfig = {
      logger: this.logger!,
      pluginRegistry: this.pluginRegistry!,
      serviceRegistry: this.serviceRegistry!,
      pluginLoaders: [...this.pluginLoaders]
    };
    
    // Create the plugin engine
    const engine = new PluginEngine(config);
    
    return { engine, config };
  }
  
  /**
   * Get current builder state for debugging
   */
  getState(): {
    hasLogger: boolean;
    hasPluginRegistry: boolean;
    hasServiceRegistry: boolean;
    loaderCount: number;
    loaderNames: string[];
  } {
    return {
      hasLogger: !!this.logger,
      hasPluginRegistry: !!this.pluginRegistry,
      hasServiceRegistry: !!this.serviceRegistry,
      loaderCount: this.pluginLoaders.length,
      loaderNames: this.pluginLoaders.map(loader => loader.name)
    };
  }
}

/**
 * Factory function for creating a new plugin engine builder
 */
export function createPluginEngineBuilder(): PluginEngineBuilder {
  return new PluginEngineBuilder();
}

/**
 * Convenience function for building a plugin engine with minimal configuration
 */
export function buildMinimalPluginEngine(logger?: Logger): IPluginEngine {
  return createPluginEngineBuilder()
    .withDefaults()
    .withLogger(logger || console as any)
    .build();
}

/**
 * Convenience function for building a plugin engine from configuration
 */
export function buildPluginEngineFromConfig(config: PluginEngineBuilderConfig): IPluginEngine {
  return createPluginEngineBuilder()
    .fromConfig(config)
    .withDefaults()
    .build();
}
