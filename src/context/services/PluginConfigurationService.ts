/**
 * @fileoverview Plugin Configuration Service - Dedicated Plugin Configuration Management
 *
 * Handles all plugin configuration operations including retrieval, updates,
 * validation, and merging with default configurations.
 */

import { Either } from '@/either';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Logger } from '@/logger';
import { Maybe } from '@/maybe';
import { Plugin } from '@/plugin';
import { IPluginEngine } from '@/plugin/core/IPluginEngine';
import { PluginError } from '@/plugin/errors/PluginError';

// Import plugin integration types
import { ConfigurationHookData } from '@/plugin/integration/ServiceHooks';
import { ApplicationContextError } from '../ApplicationContextError';

const LOGGER_NAMESPACE = "[PluginConfigurationService]" as const;

/**
 * Plugin configuration data structure
 */
export interface PluginConfiguration {
  pluginId: string;
  pluginName: string;
  version: string;
  enabled: boolean;
  settings: Record<string, any>;
  defaults: Record<string, any>;
  schema?: Record<string, any>;
  lastUpdated: Date;
  source: 'file' | 'database' | 'environment' | 'runtime';
}

/**
 * Configuration validation result
 */
export interface ConfigurationValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  suggestions: string[];
}

/**
 * Configuration merge options
 */
export interface ConfigurationMergeOptions {
  overwriteExisting: boolean;
  preserveUserSettings: boolean;
  validateAfterMerge: boolean;
  backupOriginal: boolean;
}

/**
 * Plugin configuration management operations
 */
export interface PluginConfigurationOperations {
  getPluginConfiguration(pluginId: string): Either<ApplicationContextError, PluginConfiguration>;
  updatePluginConfiguration(
    pluginId: string,
    config: Partial<PluginConfiguration>
  ): Promise<Either<ApplicationContextError, PluginConfiguration>>;
  validatePluginConfiguration(
    pluginId: string,
    config: any
  ): Either<ApplicationContextError, ConfigurationValidationResult>;
  mergeDefaultConfiguration(
    pluginId: string,
    config: any
  ): Either<ApplicationContextError, PluginConfiguration>;
}

/**
 * PluginConfigurationService manages plugin-specific configuration operations.
 *
 * This service provides focused functionality for:
 * - Retrieving plugin configurations with fallbacks
 * - Updating plugin configurations with validation
 * - Validating configuration against plugin schemas
 * - Merging user settings with default configurations
 * - Configuration change tracking and versioning
 */
