/**
 * @fileoverview Plugin Registry Service - Dedicated Plugin Discovery and Registration
 *
 * Handles all plugin registry operations including discovery, loading,
 * registration, and retrieval of plugin instances.
 * Enhanced with ServiceHooks integration for real-time registry monitoring.
 */

import { Either } from '@/either';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Logger } from '@/logger';
import { Maybe } from '@/maybe';
import {
  Plugin,
  PluginError
} from '@/plugin';
import { IPluginEngine } from '@/plugin/core/IPluginEngine';

import { RegistryHookData } from '@/plugin/integration/ServiceHooks';
import { ApplicationContextError } from '../ApplicationContextError';

const LOGGER_NAMESPACE = "[PluginRegistryService]" as const;

/**
 * Basic plugin configuration structure
 */
export interface PluginConfig {
  id: string;
  displayName: string;
  version: string;
  enabled: boolean;
  pluginPath: string;
  dependencies: string[];
  metadata: Record<string, any>;
}

/**
 * Plugin registry management operations
 */
export interface PluginRegistryOperations {
  discoverPlugins(searchPaths: string[]): Promise<Either<ApplicationContextError, PluginConfig[]>>;
  loadPlugin(pluginPath: string): Promise<Either<ApplicationContextError, Plugin>>;
  registerPlugin(plugin: Plugin): Promise<Either<ApplicationContextError, void>>;
  unregisterPlugin(pluginId: string): Promise<Either<ApplicationContextError, void>>;
  getPlugin(pluginId: string): Maybe<Plugin>;
  getAllPlugins(): readonly Plugin[];
}

/**
 * Registry status for monitoring
 */
export interface RegistryStatus {
  totalPlugins: number;
  registeredPlugins: number;
  unregisteredPlugins: number;
  failedRegistrations: string[];
  lastUpdate: Date;
}

/**
 * Registry event handler function type
 */
export type RegistryEventHandler = (data: RegistryHookData) => void;

/**
 * PluginRegistryService manages plugin discovery, loading, and registration operations.
 * Enhanced with ServiceHooks integration for real-time registry monitoring.
 *
 * This service provides focused functionality for:
 * - Plugin discovery from file system paths
 * - Loading individual plugins from paths or configurations
 * - Plugin registration and unregistration
 * - Plugin retrieval and listing operations
 * - Real-time registry monitoring and event handling
 * - Automated registry health checks and validation
 */
