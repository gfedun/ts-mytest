/**
 * @fileoverview Plugin Lifecycle Service - Dedicated Plugin State Management
 *
 * Handles all plugin lifecycle operations including state transitions,
 * synchronization, and individual plugin management operations.
 * Enhanced with ServiceHooks integration for real-time lifecycle monitoring.
 */

import { Either } from '@/either';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Logger } from '@/logger';
import { Maybe } from '@/maybe';
import {
  Plugin,
  PluginState
} from '@/plugin';
import { IPluginEngine } from '@/plugin/core/IPluginEngine';

// Import plugin integration types
import { LifecycleHookData } from '@/plugin/integration/ServiceHooks';
import { LifecyclePhase } from '@/plugin/types/LifecycleTypes';
import { ApplicationContextError } from '../ApplicationContextError';
import { ApplicationContextPhase } from '../types';

const LOGGER_NAMESPACE = "[PluginLifecycleService]" as const;

/**
 * Plugin lifecycle management operations
 */
export interface PluginLifecycleOperations {
  initializePlugin(pluginId: string): Promise<Either<ApplicationContextError, void>>;
  startPlugin(pluginId: string): Promise<Either<ApplicationContextError, void>>;
  stopPlugin(pluginId: string): Promise<Either<ApplicationContextError, void>>;
  destroyPlugin(pluginId: string): Promise<Either<ApplicationContextError, void>>;
  transitionPluginState(
    pluginId: string,
    targetState: PluginState
  ): Promise<Either<ApplicationContextError, void>>;
  synchronizePluginStates(targetPhase: ApplicationContextPhase): Promise<Either<ApplicationContextError, void>>;
}

/**
 * Plugin lifecycle status for monitoring
 */
export interface PluginLifecycleStatus {
  pluginId: string;
  currentState: PluginState;
  targetState?: PluginState;
  lastTransition: Date;
  transitionCount: number;
  isStable: boolean;
  errors: string[];
}

/**
 * Lifecycle event handler function type
 */
export type LifecycleEventHandler = (data: LifecycleHookData) => void;

/**
 * State transition configuration
 */
export interface StateTransitionConfig {
  allowedTransitions: Map<PluginState, PluginState[]>;
  transitionTimeouts: Map<PluginState, number>;
  retryAttempts: Map<PluginState, number>;
}

/**
 * PluginLifecycleService manages plugin state transitions and lifecycle operations.
 * Enhanced with ServiceHooks integration for real-time monitoring and automated management.
 *
 * This service provides focused functionality for:
 * - Individual plugin lifecycle management (initialize, start, stop, destroy)
 * - Plugin state transitions and validation
 * - Bulk plugin state synchronization during phase transitions
 * - Plugin notification of phase changes
 * - Real-time lifecycle monitoring and event handling
 * - Automated error recovery and state correction
 */
