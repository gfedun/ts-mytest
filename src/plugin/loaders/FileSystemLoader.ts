/**
 * @fileoverview FileSystem Plugin Loader
 *
 * Consolidated file-based plugin loader that handles loading plugins from
 * the file system using various strategies (modules, factories, instances).
 * Replaces FilePluginLoader, FilePluginFactoryLoader, FilePluginInstanceLoader,
 * and ModulePluginLoader.
 */

import { Either } from '@/either';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { PluginError as PluginError } from '../errors/PluginError';
import { Plugin, PluginConfig } from '../types/CoreTypes';
import { LoadingStrategy, LoadingOptions, LoadingResult } from '../types/LoaderTypes';
import { BasePluginLoader } from './PluginLoader';
import * as fs from 'fs';
import * as path from 'path';

/**
 * FileSystem plugin loading strategies
 */
export enum FileLoadingStrategy {
  /** Load as ES6/CommonJS module */
  MODULE = 'module',
  /** Load as JSON configuration with factory */
  FACTORY = 'factory',
  /** Load as JSON plugin instance */
  INSTANCE = 'instance'
}

/**
 * FileSystem loader configuration
 */
export interface FileSystemLoaderConfig {
  /** Base directory for plugin files */
  pluginDirectory: string;
  /** Supported file extensions */
  supportedExtensions: string[];
  /** Default loading strategy */
  defaultStrategy: FileLoadingStrategy;
  /** Whether to enable module caching */
  enableCache: boolean;
}

/**
 * Consolidated FileSystem Plugin Loader
 *
 * Handles loading plugins from the file system using multiple strategies:
 * - Module loading (.js, .ts files)
 * - Factory loading (JSON with factory functions)
 * - Instance loading (JSON plugin instances)
 */
export class FileSystemLoader extends BasePluginLoader {
  public readonly name = 'FileSystemLoader';
  
  private readonly config: FileSystemLoaderConfig;
  private readonly moduleCache = new Map<string, any>();
  
  constructor(config: Partial<FileSystemLoaderConfig> = {}) {
    super();
    
    this.config = {
      pluginDirectory: config.pluginDirectory || './plugins',
      supportedExtensions: config.supportedExtensions || ['.js', '.ts', '.json'],
      defaultStrategy: config.defaultStrategy || FileLoadingStrategy.MODULE,
      enableCache: config.enableCache !== undefined ? config.enableCache : true
    };
  }
  
  /**
   * Check if this loader can handle the plugin
   */
  public canLoad(
    pluginId: string,
    config: PluginConfig
  ): boolean {
    // Check if plugin file exists in configured directory
    const pluginPath = this.resolvePluginPath(pluginId, config);
    return pluginPath !== null;
  }
  