export class PluginRegistryService
  implements PluginRegistryOperations {
  private readonly pluginManager: PluginManager;
  private readonly logger: Logger;
  private readonly contextName: string;
  
  // ServiceHooks integration
  private pluginEngine: IPluginEngine | null = null;
  private registryEventHandlers: Set<RegistryEventHandler> = new Set();
  
  // Registry monitoring
  private registryStatus: RegistryStatus;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private autoValidationEnabled: boolean = true;
  
  constructor(
    pluginManager: PluginManager,
    logger: Logger,
    contextName: string
  ) {
    this.pluginManager = pluginManager;
    this.logger = logger;
    this.contextName = contextName;
    
    this.registryStatus = {
      totalPlugins: 0,
      registeredPlugins: 0,
      unregisteredPlugins: 0,
      failedRegistrations: [],
      lastUpdate: new Date()
    };
    
    this.startRegistryMonitoring();
  }
  
  // ====================================================================================
  // SERVICEHOOKS INTEGRATION
  // ====================================================================================
  
  /**
   * Set the plugin engine for ServiceHooks integration
   */
  setPluginEngine(engine: IPluginEngine): void {
    this.pluginEngine = engine;
    
    this.logger.debug(`${ LOGGER_NAMESPACE } Plugin engine set for ServiceHooks integration`, {
      contextName: this.contextName
    });
  }
  
  /**
   * Register a registry event handler
   */
  onRegistryEvent(handler: RegistryEventHandler): void {
    this.registryEventHandlers.add(handler);
    
    this.logger.debug(`${ LOGGER_NAMESPACE } Registry event handler registered`, {
      contextName: this.contextName,
      handlerCount: this.registryEventHandlers.size
    });
  }
  
  /**
   * Unregister a registry event handler
   */
  offRegistryEvent(handler: RegistryEventHandler): void {
    this.registryEventHandlers.delete(handler);
    
    this.logger.debug(`${ LOGGER_NAMESPACE } Registry event handler unregistered`, {
      contextName: this.contextName,
      handlerCount: this.registryEventHandlers.size
    });
  }
  
  /**
   * Handle registry events from the core engine
   */
  private handleRegistryEvent(data: RegistryHookData): void {
    this.logger.debug(`${ LOGGER_NAMESPACE } Handling registry event`, {
      contextName: this.contextName,
      pluginId: data.pluginId,
      operation: data.operation,
      success: data.success
    });
    
    // Update registry status
    this.updateRegistryStatus(data);
    
    // Trigger validation if enabled
    if (this.autoValidationEnabled && !data.success) {
      this.validateRegistryIntegrity();
    }
    
    // Notify registered handlers
    this.registryEventHandlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        this.logger.error(`${ LOGGER_NAMESPACE } Error in registry event handler`, {
          contextName: this.contextName,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }
  
  /**
   * Update registry status based on events
   */
  private updateRegistryStatus(data: RegistryHookData): void {
    const allPlugins = this.pluginManager.getAllPlugins();
    
    this.registryStatus = {
      totalPlugins: allPlugins.length,
      registeredPlugins: allPlugins.filter(p => p.state !== 'Unloaded').length,
      unregisteredPlugins: allPlugins.filter(p => p.state === 'Unloaded').length,
      failedRegistrations: data.success ?
        this.registryStatus.failedRegistrations :
        [...this.registryStatus.failedRegistrations, data.pluginId],
      lastUpdate: new Date()
    };
  }
  
  /**
   * Start registry monitoring
   */
  private startRegistryMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    this.monitoringInterval = setInterval(() => {
      this.performRegistryHealthCheck();
    }, 60000); // Check every minute
    
    this.logger.debug(`${ LOGGER_NAMESPACE } Registry monitoring started`, {
      contextName: this.contextName,
      intervalMs: 60000
    });
  }
  
  /**
   * Stop registry monitoring
   */
  private stopRegistryMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.logger.debug(`${ LOGGER_NAMESPACE } Registry monitoring stopped`, {
      contextName: this.contextName
    });
  }
  
  /**
   * Perform registry health check
   */
  private performRegistryHealthCheck(): void {
    const issues: string[] = [];
    
    if (this.registryStatus.failedRegistrations.length > 0) {
      issues.push(`${ this.registryStatus.failedRegistrations.length } failed registrations`);
    }
    
    if (issues.length > 0) {
      this.logger.warn(`${ LOGGER_NAMESPACE } Registry health check found issues`, {
        contextName: this.contextName,
        issues,
        totalPlugins: this.registryStatus.totalPlugins
      });
    }
  }
  
  /**
   * Validate registry integrity
   */
  private async validateRegistryIntegrity(): Promise<void> {
    this.logger.info(`${ LOGGER_NAMESPACE } Validating registry integrity`, {
      contextName: this.contextName
    });
    
    // Check for duplicate plugin IDs
    const allPlugins = this.pluginManager.getAllPlugins();
    const pluginIds = allPlugins.map(p => p.id);
    const duplicates = pluginIds.filter((
      id,
      index
    ) => pluginIds.indexOf(id) !== index);
    
    if (duplicates.length > 0) {
      this.logger.error(`${ LOGGER_NAMESPACE } Registry integrity check failed - duplicate plugin IDs`, {
        contextName: this.contextName,
        duplicates
      });
    }
  }
  
  /**
   * Get current registry status
   */
  getRegistryStatus(): RegistryStatus {
    return { ...this.registryStatus };
  }
  
  // ====================================================================================
  // PLUGIN REGISTRY OPERATIONS
  // ====================================================================================
  
  async discoverPlugins(searchPaths: string[]): Promise<Either<ApplicationContextError, PluginConfig[]>> {
    this.logger.debug(`${ LOGGER_NAMESPACE } Discovering plugins in paths`, {
      contextName: this.contextName,
      searchPaths,
      pathCount: searchPaths.length
    });
    
    try {
      const discoveredPlugins: PluginConfig[] = [];
      
      for (const searchPath of searchPaths) {
        // In a real implementation, this would scan the file system
        // For now, we'll return empty array as placeholder
        this.logger.debug(`${ LOGGER_NAMESPACE } Scanning path for plugins`, {
          contextName: this.contextName,
          searchPath
        });
      }
      
      this.logger.info(`${ LOGGER_NAMESPACE } Plugin discovery completed`, {
        contextName: this.contextName,
        discoveredCount: discoveredPlugins.length,
        searchPathCount: searchPaths.length
      });
      
      return Either.right(discoveredPlugins);
      
    } catch (error) {
      return Either.left(this.createRegistryError(
        'discoverPlugins',
        `Plugin discovery failed: ${ error instanceof Error ? error.message : String(error) }`,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  async loadPlugin(pluginPath: string): Promise<Either<ApplicationContextError, Plugin>> {
    this.logger.debug(`${ LOGGER_NAMESPACE } Loading plugin from path`, {
      contextName: this.contextName,
      pluginPath
    });
    
    try {
      // Use PluginManager's existing loading mechanism
      const loadResult = await this.pluginManager.loadPlugin(pluginPath);
      
      if (Either.isLeft(loadResult)) {
        return Either.left(ApplicationContextError.create(
          UnifiedErrorCode.PLUGIN_LOAD_FAILED,
          `Failed to load plugin from '${ pluginPath }': ${ loadResult.left.message }`,
          'loadPlugin',
          { contextName: this.contextName, pluginPath }
        ));
      }
      
      const plugin = loadResult.right;
      
      // Emit registry event for ServiceHooks integration
      this.emitRegistryEvent({
        pluginId: plugin.id,
        operation: 'register',
        success: true,
        timestamp: new Date(),
        metadata: { pluginPath, operation: 'loadPlugin' }
      });
      
      this.logger.info(`${ LOGGER_NAMESPACE } Plugin loaded successfully`, {
        contextName: this.contextName,
        pluginId: plugin.id,
        pluginName: plugin.metadata.name,
        pluginPath
      });
      
      return Either.right(plugin);
      
    } catch (error) {
      // Emit error event
      this.emitRegistryEvent({
        pluginId: 'unknown',
        operation: 'register',
        success: false,
        error: error instanceof PluginError ? error : undefined,
        timestamp: new Date(),
        metadata: {
          pluginPath,
          operation: 'loadPlugin',
          error: error instanceof Error ? error.message : String(error)
        }
      });
      
      return Either.left(this.createRegistryError(
        'loadPlugin',
        `Failed to load plugin from '${ pluginPath }': ${ error instanceof Error ? error.message : String(error) }`,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  async registerPlugin(plugin: Plugin): Promise<Either<ApplicationContextError, void>> {
    this.logger.debug(`${ LOGGER_NAMESPACE } Registering plugin`, {
      contextName: this.contextName,
      pluginId: plugin.id,
      pluginName: plugin.metadata.name
    });
    
    try {
      // Use PluginManager's existing registration mechanism
      const registerResult = await this.pluginManager.registerPlugin(plugin);
      
      if (Either.isLeft(registerResult)) {
        // Emit failure event
        this.emitRegistryEvent({
          pluginId: plugin.id,
          operation: 'register',
          success: false,
          error: registerResult.left instanceof PluginError ? registerResult.left : undefined,
          timestamp: new Date(),
          metadata: { operation: 'registerPlugin', error: registerResult.left.message }
        });
        
        return Either.left(ApplicationContextError.create(
          UnifiedErrorCode.PLUGIN_REGISTRATION_FAILED,
          `Failed to register plugin '${ plugin.id }': ${ registerResult.left.message }`,
          'registerPlugin',
          { contextName: this.contextName, pluginId: plugin.id }
        ));
      }
      
      // Emit success event
      this.emitRegistryEvent({
        pluginId: plugin.id,
        operation: 'register',
        success: true,
        timestamp: new Date(),
        metadata: { operation: 'registerPlugin', pluginName: plugin.metadata.name }
      });
      
      this.logger.info(`${ LOGGER_NAMESPACE } Plugin registered successfully`, {
        contextName: this.contextName,
        pluginId: plugin.id,
        pluginName: plugin.metadata.name
      });
      
      return Either.right(undefined as void);
      
    } catch (error) {
      // Emit error event
      this.emitRegistryEvent({
        pluginId: plugin.id,
        operation: 'register',
        success: false,
        error: error instanceof PluginError ? error : undefined,
        timestamp: new Date(),
        metadata: {
          operation: 'registerPlugin',
          error: error instanceof Error ? error.message : String(error)
        }
      });
      
      return Either.left(this.createRegistryError(
        'registerPlugin',
        `Failed to register plugin '${ plugin.id }': ${ error instanceof Error ? error.message : String(error) }`,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  async unregisterPlugin(pluginId: string): Promise<Either<ApplicationContextError, void>> {
    this.logger.debug(`${ LOGGER_NAMESPACE } Unregistering plugin`, {
      contextName: this.contextName,
      pluginId
    });
    
    try {
      // Check if plugin exists
      const plugin = this.getPlugin(pluginId);
      if (Maybe.isNothing(plugin)) {
        return Either.left(this.createPluginNotFoundError(pluginId, 'unregisterPlugin'));
      }
      
      // Use PluginManager's existing unregistration mechanism
      const unregisterResult = await this.pluginManager.unregisterPlugin(pluginId);
      
      if (Either.isLeft(unregisterResult)) {
        // Emit failure event
        this.emitRegistryEvent({
          pluginId,
          operation: 'unregister',
          success: false,
          error: unregisterResult.left instanceof PluginError ? unregisterResult.left : undefined,
          timestamp: new Date(),
          metadata: { operation: 'unregisterPlugin', error: unregisterResult.left.message }
        });
        
        return Either.left(ApplicationContextError.create(
          UnifiedErrorCode.PLUGIN_UNREGISTRATION_FAILED,
          `Failed to unregister plugin '${ pluginId }': ${ unregisterResult.left.message }`,
          'unregisterPlugin',
          { contextName: this.contextName, pluginId }
        ));
      }
      
      // Emit success event
      this.emitRegistryEvent({
        pluginId,
        operation: 'unregister',
        success: true,
        timestamp: new Date(),
        metadata: { operation: 'unregisterPlugin' }
      });
      
      this.logger.info(`${ LOGGER_NAMESPACE } Plugin unregistered successfully`, {
        contextName: this.contextName,
        pluginId
      });
      
      return Either.right(undefined as void);
      
    } catch (error) {
      // Emit error event
      this.emitRegistryEvent({
        pluginId,
        operation: 'unregister',
        success: false,
        error: error instanceof PluginError ? error : undefined,
        timestamp: new Date(),
        metadata: {
          operation: 'unregisterPlugin',
          error: error instanceof Error ? error.message : String(error)
        }
      });
      
      return Either.left(this.createRegistryError(
        'unregisterPlugin',
        `Failed to unregister plugin '${ pluginId }': ${ error instanceof Error ? error.message : String(error) }`,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  getPlugin(pluginId: string): Maybe<Plugin> {
    return this.pluginManager.getPlugin(pluginId);
  }
  
  getAllPlugins(): readonly Plugin[] {
    return this.pluginManager.getAllPlugins();
  }
  
  // ====================================================================================
  // HELPER METHODS
  // ====================================================================================
  
  /**
   * Emit registry event to registered handlers
   */
  private emitRegistryEvent(data: RegistryHookData): void {
    this.handleRegistryEvent(data);
  }
  
  private createRegistryError(
    operation: string,
    message: string,
    cause?: Error
  ): ApplicationContextError {
    return ApplicationContextError.create(
      UnifiedErrorCode.PLUGIN_REGISTRY_ERROR,
      message,
      operation,
      { contextName: this.contextName }
    );
  }
  
  private createPluginNotFoundError(
    pluginId: string,
    operation: string
  ): ApplicationContextError {
    return ApplicationContextError.create(
      UnifiedErrorCode.PLUGIN_NOT_FOUND,
      `Plugin '${ pluginId }' not found`,
      operation,
      { contextName: this.contextName, pluginId }
    );
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopRegistryMonitoring();
    this.registryEventHandlers.clear();
    
    this.logger.debug(`${ LOGGER_NAMESPACE } Service disposed`, {
      contextName: this.contextName
    });
  }
}