export class PluginLifecycleService
  implements PluginLifecycleOperations {
  private readonly pluginManager: PluginManager;
  private readonly logger: Logger;
  private readonly contextName: string;
  
  // ServiceHooks integration
  private pluginEngine: IPluginEngine | null = null;
  private lifecycleEventHandlers: Set<LifecycleEventHandler> = new Set();
  
  // Enhanced lifecycle management
  private pluginStatuses: Map<string, PluginLifecycleStatus> = new Map();
  private stateTransitionConfig: StateTransitionConfig;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private autoRecoveryEnabled: boolean = true;
  
  constructor(
    pluginManager: PluginManager,
    logger: Logger,
    contextName: string
  ) {
    this.pluginManager = pluginManager;
    this.logger = logger;
    this.contextName = contextName;
    
    this.initializeStateTransitionConfig();
    this.startLifecycleMonitoring();
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
   * Register a lifecycle event handler
   */
  onLifecycleEvent(handler: LifecycleEventHandler): void {
    this.lifecycleEventHandlers.add(handler);
    
    this.logger.debug(`${ LOGGER_NAMESPACE } Lifecycle event handler registered`, {
      contextName: this.contextName,
      handlerCount: this.lifecycleEventHandlers.size
    });
  }
  
  /**
   * Unregister a lifecycle event handler
   */
  offLifecycleEvent(handler: LifecycleEventHandler): void {
    this.lifecycleEventHandlers.delete(handler);
    
    this.logger.debug(`${ LOGGER_NAMESPACE } Lifecycle event handler unregistered`, {
      contextName: this.contextName,
      handlerCount: this.lifecycleEventHandlers.size
    });
  }
  
  /**
   * Handle lifecycle events from the core engine
   */
  private handleLifecycleEvent(data: LifecycleHookData): void {
    this.logger.debug(`${ LOGGER_NAMESPACE } Handling lifecycle event`, {
      contextName: this.contextName,
      pluginId: data.pluginId,
      phase: data.phase,
      previousPhase: data.previousPhase
    });
    
    // Update plugin status
    this.updatePluginLifecycleStatus(data);
    
    // Trigger auto-recovery if needed
    if (this.autoRecoveryEnabled && this.isErrorState(data.phase)) {
      this.attemptAutoRecovery(data.pluginId, data.phase);
    }
    
    // Notify registered handlers
    this.lifecycleEventHandlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        this.logger.error(`${ LOGGER_NAMESPACE } Error in lifecycle event handler`, {
          contextName: this.contextName,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }
  
  /**
   * Update plugin lifecycle status for monitoring
   */
  private updatePluginLifecycleStatus(data: LifecycleHookData): void {
    const existingStatus = this.pluginStatuses.get(data.pluginId);
    
    const status: PluginLifecycleStatus = {
      pluginId: data.pluginId,
      currentState: this.mapLifecyclePhaseToPluginState(data.phase),
      targetState: existingStatus?.targetState,
      lastTransition: new Date(),
      transitionCount: (existingStatus?.transitionCount || 0) + 1,
      isStable: this.isStableState(data.phase),
      errors: existingStatus?.errors || []
    };
    
    if (this.isErrorState(data.phase)) {
      status.errors.push(`Transition to ${ data.phase } failed at ${ new Date().toISOString() }`);
    }
    
    this.pluginStatuses.set(data.pluginId, status);
  }
  
  /**
   * Map lifecycle phase to plugin state
   */
  private mapLifecyclePhaseToPluginState(phase: LifecyclePhase): PluginState {
    switch (phase) {
      case LifecyclePhase.LOADING:
        return PluginState.Loading;
      case LifecyclePhase.LOADED:
        return PluginState.Loaded;
      case LifecyclePhase.INITIALIZING:
        return PluginState.Loading;
      case LifecyclePhase.INITIALIZED:
        return PluginState.Registered;
      case LifecyclePhase.STARTING:
        return PluginState.Loading;
      case LifecyclePhase.STARTED:
        return PluginState.Active;
      case LifecyclePhase.STOPPING:
        return PluginState.Loading;
      case LifecyclePhase.STOPPED:
        return PluginState.Suspended;
      case LifecyclePhase.UNLOADING:
        return PluginState.Loading;
      case LifecyclePhase.UNLOADED:
        return PluginState.Unloaded;
      default:
        return PluginState.Unknown;
    }
  }
  
  /**
   * Check if a lifecycle phase represents a stable state
   */
  private isStableState(phase: LifecyclePhase): boolean {
    return [
      LifecyclePhase.LOADED,
      LifecyclePhase.INITIALIZED,
      LifecyclePhase.STARTED,
      LifecyclePhase.STOPPED,
      LifecyclePhase.UNLOADED
    ].includes(phase);
  }
  
  /**
   * Check if a lifecycle phase represents an error state
   */
  private isErrorState(phase: LifecyclePhase): boolean {
    return phase.toString().includes('ERROR') || phase.toString().includes('FAILED');
  }
  
  /**
   * Attempt automatic recovery for failed plugins
   */
  private async attemptAutoRecovery(
    pluginId: string,
    failedPhase: LifecyclePhase
  ): Promise<void> {
    this.logger.info(`${ LOGGER_NAMESPACE } Attempting auto-recovery`, {
      contextName: this.contextName,
      pluginId,
      failedPhase
    });
    
    const status = this.pluginStatuses.get(pluginId);
    if (!status || status.errors.length > 3) {
      this.logger.warn(`${ LOGGER_NAMESPACE } Skipping auto-recovery - too many errors`, {
        contextName: this.contextName,
        pluginId,
        errorCount: status?.errors.length || 0
      });
      return;
    }
    
    try {
      // Attempt to transition to a safe state
      await this.transitionPluginState(pluginId, PluginState.Suspended);
    } catch (error) {
      this.logger.error(`${ LOGGER_NAMESPACE } Auto-recovery failed`, {
        contextName: this.contextName,
        pluginId,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }
  
  // ====================================================================================
  // ENHANCED STATE MANAGEMENT
  // ====================================================================================
  
  /**
   * Initialize state transition configuration
   */
  private initializeStateTransitionConfig(): void {
    const allowedTransitions = new Map<PluginState, PluginState[]>();
    allowedTransitions.set(PluginState.Unloaded, [PluginState.Loading]);
    allowedTransitions.set(PluginState.Loading, [PluginState.Loaded, PluginState.Error]);
    allowedTransitions.set(PluginState.Loaded, [PluginState.Registered, PluginState.Active, PluginState.Unloaded]);
    allowedTransitions.set(PluginState.Registered, [PluginState.Active, PluginState.Suspended, PluginState.Unloaded]);
    allowedTransitions.set(PluginState.Active, [PluginState.Suspended, PluginState.Unloaded]);
    allowedTransitions.set(PluginState.Suspended, [PluginState.Active, PluginState.Unloaded]);
    allowedTransitions.set(PluginState.Error, [PluginState.Unloaded, PluginState.Loading]);
    
    const transitionTimeouts = new Map<PluginState, number>();
    transitionTimeouts.set(PluginState.Loading, 30000);
    transitionTimeouts.set(PluginState.Registered, 10000);
    transitionTimeouts.set(PluginState.Active, 15000);
    transitionTimeouts.set(PluginState.Suspended, 10000);
    transitionTimeouts.set(PluginState.Unloaded, 5000);
    
    const retryAttempts = new Map<PluginState, number>();
    retryAttempts.set(PluginState.Loading, 3);
    retryAttempts.set(PluginState.Registered, 2);
    retryAttempts.set(PluginState.Active, 2);
    retryAttempts.set(PluginState.Suspended, 1);
    
    this.stateTransitionConfig = {
      allowedTransitions,
      transitionTimeouts,
      retryAttempts
    };
    
    this.logger.debug(`${ LOGGER_NAMESPACE } State transition configuration initialized`, {
      contextName: this.contextName
    });
  }
  
  /**
   * Start lifecycle monitoring
   */
  private startLifecycleMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    this.monitoringInterval = setInterval(() => {
      this.performLifecycleHealthCheck();
    }, 15000); // Check every 15 seconds
    
    this.logger.debug(`${ LOGGER_NAMESPACE } Lifecycle monitoring started`, {
      contextName: this.contextName,
      intervalMs: 15000
    });
  }
  
  /**
   * Stop lifecycle monitoring
   */
  private stopLifecycleMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.logger.debug(`${ LOGGER_NAMESPACE } Lifecycle monitoring stopped`, {
      contextName: this.contextName
    });
  }
  
  /**
   * Perform lifecycle health check
   */
  private performLifecycleHealthCheck(): void {
    const unstablePlugins = Array.from(this.pluginStatuses.values())
      .filter(status => !status.isStable || status.errors.length > 0);
    
    if (unstablePlugins.length > 0) {
      this.logger.warn(`${ LOGGER_NAMESPACE } Lifecycle health check found issues`, {
        contextName: this.contextName,
        unstableCount: unstablePlugins.length,
        totalPlugins: this.pluginStatuses.size
      });
    }
  }
  
  /**
   * Get plugin lifecycle status
   */
  getPluginLifecycleStatus(pluginId: string): PluginLifecycleStatus | null {
    return this.pluginStatuses.get(pluginId) || null;
  }
  
  /**
   * Get all plugin lifecycle statuses
   */
  getAllPluginLifecycleStatuses(): Map<string, PluginLifecycleStatus> {
    return new Map(this.pluginStatuses);
  }
  
  // ====================================================================================
  // INDIVIDUAL PLUGIN LIFECYCLE OPERATIONS
  // ====================================================================================
  
  async initializePlugin(pluginId: string): Promise<Either<ApplicationContextError, void>> {
    const plugin = this.getPlugin(pluginId);
    if (Maybe.isNothing(plugin)) {
      return Either.left(this.createPluginNotFoundError(pluginId, 'initializePlugin'));
    }
    
    const pluginInstance = plugin.value;
    
    this.logger.debug(`${ LOGGER_NAMESPACE } Initializing plugin`, {
      contextName: this.contextName,
      pluginId,
      pluginName: pluginInstance.metadata.name,
      currentState: pluginInstance.state
    });
    
    try {
      // Check if plugin is in a valid state for initialization
      if (pluginInstance.state !== PluginState.Loaded && pluginInstance.state !== PluginState.Registered) {
        return Either.left(this.createInvalidStateError(
          pluginId,
          pluginInstance.state,
          [PluginState.Loaded, PluginState.Registered],
          'initializePlugin'
        ));
      }
      
      // Emit lifecycle event for ServiceHooks integration
      this.emitLifecycleEvent({
        pluginId,
        plugin: pluginInstance,
        phase: LifecyclePhase.INITIALIZING,
        previousPhase: this.mapPluginStateToLifecyclePhase(pluginInstance.state),
        timestamp: new Date(),
        metadata: { operation: 'initializePlugin' }
      });
      
      // Since PluginManager doesn't have individual plugin methods,
      // we'll use the plugin instance directly if it has initialize method
      if (typeof (pluginInstance as any).initialize === 'function') {
        await (pluginInstance as any).initialize();
      }
      
      // Notify plugin of initialization
      await this.notifyPluginOfStateChange(pluginInstance, PluginState.Active);
      
      // Emit success event
      this.emitLifecycleEvent({
        pluginId,
        plugin: pluginInstance,
        phase: LifecyclePhase.INITIALIZED,
        previousPhase: LifecyclePhase.INITIALIZING,
        timestamp: new Date(),
        metadata: { operation: 'initializePlugin', success: true }
      });
      
      this.logger.info(`${ LOGGER_NAMESPACE } Plugin initialized successfully`, {
        contextName: this.contextName,
        pluginId,
        pluginName: pluginInstance.metadata.name
      });
      
      return Either.right(undefined as void);
      
    } catch (error) {
      // Emit error event
      this.emitLifecycleEvent({
        pluginId,
        plugin: pluginInstance,
        phase: LifecyclePhase.INITIALIZING,
        previousPhase: this.mapPluginStateToLifecyclePhase(pluginInstance.state),
        timestamp: new Date(),
        metadata: {
          operation: 'initializePlugin',
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      
      return Either.left(this.createLifecycleError(
        pluginId,
        'initializePlugin',
        error instanceof Error ? error : new Error(String(error))
      ));
    }
  }
  
  async startPlugin(pluginId: string): Promise<Either<ApplicationContextError, void>> {
    const plugin = this.getPlugin(pluginId);
    if (Maybe.isNothing(plugin)) {
      return Either.left(this.createPluginNotFoundError(pluginId, 'startPlugin'));
    }
    
    const pluginInstance = plugin.value;
    
    this.logger.debug(`${ LOGGER_NAMESPACE } Starting plugin`, {
      contextName: this.contextName,
      pluginId,
      pluginName: pluginInstance.metadata.name,
      currentState: pluginInstance.state
    });
    
    try {
      // Check if plugin is in a valid state for starting
      if (pluginInstance.state !== PluginState.Loaded && pluginInstance.state !== PluginState.Suspended) {
        return Either.left(this.createInvalidStateError(
          pluginId,
          pluginInstance.state,
          [PluginState.Loaded, PluginState.Suspended],
          'startPlugin'
        ));
      }
      
      // Emit lifecycle event
      this.emitLifecycleEvent({
        pluginId,
        plugin: pluginInstance,
        phase: LifecyclePhase.STARTING,
        previousPhase: this.mapPluginStateToLifecyclePhase(pluginInstance.state),
        timestamp: new Date(),
        metadata: { operation: 'startPlugin' }
      });
      
      // Use plugin instance directly if it has start method
      if (typeof (pluginInstance as any).start === 'function') {
        await (pluginInstance as any).start();
      }
      
      // Notify plugin of start
      await this.notifyPluginOfStateChange(pluginInstance, PluginState.Active);
      
      // Emit success event
      this.emitLifecycleEvent({
        pluginId,
        plugin: pluginInstance,
        phase: LifecyclePhase.STARTED,
        previousPhase: LifecyclePhase.STARTING,
        timestamp: new Date(),
        metadata: { operation: 'startPlugin', success: true }
      });
      
      this.logger.info(`${ LOGGER_NAMESPACE } Plugin started successfully`, {
        contextName: this.contextName,
        pluginId,
        pluginName: pluginInstance.metadata.name
      });
      
      return Either.right(undefined as void);
      
    } catch (error) {
      // Emit error event
      this.emitLifecycleEvent({
        pluginId,
        plugin: pluginInstance,
        phase: LifecyclePhase.STARTING,
        previousPhase: this.mapPluginStateToLifecyclePhase(pluginInstance.state),
        timestamp: new Date(),
        metadata: {
          operation: 'startPlugin',
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      
      return Either.left(this.createLifecycleError(
        pluginId,
        'startPlugin',
        error instanceof Error ? error : new Error(String(error))
      ));
    }
  }
  
  async stopPlugin(pluginId: string): Promise<Either<ApplicationContextError, void>> {
    const plugin = this.getPlugin(pluginId);
    if (Maybe.isNothing(plugin)) {
      return Either.left(this.createPluginNotFoundError(pluginId, 'stopPlugin'));
    }
    
    const pluginInstance = plugin.value;
    
    this.logger.debug(`${ LOGGER_NAMESPACE } Stopping plugin`, {
      contextName: this.contextName,
      pluginId,
      pluginName: pluginInstance.metadata.name,
      currentState: pluginInstance.state
    });
    
    try {
      // Check if plugin is in a valid state for stopping
      if (pluginInstance.state !== PluginState.Active) {
        return Either.left(this.createInvalidStateError(
          pluginId,
          pluginInstance.state,
          [PluginState.Active],
          'stopPlugin'
        ));
      }
      
      // Emit lifecycle event
      this.emitLifecycleEvent({
        pluginId,
        plugin: pluginInstance,
        phase: LifecyclePhase.STOPPING,
        previousPhase: LifecyclePhase.STARTED,
        timestamp: new Date(),
        metadata: { operation: 'stopPlugin' }
      });
      
      // Use plugin instance directly if it has stop method
      if (typeof (pluginInstance as any).stop === 'function') {
        await (pluginInstance as any).stop();
      }
      
      // Notify plugin of stop
      await this.notifyPluginOfStateChange(pluginInstance, PluginState.Suspended);
      
      // Emit success event
      this.emitLifecycleEvent({
        pluginId,
        plugin: pluginInstance,
        phase: LifecyclePhase.STOPPED,
        previousPhase: LifecyclePhase.STOPPING,
        timestamp: new Date(),
        metadata: { operation: 'stopPlugin', success: true }
      });
      
      this.logger.info(`${ LOGGER_NAMESPACE } Plugin stopped successfully`, {
        contextName: this.contextName,
        pluginId,
        pluginName: pluginInstance.metadata.name
      });
      
      return Either.right(undefined as void);
      
    } catch (error) {
      // Emit error event
      this.emitLifecycleEvent({
        pluginId,
        plugin: pluginInstance,
        phase: LifecyclePhase.STOPPING,
        previousPhase: LifecyclePhase.STARTED,
        timestamp: new Date(),
        metadata: {
          operation: 'stopPlugin',
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      
      return Either.left(this.createLifecycleError(
        pluginId,
        'stopPlugin',
        error instanceof Error ? error : new Error(String(error))
      ));
    }
  }
  
  async destroyPlugin(pluginId: string): Promise<Either<ApplicationContextError, void>> {
    const plugin = this.getPlugin(pluginId);
    if (Maybe.isNothing(plugin)) {
      return Either.left(this.createPluginNotFoundError(pluginId, 'destroyPlugin'));
    }
    
    const pluginInstance = plugin.value;
    
    this.logger.debug(`${ LOGGER_NAMESPACE } Destroying plugin`, {
      contextName: this.contextName,
      pluginId,
      pluginName: pluginInstance.metadata.name,
      currentState: pluginInstance.state
    });
    
    try {
      // Use plugin instance directly if it has destroy method
      if (typeof (pluginInstance as any).destroy === 'function') {
        await (pluginInstance as any).destroy();
      }
      
      // Notify plugin of destruction
      await this.notifyPluginOfStateChange(pluginInstance, PluginState.Unloaded);
      
      this.logger.info(`${ LOGGER_NAMESPACE } Plugin destroyed successfully`, {
        contextName: this.contextName,
        pluginId,
        pluginName: pluginInstance.metadata.name
      });
      
      return Either.right(undefined as void);
      
    } catch (error) {
      return Either.left(this.createLifecycleError(
        pluginId,
        'destroyPlugin',
        error instanceof Error ? error : new Error(String(error))
      ));
    }
  }
  
  // ====================================================================================
  // STATE TRANSITION OPERATIONS
  // ====================================================================================
  
  async transitionPluginState(
    pluginId: string,
    targetState: PluginState
  ): Promise<Either<ApplicationContextError, void>> {
    const plugin = this.getPlugin(pluginId);
    if (Maybe.isNothing(plugin)) {
      return Either.left(this.createPluginNotFoundError(pluginId, 'transitionPluginState'));
    }
    
    const pluginInstance = plugin.value;
    const currentState = pluginInstance.state;
    
    this.logger.debug(`${ LOGGER_NAMESPACE } Transitioning plugin state`, {
      contextName: this.contextName,
      pluginId,
      pluginName: pluginInstance.metadata.name,
      currentState,
      targetState
    });
    
    // Skip if already in target state
    if (currentState === targetState) {
      return Either.right(undefined as void);
    }
    
    try {
      // Determine the lifecycle operation needed
      switch (targetState) {
        case PluginState.Active:
          if (currentState === PluginState.Loaded || currentState === PluginState.Suspended) {
            return await this.startPlugin(pluginId);
          }
          break;
        
        case PluginState.Suspended:
          if (currentState === PluginState.Active) {
            return await this.stopPlugin(pluginId);
          }
          break;
        
        case PluginState.Unloaded:
          if (currentState === PluginState.Active) {
            const stopResult = await this.stopPlugin(pluginId);
            if (Either.isLeft(stopResult)) return stopResult;
          }
          return await this.destroyPlugin(pluginId);
        
        default:
          // For other state transitions, just notify the plugin
          await this.notifyPluginOfStateChange(pluginInstance, targetState);
          break;
      }
      
      return Either.right(undefined as void);
      
    } catch (error) {
      return Either.left(this.createLifecycleError(
        pluginId,
        'transitionPluginState',
        error instanceof Error ? error : new Error(String(error))
      ));
    }
  }
  
  async synchronizePluginStates(targetPhase: ApplicationContextPhase): Promise<Either<ApplicationContextError, void>> {
    this.logger.debug(`${ LOGGER_NAMESPACE } Synchronizing plugin states with phase`, {
      contextName: this.contextName,
      targetPhase
    });
    
    try {
      const allPlugins = this.pluginManager.getAllPlugins();
      const expectedState = this.getExpectedPluginStateForPhase(targetPhase);
      
      // Process plugins sequentially to avoid overwhelming the system
      const errors: string[] = [];
      
      for (const plugin of allPlugins) {
        const result = await this.transitionPluginState(plugin.id, expectedState);
        if (Either.isLeft(result)) {
          errors.push(`Plugin '${ plugin.id }': ${ result.left.message }`);
        }
      }
      
      if (errors.length > 0) {
        return Either.left(ApplicationContextError.create(
          UnifiedErrorCode.PLUGIN_EXECUTION_FAILED,
          `Failed to synchronize some plugins: ${ errors.join(', ') }`,
          'synchronizePluginStates',
          { contextName: this.contextName, targetPhase }
        ));
      }
      
      this.logger.info(`${ LOGGER_NAMESPACE } Plugin state synchronization completed`, {
        contextName: this.contextName,
        targetPhase,
        pluginCount: allPlugins.length,
        targetState: expectedState
      });
      
      return Either.right(undefined as void);
      
    } catch (error) {
      return Either.left(this.createLifecycleError(
        'all',
        'synchronizePluginStates',
        error instanceof Error ? error : new Error(String(error))
      ));
    }
  }
  
  // ====================================================================================
  // HELPER METHODS
  // ====================================================================================
  
  /**
   * Emit lifecycle event to registered handlers
   */
  private emitLifecycleEvent(data: LifecycleHookData): void {
    this.handleLifecycleEvent(data);
  }
  
  /**
   * Map plugin state to lifecycle phase
   */
  private mapPluginStateToLifecyclePhase(state: PluginState): LifecyclePhase {
    switch (state) {
      case PluginState.Loading:
        return LifecyclePhase.LOADING;
      case PluginState.Loaded:
        return LifecyclePhase.LOADED;
      case PluginState.Registered:
        return LifecyclePhase.INITIALIZED;
      case PluginState.Active:
        return LifecyclePhase.STARTED;
      case PluginState.Suspended:
        return LifecyclePhase.STOPPED;
      case PluginState.Unloaded:
        return LifecyclePhase.UNLOADED;
      default:
        return LifecyclePhase.LOADED;
    }
  }
  
  /**
   * Get expected plugin state for a given application context phase
   */
  private getExpectedPluginStateForPhase(phase: ApplicationContextPhase): PluginState {
    switch (phase) {
      case ApplicationContextPhase.Initializing:
        return PluginState.Loaded;
      case ApplicationContextPhase.Running:
        return PluginState.Active;
      case ApplicationContextPhase.Stopping:
        return PluginState.Suspended;
      case ApplicationContextPhase.Stopped:
        return PluginState.Suspended;
      default:
        return PluginState.Loaded;
    }
  }
  
  private getPlugin(pluginId: string): Maybe<Plugin> {
    return this.pluginManager.getPlugin(pluginId);
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
  
  private createInvalidStateError(
    pluginId: string,
    currentState: PluginState,
    allowedStates: PluginState[],
    operation: string
  ): ApplicationContextError {
    return ApplicationContextError.create(
      UnifiedErrorCode.INVALID_OPERATION,
      `Plugin '${ pluginId }' is in state '${ currentState }' but operation '${ operation }' requires one of: [${ allowedStates.join(
        ', ') }]`,
      operation,
      { contextName: this.contextName, pluginId, currentState, allowedStates }
    );
  }
  
  private createLifecycleError(
    pluginId: string,
    operation: string,
    cause: Error
  ): ApplicationContextError {
    return ApplicationContextError.create(
      UnifiedErrorCode.PLUGIN_LIFECYCLE_ERROR,
      `Plugin lifecycle operation '${ operation }' failed for plugin '${ pluginId }': ${ cause.message }`,
      operation,
      { contextName: this.contextName, pluginId }
    );
  }
  
  private async notifyPluginOfStateChange(
    _plugin: Plugin,
    _targetState: PluginState
  ): Promise<void> {
    // Placeholder for plugin state change notification
    // This would integrate with the actual plugin notification system
  }
  
  // Implement remaining interface methods...
  async destroyPlugin(_pluginId: string): Promise<Either<ApplicationContextError, void>> {
    // Implementation for destroy plugin
    return Either.right(undefined as void);
  }
  
  async transitionPluginState(
    _pluginId: string,
    _targetState: PluginState
  ): Promise<Either<ApplicationContextError, void>> {
    // Implementation for state transition
    return Either.right(undefined as void);
  }
  
  async synchronizePluginStates(_targetPhase: ApplicationContextPhase): Promise<Either<ApplicationContextError, void>> {
    // Implementation for bulk synchronization
    return Either.right(undefined as void);
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopLifecycleMonitoring();
    this.lifecycleEventHandlers.clear();
    this.pluginStatuses.clear();
    
    this.logger.debug(`${ LOGGER_NAMESPACE } Service disposed`, {
      contextName: this.contextName
    });
  }
}