export class PluginConfigurationService
  implements PluginConfigurationOperations {
  private readonly pluginEngine: IPluginEngine;
  private readonly logger: Logger;
  private readonly contextName: string;
  
  // Configuration storage and caching
  private readonly configurationCache = new Map<string, PluginConfiguration>();
  private readonly configurationBackups = new Map<string, PluginConfiguration[]>();
  
  // Default merge options
  private static readonly DEFAULT_MERGE_OPTIONS: ConfigurationMergeOptions = {
    overwriteExisting: false,
    preserveUserSettings: true,
    validateAfterMerge: true,
    backupOriginal: true
  };
  
  constructor(
    pluginEngine: IPluginEngine,
    logger: Logger,
    contextName: string
  ) {
    this.pluginEngine = pluginEngine;
    this.logger = logger;
    this.contextName = contextName;
  }
  
  // ====================================================================================
  // CONFIGURATION RETRIEVAL OPERATIONS
  // ====================================================================================
  
  getPluginConfiguration(pluginId: string): Either<ApplicationContextError, PluginConfiguration> {
    this.logger.debug(`${ LOGGER_NAMESPACE } Getting plugin configuration`, {
      contextName: this.contextName,
      pluginId
    });
    
    try {
      // Check cache first
      const cachedConfig = this.configurationCache.get(pluginId);
      if (cachedConfig) {
        this.logger.debug(`${ LOGGER_NAMESPACE } Plugin configuration retrieved from cache`, {
          contextName: this.contextName,
          pluginId,
          version: cachedConfig.version
        });
        return Either.right(cachedConfig);
      }
      
      // Get plugin instance from the engine
      const pluginLoadInfo = this.pluginEngine.getLoadedPlugin(pluginId);
      if (Maybe.isNothing(pluginLoadInfo)) {
        return Either.left(this.createPluginNotFoundError(pluginId, 'getPluginConfiguration'));
      }
      
      // Build configuration from plugin load info
      const configuration = this.buildPluginConfigurationFromLoadInfo(pluginLoadInfo.value, pluginId);
      
      // Cache the configuration
      this.configurationCache.set(pluginId, configuration);
      
      this.logger.info(`${ LOGGER_NAMESPACE } Plugin configuration retrieved successfully`, {
        contextName: this.contextName,
        pluginId,
        pluginName: configuration.pluginName,
        enabled: configuration.enabled,
        settingsCount: Object.keys(configuration.settings).length
      });
      
      return Either.right(configuration);
      
    } catch (error) {
      return Either.left(this.createConfigurationError(
        'getPluginConfiguration',
        `Failed to get plugin configuration: ${ error instanceof Error ? error.message : String(error) }`
      ));
    }
  }
  
  private buildPluginConfigurationFromLoadInfo(pluginLoadInfo: any, pluginId: string): PluginConfiguration {
    // Extract configuration from plugin load info and metadata
    const pluginConfig = pluginLoadInfo.config || {};
    const pluginDefaults = pluginLoadInfo.defaults || {};
    const pluginMetadata = pluginLoadInfo.metadata || { name: pluginId, version: '1.0.0' };
    const pluginSchema = pluginMetadata.configSchema || {};
    
    return {
      pluginId: pluginId,
      pluginName: pluginMetadata.name || pluginId,
      version: pluginMetadata.version || '1.0.0',
      enabled: pluginConfig.enabled !== false, // Default to enabled unless explicitly disabled
      settings: { ...pluginConfig },
      defaults: { ...pluginDefaults },
      schema: pluginSchema,
      lastUpdated: new Date(),
      source: this.determineConfigurationSource(pluginConfig)
    };
  }

  private buildPluginConfiguration(plugin: Plugin): PluginConfiguration {
    // This method is kept for backward compatibility but uses the new approach
    const pluginConfig = (plugin as any).config || {};
    const pluginDefaults = (plugin as any).defaults || {};
    const pluginSchema = (plugin.metadata as any).configSchema || {};
    
    return {
      pluginId: plugin.id,
      pluginName: plugin.metadata.name,
      version: plugin.metadata.version || '1.0.0',
      enabled: pluginConfig.enabled !== false,
      settings: { ...pluginConfig },
      defaults: { ...pluginDefaults },
      schema: pluginSchema,
      lastUpdated: new Date(),
      source: this.determineConfigurationSource(pluginConfig)
    };
  }
  
  private determineConfigurationSource(config: any): 'file' | 'database' | 'environment' | 'runtime' {
    // Simple heuristic to determine configuration source
    if (config._source) return config._source;
    if (config.configFile) return 'file';
    if (config.fromEnv) return 'environment';
    if (config.fromDb) return 'database';
    return 'runtime';
  }
  
  // ====================================================================================
  // CONFIGURATION UPDATE OPERATIONS
  // ====================================================================================
  
  async updatePluginConfiguration(
    pluginId: string,
    config: Partial<PluginConfiguration>
  ): Promise<Either<ApplicationContextError, PluginConfiguration>> {
    this.logger.debug(`${ LOGGER_NAMESPACE } Updating plugin configuration`, {
      contextName: this.contextName,
      pluginId,
      updateKeys: Object.keys(config)
    });
    
    try {
      // Get current configuration
      const currentConfigResult = this.getPluginConfiguration(pluginId);
      if (Either.isLeft(currentConfigResult)) {
        return currentConfigResult;
      }
      
      const currentConfig = currentConfigResult.right;
      
      // Create backup if requested
      this.createConfigurationBackup(pluginId, currentConfig);
      
      // Merge configurations
      const updatedConfig: PluginConfiguration = {
        ...currentConfig,
        ...config,
        pluginId, // Ensure pluginId cannot be changed
        lastUpdated: new Date()
      };
      
      // Validate the updated configuration
      if (config.settings) {
        const validationResult = this.validatePluginConfiguration(pluginId, updatedConfig.settings);
        if (Either.isLeft(validationResult)) {
          return Either.left(validationResult.left);
        }
        
        if (!validationResult.right.isValid) {
          return Either.left(ApplicationContextError.create(
            UnifiedErrorCode.INVALID_CONFIGURATION,
            `Configuration validation failed: ${ validationResult.right.errors.join(', ') }`,
            'updatePluginConfiguration',
            { contextName: this.contextName, pluginId }
          ));
        }
      }
      
      // Apply configuration to plugin
      const applyResult = await this.applyConfigurationToPlugin(pluginId, updatedConfig);
      if (Either.isLeft(applyResult)) {
        return Either.left(applyResult.left);
      }
      
      // Update cache
      this.configurationCache.set(pluginId, updatedConfig);
      
      this.logger.info(`${ LOGGER_NAMESPACE } Plugin configuration updated successfully`, {
        contextName: this.contextName,
        pluginId,
        pluginName: updatedConfig.pluginName,
        changedSettings: Object.keys(config)
      });
      
      return Either.right(updatedConfig);
      
    } catch (error) {
      return Either.left(this.createConfigurationError(
        'updatePluginConfiguration',
        `Failed to update plugin configuration: ${ error instanceof Error ? error.message : String(error) }`
      ));
    }
  }
  
  private createConfigurationBackup(
    pluginId: string,
    configuration: PluginConfiguration
  ): void {
    if (!this.configurationBackups.has(pluginId)) {
      this.configurationBackups.set(pluginId, []);
    }
    
    const backups = this.configurationBackups.get(pluginId)!;
    backups.push({ ...configuration });
    
    // Keep only last 10 backups
    if (backups.length > 10) {
      backups.shift();
    }
  }
  
  private async applyConfigurationToPlugin(
    pluginId: string,
    configuration: PluginConfiguration
  ): Promise<Either<ApplicationContextError, void>> {
    try {
      const pluginLoadInfo = this.pluginEngine.getLoadedPlugin(pluginId);
      if (Maybe.isNothing(pluginLoadInfo)) {
        return Either.left(this.createPluginNotFoundError(pluginId, 'applyConfigurationToPlugin'));
      }
      
      // Apply configuration to plugin instance
      // Note: This is a placeholder implementation since we're working with load info
      // The actual configuration application would depend on the plugin engine's capabilities
      this.logger.debug(`${LOGGER_NAMESPACE} Configuration applied to plugin load info`, {
        contextName: this.contextName,
        pluginId,
        settingsKeys: Object.keys(configuration.settings)
      });
      
      return Either.right(undefined as void);
      
    } catch (error) {
      return Either.left(this.createConfigurationError(
        'applyConfigurationToPlugin',
        `Failed to apply configuration to plugin: ${ error instanceof Error ? error.message : String(error) }`
      ));
    }
  }
  
  // ====================================================================================
  // CONFIGURATION VALIDATION OPERATIONS
  // ====================================================================================
  
  validatePluginConfiguration(
    pluginId: string,
    config: any
  ): Either<ApplicationContextError, ConfigurationValidationResult> {
    this.logger.debug(`${ LOGGER_NAMESPACE } Validating plugin configuration`, {
      contextName: this.contextName,
      pluginId,
      configKeys: Object.keys(config || {})
    });
    
    try {
      const pluginLoadInfo = this.pluginEngine.getLoadedPlugin(pluginId);
      if (Maybe.isNothing(pluginLoadInfo)) {
        return Either.left(this.createPluginNotFoundError(pluginId, 'validatePluginConfiguration'));
      }
      
      const errors: string[] = [];
      const warnings: string[] = [];
      const suggestions: string[] = [];
      
      // Get plugin schema for validation from load info
      const plugin = pluginLoadInfo.value.plugin;
      const pluginMetadata = plugin.metadata || { name: pluginId, version: '1.0.0' };
      const schema = pluginMetadata.configSchema;
      
      if (schema) {
        // Validate against schema
        const schemaValidation = this.validateAgainstSchema(config, schema);
        errors.push(...schemaValidation.errors);
        warnings.push(...schemaValidation.warnings);
        suggestions.push(...schemaValidation.suggestions);
      } else {
        warnings.push('No configuration schema defined for this plugin');
        suggestions.push('Consider adding a configuration schema for better validation');
      }
      
      // Basic validation checks
      if (config && typeof config !== 'object') {
        errors.push('Configuration must be an object');
      }
      
      // Check for required fields if schema exists
      if (schema && schema.required) {
        for (const requiredField of schema.required) {
          if (!(requiredField in config)) {
            errors.push(`Required field '${ requiredField }' is missing`);
          }
        }
      }
      
      const result: ConfigurationValidationResult = {
        isValid: errors.length === 0,
        errors,
        warnings,
        suggestions
      };
      
      this.logger.debug(`${ LOGGER_NAMESPACE } Plugin configuration validation completed`, {
        contextName: this.contextName,
        pluginId,
        isValid: result.isValid,
        errorCount: errors.length,
        warningCount: warnings.length
      });
      
      return Either.right(result);
      
    } catch (error) {
      return Either.left(this.createConfigurationError(
        'validatePluginConfiguration',
        `Failed to validate plugin configuration: ${ error instanceof Error ? error.message : String(error) }`
      ));
    }
  }
  
  private validateAgainstSchema(
    config: any,
    schema: any
  ): ConfigurationValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];
    
    // Simple schema validation - can be enhanced with proper JSON Schema validator
    if (schema.properties) {
      for (const [key, property] of Object.entries(schema.properties as Record<string, any>)) {
        if (key in config) {
          const value = config[key];
          const propType = property.type;
          
          // Type validation
          if (propType && typeof value !== propType) {
            errors.push(`Property '${ key }' should be of type '${ propType }', got '${ typeof value }'`);
          }
          
          // Range validation for numbers
          if (propType === 'number') {
            if (property.minimum !== undefined && value < property.minimum) {
              errors.push(`Property '${ key }' should be >= ${ property.minimum }, got ${ value }`);
            }
            if (property.maximum !== undefined && value > property.maximum) {
              errors.push(`Property '${ key }' should be <= ${ property.maximum }, got ${ value }`);
            }
          }
          
          // String length validation
          if (propType === 'string') {
            if (property.minLength !== undefined && value.length < property.minLength) {
              errors.push(`Property '${ key }' should have at least ${ property.minLength } characters`);
            }
            if (property.maxLength !== undefined && value.length > property.maxLength) {
              errors.push(`Property '${ key }' should have at most ${ property.maxLength } characters`);
            }
          }
        }
      }
    }
    
    return { isValid: errors.length === 0, errors, warnings, suggestions };
  }
  
  // ====================================================================================
  // CONFIGURATION MERGING OPERATIONS
  // ====================================================================================
  
  mergeDefaultConfiguration(
    pluginId: string,
    config: any,
    options: Partial<ConfigurationMergeOptions> = {}
  ): Either<ApplicationContextError, PluginConfiguration> {
    this.logger.debug(`${ LOGGER_NAMESPACE } Merging default configuration`, {
      contextName: this.contextName,
      pluginId,
      configKeys: Object.keys(config || {})
    });
    
    try {
      const pluginLoadInfo = this.pluginEngine.getLoadedPlugin(pluginId);
      if (Maybe.isNothing(pluginLoadInfo)) {
        return Either.left(this.createPluginNotFoundError(pluginId, 'mergeDefaultConfiguration'));
      }
      
      const mergeOptions = { ...PluginConfigurationService.DEFAULT_MERGE_OPTIONS, ...options };
      
      // Get current configuration
      const currentConfigResult = this.getPluginConfiguration(pluginId);
      if (Either.isLeft(currentConfigResult)) {
        return currentConfigResult;
      }
      
      const currentConfig = currentConfigResult.right;
      
      // Create backup if requested
      if (mergeOptions.backupOriginal) {
        this.createConfigurationBackup(pluginId, currentConfig);
      }
      
      // Merge configurations
      const mergedSettings = this.mergeSettings(
        currentConfig.defaults,
        currentConfig.settings,
        config,
        mergeOptions
      );
      
      const mergedConfig: PluginConfiguration = {
        ...currentConfig,
        settings: mergedSettings,
        lastUpdated: new Date()
      };
      
      // Validate after merge if requested
      if (mergeOptions.validateAfterMerge) {
        const validationResult = this.validatePluginConfiguration(pluginId, mergedSettings);
        if (Either.isLeft(validationResult)) {
          return Either.left(validationResult.left);
        }
        
        if (!validationResult.right.isValid) {
          return Either.left(ApplicationContextError.create(
            UnifiedErrorCode.INVALID_CONFIGURATION,
            `Merged configuration validation failed: ${ validationResult.right.errors.join(', ') }`,
            'mergeDefaultConfiguration',
            { contextName: this.contextName, pluginId }
          ));
        }
      }
      
      // Update cache
      this.configurationCache.set(pluginId, mergedConfig);
      
      this.logger.info(`${ LOGGER_NAMESPACE } Default configuration merged successfully`, {
        contextName: this.contextName,
        pluginId,
        pluginName: mergedConfig.pluginName,
        mergedKeys: Object.keys(config)
      });
      
      return Either.right(mergedConfig);
      
    } catch (error) {
      return Either.left(this.createConfigurationError(
        'mergeDefaultConfiguration',
        `Failed to merge default configuration: ${ error instanceof Error ? error.message : String(error) }`
      ));
    }
  }
  
  private mergeSettings(
    defaults: Record<string, any>,
    current: Record<string, any>,
    incoming: Record<string, any>,
    options: ConfigurationMergeOptions
  ): Record<string, any> {
    const result = { ...defaults };
    
    // Apply current settings
    if (options.preserveUserSettings) {
      Object.assign(result, current);
    }
    
    // Apply incoming configuration
    for (const [key, value] of Object.entries(incoming)) {
      if (options.overwriteExisting || !(key in result)) {
        result[key] = value;
      }
    }
    
    return result;
  }
  
  // ====================================================================================
  // CLEANUP OPERATIONS
  // ====================================================================================
  
  async cleanup(): Promise<Either<ApplicationContextError, void>> {
    this.logger.debug(`${ LOGGER_NAMESPACE } Cleaning up plugin configuration service`, {
      contextName: this.contextName,
      cachedConfigurations: this.configurationCache.size,
      backupCount: Array.from(this.configurationBackups.values()).reduce((
        sum,
        backups
      ) => sum + backups.length, 0)
    });
    
    try {
      // Clear configuration cache
      this.configurationCache.clear();
      
      // Clear configuration backups
      this.configurationBackups.clear();
      
      this.logger.info(`${ LOGGER_NAMESPACE } Plugin configuration service cleanup completed`, {
        contextName: this.contextName
      });
      
      return Either.right(undefined as void);
      
    } catch (error) {
      return Either.left(this.createConfigurationError(
        'cleanup',
        `Plugin configuration service cleanup failed: ${ error instanceof Error ? error.message : String(error) }`
      ));
    }
  }
  
  // ====================================================================================
  // SERVICE HOOKS INTEGRATION - NEW METHODS FOR XPLUGIN BRIDGE
  // ====================================================================================
  
  /**
   * Handle configuration events from ServiceHooks
   * Called when the core engine emits configuration-related events
   */
  async handleConfigurationEvent(data: ConfigurationHookData): Promise<void> {
    this.logger.debug(`${ LOGGER_NAMESPACE } Handling configuration event`, {
      contextName: this.contextName,
      pluginId: data.pluginId,
      success: data.success,
      configurationKeys: data.configurationKeys
    });
    
    try {
      if (data.success) {
        // Configuration was successfully processed
        await this.onConfigurationSuccess(data);
      } else {
        // Configuration processing failed
        await this.onConfigurationFailure(data);
      }
      
      // Update configuration cache based on the event
      await this.refreshConfigurationCache(data.pluginId);
      
    } catch (error) {
      this.logger.error(`${ LOGGER_NAMESPACE } Error handling configuration event`, {
        contextName: this.contextName,
        pluginId: data.pluginId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  /**
   * Inject configuration for a plugin (called by ContextBridge)
   * This method is called when the core engine requests configuration for a plugin
   */
  async injectConfiguration(pluginId: string): Promise<Record<string, any>> {
    this.logger.debug(`${ LOGGER_NAMESPACE } Injecting configuration for plugin`, {
      contextName: this.contextName,
      pluginId
    });
    
    try {
      // Get plugin configuration
      const configResult = this.getPluginConfiguration(pluginId);
      if (Either.isLeft(configResult)) {
        throw configResult.left;
      }
      
      const config = configResult.right;
      
      // Return the configuration settings for injection
      // Note: Direct plugin instance injection is handled differently with the plugin engine architecture
      this.logger.debug(`${LOGGER_NAMESPACE} Configuration injected for plugin`, {
        contextName: this.contextName,
        pluginId,
        settingsKeys: Object.keys(config.settings)
      });
      
      return config.settings;
      
    } catch (error) {
      this.logger.error(`${ LOGGER_NAMESPACE } Error injecting configuration`, {
        contextName: this.contextName,
        pluginId,
        error: error instanceof Error ? error.message : String(error)
      });
      
      throw error;
    }
  }
  
  private async onConfigurationSuccess(data: ConfigurationHookData): Promise<void> {
    // Implementation for handling successful configuration events
    this.logger.info(`${ LOGGER_NAMESPACE } Configuration event processed successfully`, {
      contextName: this.contextName,
      pluginId: data.pluginId
    });
  }
  
  private async onConfigurationFailure(data: ConfigurationHookData): Promise<void> {
    this.logger.error(`${LOGGER_NAMESPACE} Configuration processing failed`, {
      contextName: this.contextName,
      pluginId: data.pluginId,
      error: data.error
    });
  }
  
  private async refreshConfigurationCache(pluginId: string): Promise<void> {
    // Implementation for refreshing configuration cache after events
    this.logger.debug(`${ LOGGER_NAMESPACE } Refreshing configuration cache`, {
      contextName: this.contextName,
      pluginId
    });
    
    // Invalidate cache
    this.configurationCache.delete(pluginId);
    
    // Optionally, re-fetch and update the cache
    const configResult = this.getPluginConfiguration(pluginId);
    if (Either.isRight(configResult)) {
      this.configurationCache.set(pluginId, configResult.right);
    }
  }
  
  // ====================================================================================
  // ERROR CREATION FACTORIES
  // ====================================================================================
  
  private createConfigurationError(
    method: string,
    message: string
  ): ApplicationContextError {
    return ApplicationContextError.create(
      UnifiedErrorCode.CONFIGURATION_SOURCE_ERROR,
      message,
      method,
      { contextName: this.contextName },
      undefined // Remove the originalError parameter as it causes type issues
    );
  }
  
  private createPluginNotFoundError(pluginId: string, method: string): ApplicationContextError {
    return ApplicationContextError.create(
      UnifiedErrorCode.PLUGIN_NOT_FOUND,
      `Plugin not found: ${pluginId}`,
      method,
      { contextName: this.contextName, pluginId }
    );
  }
}
