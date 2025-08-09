/**
 * @fileoverview Essential Lifecycle Manager
 *
 * Focused lifecycle manager that handles only core state transitions and
 * plugin lifecycle coordination. Hooks, events, and metrics are delegated
 * to the context package services.
 */

import { Either } from '@/either';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { ServiceRegistry } from '@/service';
import { PluginError as PluginError } from '../errors/PluginError';
import {
  Plugin,
  PluginLookup,
  PluginState
} from '../types/CoreTypes';
import { LifecyclePhase } from '../types/LifecycleTypes';

/**
 * Lifecycle operation result
 */
export interface LifecycleOperationResult {
  /** Whether the operation succeeded */
  success: boolean;
  /** Plugin that was operated on */
  plugin: Plugin;
  /** Previous state (if state changed) */
  previousState?: PluginState;
  /** New state (if state changed) */
  newState?: PluginState;
  /** Operation duration in milliseconds */
  duration: number;
}

/**
 * Lifecycle batch operation result
 */
export interface LifecycleBatchResult {
  /** Total plugins processed */
  totalPlugins: number;
  /** Number of successful operations */
  successCount: number;
  /** Number of failed operations */
  failureCount: number;
  /** Individual operation results */
  results: LifecycleOperationResult[];
  /** Total duration in milliseconds */
  duration: number;
}

/**
 * Simple lifecycle callback for minimal integration
 */
export type LifecycleCallback = (
  phase: LifecyclePhase,
  plugin: Plugin,
  success: boolean,
  error?: Error
) => void;

/**
 * Essential Lifecycle Manager
 *
 * Handles ONLY core lifecycle operations and state transitions:
 * - Plugin state validation and transitions
 * - Plugin lifecycle method coordination (initialize, start, stop, cleanup)
 * - Basic operation sequencing
 * - Essential error handling
 *
 * Does NOT handle:
 * - Complex hook systems (context services)
 * - Event broadcasting (context services)
 * - Metrics collection (context services)
 * - Performance monitoring (context services)
 * - Complex lifecycle orchestration (context services)
 * - Dependency-aware lifecycle management (handled by engine)
 */
export class EssentialLifecycleManager {
  private lifecycleCallback?: LifecycleCallback;
  
  /**
   * Set optional lifecycle callback for minimal integration
   */
  public setLifecycleCallback(callback: LifecycleCallback): void {
    this.lifecycleCallback = callback;
  }
  
  /**
   * Initialize a plugin
   */
  public async initializePlugin(
    plugin: Plugin,
    config: Record<string, any>,
    pluginLookup: PluginLookup
  ): Promise<Either<PluginError, LifecycleOperationResult>> {
    const startTime = Date.now();
    
    // Validate current state
    if (plugin.state !== PluginState.Loaded) {
      const error = PluginError.create(
        UnifiedErrorCode.INVALID_STATE_TRANSITION,
        `Cannot initialize plugin from state: ${ plugin.state }`,
        'initializePlugin',
        { pluginId: plugin.id }
      );
      
      this.notifyCallback(LifecyclePhase.INITIALIZE, plugin, false, error);
      return Either.left(error);
    }
    
    try {
      // Attempt plugin initialization
      const result = await plugin.initialize(config, pluginLookup);
      const duration = Date.now() - startTime;
      
      if (Either.isLeft(result)) {
        this.notifyCallback(LifecyclePhase.INITIALIZE, plugin, false, result.left);
        return Either.left(result.left);
      }
      
      // Plugin initialization succeeded
      const operationResult: LifecycleOperationResult = {
        success: true,
        plugin,
        previousState: PluginState.Loaded,
        newState: plugin.state, // Should be updated by plugin
        duration
      };
      
      this.notifyCallback(LifecyclePhase.INITIALIZE, plugin, true);
      return Either.right(operationResult);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const pluginError = PluginError.create(
        UnifiedErrorCode.PLUGIN_INITIALIZATION_FAILED,
        `Plugin initialization failed: ${ error instanceof Error ? error.message : String(error) }`,
        'initializePlugin',
        { pluginId: plugin.id },
        undefined,
        error instanceof Error ? error : undefined
      );
      
      this.notifyCallback(LifecyclePhase.INITIALIZE, plugin, false, pluginError);
      return Either.left(pluginError);
    }
  }
  