  /**
   * Load a plugin from the file system
   */
  public async loadPlugin(
    pluginId: string,
    config: PluginConfig
  ): Promise<Either<PluginError, Plugin>> {
    const pluginPath = this.resolvePluginPath(pluginId, config);
    
    if (!pluginPath) {
      return Either.left(PluginError.create(
        UnifiedErrorCode.PLUGIN_NOT_FOUND,
        `Plugin file not found for: ${ pluginId }`,
        'loadPlugin',
        { pluginId }
      ));
    }
    
    try {
      // Determine loading strategy based on file extension and config
      const strategy = this.determineLoadingStrategy(pluginPath, config);
      
      // Load plugin using appropriate strategy
      const loadResult = await this.loadByStrategy(pluginId, pluginPath, strategy, config);
      
      if (Either.isLeft(loadResult)) {
        return loadResult;
      }
      
      return Either.right(loadResult.right);
      
    } catch (error) {
      return Either.left(PluginError.create(
        UnifiedErrorCode.PLUGIN_LOAD_FAILED,
        `Failed to load plugin ${ pluginId }: ${ error instanceof Error ? error.message : String(error) }`,
        'loadPlugin',
        { pluginId, pluginPath },
        undefined,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  /**
   * Load plugin using specified strategy
   */
  private async loadByStrategy(
    pluginId: string,
    pluginPath: string,
    strategy: FileLoadingStrategy,
    config: PluginConfig
  ): Promise<Either<PluginError, Plugin>> {
    switch (strategy) {
      case FileLoadingStrategy.MODULE:
        return this.loadAsModule(pluginId, pluginPath, config);
      
      case FileLoadingStrategy.FACTORY:
        return this.loadAsFactory(pluginId, pluginPath, config);
      
      case FileLoadingStrategy.INSTANCE:
        return this.loadAsInstance(pluginId, pluginPath, config);
      
      default:
        return Either.left(PluginError.create(
          UnifiedErrorCode.INVALID_PLUGIN_FORMAT,
          `Unsupported loading strategy: ${ strategy }`,
          'loadByStrategy',
          { pluginId }
        ));
    }
  }
  
  /**
   * Load plugin as ES6/CommonJS module
   */
  private async loadAsModule(
    pluginId: string,
    pluginPath: string,
    config: PluginConfig
  ): Promise<Either<PluginError, Plugin>> {
    try {
      // Check cache first
      let moduleExports: any;
      
      if (this.config.enableCache && this.moduleCache.has(pluginPath)) {
        moduleExports = this.moduleCache.get(pluginPath);
      } else {
        // Dynamic import for ES6 modules and require for CommonJS
        if (pluginPath.endsWith('.mjs') || pluginPath.endsWith('.ts')) {
          moduleExports = await import(pluginPath);
        } else {
          // Clear require cache if not using our cache
          if (!this.config.enableCache) {
            delete require.cache[require.resolve(pluginPath)];
          }
          moduleExports = require(pluginPath);
        }
        
        if (this.config.enableCache) {
          this.moduleCache.set(pluginPath, moduleExports);
        }
      }
      
      // Handle different export patterns
      let PluginClass: any;
      
      if (moduleExports.default) {
        PluginClass = moduleExports.default;
      } else if (moduleExports[pluginId]) {
        PluginClass = moduleExports[pluginId];
      } else if (typeof moduleExports === 'function') {
        PluginClass = moduleExports;
      } else {
        return Either.left(PluginError.create(
          UnifiedErrorCode.INVALID_PLUGIN_FORMAT,
          `No valid plugin export found in module: ${ pluginPath }`,
          'loadAsModule',
          { pluginId, pluginPath }
        ));
      }
      
      // Create plugin instance
      const instanceResult = await this.createPluginInstance(PluginClass, pluginId);
      
      if (Either.isLeft(instanceResult)) {
        return Either.left(PluginError.create(
          UnifiedErrorCode.PLUGIN_INITIALIZATION_FAILED,
          `Failed to instantiate plugin from module: ${ instanceResult.left.message }`,
          'loadAsModule',
          { pluginId },
          undefined,
          instanceResult.left
        ));
      }
      
      return Either.right(instanceResult.right);
      
    } catch (error) {
      return Either.left(PluginError.create(
        UnifiedErrorCode.PLUGIN_LOAD_FAILED,
        `Module loading failed: ${ error instanceof Error ? error.message : String(error) }`,
        'loadAsModule',
        { pluginId, pluginPath },
        undefined,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  /**
   * Load plugin from JSON factory configuration
   */
  private async loadAsFactory(
    pluginId: string,
    pluginPath: string,
    config: PluginConfig
  ): Promise<Either<PluginError, Plugin>> {
    try {
      const jsonContent = await fs.promises.readFile(pluginPath, 'utf-8');
      const factoryConfig = JSON.parse(jsonContent);
      
      if (!factoryConfig.factory || typeof factoryConfig.factory !== 'string') {
        return Either.left(PluginError.create(
          UnifiedErrorCode.INVALID_PLUGIN_FORMAT,
          `Invalid factory configuration: missing or invalid factory property`,
          'loadAsFactory',
          { pluginId, pluginPath }
        ));
      }
      
      // Load the factory function
      const factoryPath = path.resolve(path.dirname(pluginPath), factoryConfig.factory);
      const factoryModule = await import(factoryPath);
      const factory = factoryModule.default || factoryModule[factoryConfig.factoryName || 'createPlugin'];
      
      if (typeof factory !== 'function') {
        return Either.left(PluginError.create(
          UnifiedErrorCode.INVALID_PLUGIN_FORMAT,
          `Factory function not found or invalid`,
          'loadAsFactory',
          { pluginId }
        ));
      }
      
      // Create plugin using factory
      const instanceResult = await this.createPluginInstance(factory, pluginId);
      
      if (Either.isLeft(instanceResult)) {
        return Either.left(PluginError.create(
          UnifiedErrorCode.PLUGIN_INITIALIZATION_FAILED,
          `Factory instantiation failed: ${ instanceResult.left.message }`,
          'loadAsFactory',
          { pluginId },
          undefined,
          instanceResult.left
        ));
      }
      
      return Either.right(instanceResult.right);
      
    } catch (error) {
      return Either.left(PluginError.create(
        UnifiedErrorCode.PLUGIN_LOAD_FAILED,
        `Factory loading failed: ${ error instanceof Error ? error.message : String(error) }`,
        'loadAsFactory',
        { pluginId, pluginPath },
        undefined,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  /**
   * Load plugin from JSON instance
   */
  private async loadAsInstance(
    pluginId: string,
    pluginPath: string,
    config: PluginConfig
  ): Promise<Either<PluginError, Plugin>> {
    try {
      const jsonContent = await fs.promises.readFile(pluginPath, 'utf-8');
      const pluginData = JSON.parse(jsonContent);
      
      // Validate the loaded plugin instance
      if (!this.validatePlugin(pluginData, pluginId)) {
        return Either.left(PluginError.create(
          UnifiedErrorCode.INVALID_PLUGIN_FORMAT,
          `Invalid plugin instance structure`,
          'loadAsInstance',
          { pluginId, pluginPath }
        ));
      }
      
      return Either.right(pluginData as Plugin);
      
    } catch (error) {
      return Either.left(PluginError.create(
        UnifiedErrorCode.PLUGIN_LOAD_FAILED,
        `Instance loading failed: ${ error instanceof Error ? error.message : String(error) }`,
        'loadAsInstance',
        { pluginId, pluginPath },
        undefined,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  /**
   * Resolve plugin file path
   */
  private resolvePluginPath(
    pluginId: string,
    config: PluginConfig
  ): string | null {
    const searchPaths = this.getSearchPaths(pluginId);
    
    for (const searchPath of searchPaths) {
      if (fs.existsSync(searchPath)) {
        return path.resolve(searchPath);
      }
    }
    
    return null;
  }
  
  /**
   * Get possible search paths for plugin
   */
  private getSearchPaths(pluginId: string): string[] {
    const searchPaths: string[] = [];
    const baseDir = path.resolve(this.config.pluginDirectory);
    
    // Try different naming conventions and extensions
    for (const ext of this.config.supportedExtensions) {
      searchPaths.push(path.join(baseDir, `${ pluginId }${ ext }`));
      searchPaths.push(path.join(baseDir, pluginId, `index${ ext }`));
      searchPaths.push(path.join(baseDir, pluginId, `${ pluginId }${ ext }`));
    }
    
    return searchPaths;
  }
  
  /**
   * Determine loading strategy based on file extension and config
   */
  private determineLoadingStrategy(
    pluginPath: string,
    config: PluginConfig
  ): FileLoadingStrategy {
    const ext = path.extname(pluginPath).toLowerCase();
    
    // Override from plugin config
    if (config.config?.loadingStrategy) {
      return config.config.loadingStrategy as FileLoadingStrategy;
    }
    
    // Determine by file extension
    switch (ext) {
      case '.js':
      case '.ts':
      case '.mjs':
        return FileLoadingStrategy.MODULE;
      
      case '.json':
        // Check if it's a factory config by reading first few lines
        try {
          const content = fs.readFileSync(pluginPath, 'utf-8');
          const parsed = JSON.parse(content);
          if (parsed.factory) {
            return FileLoadingStrategy.FACTORY;
          }
        } catch {
          // Ignore parse errors, will be handled during loading
        }
        return FileLoadingStrategy.INSTANCE;
      
      default:
        return this.config.defaultStrategy;
    }
  }
  
  /**
   * Clear module cache
   */
  public clearCache(): void {
    this.moduleCache.clear();
  }
  
  /**
   * Get cache statistics
   */
  public getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.moduleCache.size,
      keys: Array.from(this.moduleCache.keys())
    };
  }
}