  /**
   * Start a plugin
   */
  public async startPlugin(
    plugin: Plugin,
    serviceRegistry: ServiceRegistry
  ): Promise<Either<PluginError, LifecycleOperationResult>> {
    const startTime = Date.now();
    
    // Validate current state
    if (plugin.state !== PluginState.Loaded) {
      const error = PluginError.create(
        UnifiedErrorCode.INVALID_STATE_TRANSITION,
        `Cannot start plugin from state: ${ plugin.state }`,
        'startPlugin',
        { pluginId: plugin.id }
      );
      
      this.notifyCallback(LifecyclePhase.START, plugin, false, error);
      return Either.left(error);
    }
    
    try {
      // Attempt plugin start
      const result = await plugin.start(serviceRegistry);
      const duration = Date.now() - startTime;
      
      if (Either.isLeft(result)) {
        this.notifyCallback(LifecyclePhase.START, plugin, false, result.left);
        return Either.left(result.left);
      }
      
      // Plugin start succeeded
      const operationResult: LifecycleOperationResult = {
        success: true,
        plugin,
        previousState: PluginState.Loaded,
        newState: plugin.state, // Should be Active now
        duration
      };
      
      this.notifyCallback(LifecyclePhase.START, plugin, true);
      return Either.right(operationResult);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const pluginError = PluginError.create(
        UnifiedErrorCode.PLUGIN_START_LIFECYCLE_FAILED,
        `Plugin start failed: ${ error instanceof Error ? error.message : String(error) }`,
        'startPlugin',
        { pluginId: plugin.id },
        undefined,
        error instanceof Error ? error : undefined
      );
      
      this.notifyCallback(LifecyclePhase.START, plugin, false, pluginError);
      return Either.left(pluginError);
    }
  }
  
  /**
   * Stop a plugin
   */
  public async stopPlugin(plugin: Plugin): Promise<Either<PluginError, LifecycleOperationResult>> {
    const startTime = Date.now();
    
    // Validate current state
    if (plugin.state !== PluginState.Active) {
      const error = PluginError.create(
        UnifiedErrorCode.INVALID_STATE_TRANSITION,
        `Cannot stop plugin from state: ${ plugin.state }`,
        'stopPlugin',
        { pluginId: plugin.id }
      );
      
      this.notifyCallback(LifecyclePhase.STOP, plugin, false, error);
      return Either.left(error);
    }
    
    try {
      // Attempt plugin stop
      const result = await plugin.stop();
      const duration = Date.now() - startTime;
      
      if (Either.isLeft(result)) {
        this.notifyCallback(LifecyclePhase.STOP, plugin, false, result.left);
        return Either.left(result.left);
      }
      
      // Plugin stop succeeded
      const operationResult: LifecycleOperationResult = {
        success: true,
        plugin,
        previousState: PluginState.Active,
        newState: plugin.state, // Should be Suspended now
        duration
      };
      
      this.notifyCallback(LifecyclePhase.STOP, plugin, true);
      return Either.right(operationResult);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      const pluginError = PluginError.create(
        UnifiedErrorCode.PLUGIN_EXECUTION_FAILED,
        `Plugin stop failed: ${ error instanceof Error ? error.message : String(error) }`,
        'stopPlugin',
        { pluginId: plugin.id },
        undefined,
        error instanceof Error ? error : undefined
      );
      
      this.notifyCallback(LifecyclePhase.STOP, plugin, false, pluginError);
      return Either.left(pluginError);
    }
  }
  
  /**
   * Cleanup a plugin
   */
  public async cleanupPlugin(plugin: Plugin): Promise<LifecycleOperationResult> {
    const startTime = Date.now();
    
    try {
      // Plugin cleanup should always be attempted regardless of state
      await plugin.cleanup();
      const duration = Date.now() - startTime;
      
      const operationResult: LifecycleOperationResult = {
        success: true,
        plugin,
        previousState: plugin.state,
        newState: PluginState.Unloaded,
        duration
      };
      
      this.notifyCallback(LifecyclePhase.CLEANUP, plugin, true);
      return operationResult;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Cleanup failures are logged but not considered critical errors
      const operationResult: LifecycleOperationResult = {
        success: false,
        plugin,
        previousState: plugin.state,
        newState: plugin.state, // State unchanged on cleanup failure
        duration
      };
      
      this.notifyCallback(LifecyclePhase.CLEANUP, plugin, false,
        error instanceof Error ? error : new Error(String(error))
      );
      return operationResult;
    }
  }
  
  /**
   * Initialize multiple plugins in sequence
   */
  public async initializePlugins(
    plugins: Plugin[],
    configs: Record<string, any>[],
    pluginLookup: PluginLookup
  ): Promise<LifecycleBatchResult> {
    const startTime = Date.now();
    const results: LifecycleOperationResult[] = [];
    let successCount = 0;
    let failureCount = 0;
    
    for (let i = 0; i < plugins.length; i++) {
      const plugin = plugins[i];
      const config = configs[i] || {};
      
      const result = await this.initializePlugin(plugin, config, pluginLookup);
      
      if (Either.isRight(result)) {
        results.push(result.right);
        successCount++;
      } else {
        // Create a failed operation result
        const failedResult: LifecycleOperationResult = {
          success: false,
          plugin,
          duration: 0
        };
        results.push(failedResult);
        failureCount++;
      }
    }
    
    return {
      totalPlugins: plugins.length,
      successCount,
      failureCount,
      results,
      duration: Date.now() - startTime
    };
  }
  
  /**
   * Start multiple plugins in sequence
   */
  public async startPlugins(
    plugins: Plugin[],
    serviceRegistry: ServiceRegistry
  ): Promise<LifecycleBatchResult> {
    const startTime = Date.now();
    const results: LifecycleOperationResult[] = [];
    let successCount = 0;
    let failureCount = 0;
    
    for (const plugin of plugins) {
      const result = await this.startPlugin(plugin, serviceRegistry);
      
      if (Either.isRight(result)) {
        results.push(result.right);
        successCount++;
      } else {
        // Create a failed operation result
        const failedResult: LifecycleOperationResult = {
          success: false,
          plugin,
          duration: 0
        };
        results.push(failedResult);
        failureCount++;
      }
    }
    
    return {
      totalPlugins: plugins.length,
      successCount,
      failureCount,
      results,
      duration: Date.now() - startTime
    };
  }
  
  /**
   * Stop multiple plugins in sequence
   */
  public async stopPlugins(plugins: Plugin[]): Promise<LifecycleBatchResult> {
    const startTime = Date.now();
    const results: LifecycleOperationResult[] = [];
    let successCount = 0;
    let failureCount = 0;
    
    for (const plugin of plugins) {
      const result = await this.stopPlugin(plugin);
      
      if (Either.isRight(result)) {
        results.push(result.right);
        successCount++;
      } else {
        // Create a failed operation result
        const failedResult: LifecycleOperationResult = {
          success: false,
          plugin,
          duration: 0
        };
        results.push(failedResult);
        failureCount++;
      }
    }
    
    return {
      totalPlugins: plugins.length,
      successCount,
      failureCount,
      results,
      duration: Date.now() - startTime
    };
  }
  
  /**
   * Cleanup multiple plugins (always succeeds, individual failures logged)
   */
  public async cleanupPlugins(plugins: Plugin[]): Promise<LifecycleBatchResult> {
    const startTime = Date.now();
    const results: LifecycleOperationResult[] = [];
    let successCount = 0;
    let failureCount = 0;
    
    for (const plugin of plugins) {
      const result = await this.cleanupPlugin(plugin);
      results.push(result);
      
      if (result.success) {
        successCount++;
      } else {
        failureCount++;
      }
    }
    
    return {
      totalPlugins: plugins.length,
      successCount,
      failureCount,
      results,
      duration: Date.now() - startTime
    };
  }
  
  /**
   * Validate if a plugin can transition to a specific state
   */
  public canTransitionTo(
    plugin: Plugin,
    targetState: PluginState
  ): boolean {
    const currentState = plugin.state;
    
    // Define valid state transitions
    switch (targetState) {
      case PluginState.Loaded:
        return currentState === PluginState.Registered;
      
      case PluginState.Active:
        return currentState === PluginState.Loaded;
      
      case PluginState.Suspended:
        return currentState === PluginState.Active;
      
      case PluginState.Failed:
        return true; // Can fail from any state
      
      case PluginState.Unloaded:
        return currentState === PluginState.Suspended ||
          currentState === PluginState.Failed ||
          currentState === PluginState.Loaded;
      
      default:
        return false;
    }
  }
  
  /**
   * Get valid next states for a plugin
   */
  public getValidNextStates(plugin: Plugin): PluginState[] {
    const validStates: PluginState[] = [];
    
    for (const state of Object.values(PluginState)) {
      if (this.canTransitionTo(plugin, state)) {
        validStates.push(state);
      }
    }
    
    return validStates;
  }
  
  // ==========================================================================
  // PRIVATE IMPLEMENTATION
  // ==========================================================================
  
  /**
   * Notify lifecycle callback if set
   */
  private notifyCallback(
    phase: LifecyclePhase,
    plugin: Plugin,
    success: boolean,
    error?: Error
  ): void {
    if (this.lifecycleCallback) {
      try {
        this.lifecycleCallback(phase, plugin, success, error);
      } catch (callbackError) {
        // Ignore callback errors to prevent cascading failures
        console.error('Lifecycle callback failed:', callbackError);
      }
    }
  }
}

/**
 * Utility functions for lifecycle operations
 */
export const LifecycleUtils = {
  /**
   * Check if a plugin is in a terminal state
   */
  isTerminalState(state: PluginState): boolean {
    return state === PluginState.Failed || state === PluginState.Unloaded;
  },
  
  /**
   * Check if a plugin is in an active state
   */
  isActiveState(state: PluginState): boolean {
    return state === PluginState.Active;
  },
  
  /**
   * Check if a plugin is ready to start
   */
  isReadyToStart(state: PluginState): boolean {
    return state === PluginState.Loaded;
  },
  
  /**
   * Check if a plugin can be stopped
   */
  canStop(state: PluginState): boolean {
    return state === PluginState.Active;
  },
  
  /**
   * Get the expected next state for a lifecycle phase
   */
  getExpectedStateAfter(phase: LifecyclePhase): PluginState | null {
    switch (phase) {
      case LifecyclePhase.INITIALIZE:
        return PluginState.Loaded;
      case LifecyclePhase.START:
        return PluginState.Active;
      case LifecyclePhase.STOP:
        return PluginState.Suspended;
      case LifecyclePhase.CLEANUP:
        return PluginState.Unloaded;
      default:
        return null;
    }
  }
};

/**
 * Factory function to create a lifecycle manager
 */
export function createLifecycleManager(): EssentialLifecycleManager {
  return new EssentialLifecycleManager();
}

// Export the main class as default
export default EssentialLifecycleManager;
