/**
 * @fileoverview Plugin Event Service - Dedicated Plugin Event Broadcasting and Handling
 *
 * Handles all plugin event operations including broadcasting, subscription,
 * phase change notifications, and error handling.
 * Enhanced with ServiceHooks integration for comprehensive event management.
 */

import { Either } from '@/either';
import { EventHub } from '@/eventhub';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Logger } from '@/logger';
import { IPluginEngine } from '@/plugin/core/IPluginEngine';

import { ErrorHookData } from '@/plugin/integration/ServiceHooks';
import { ApplicationContextError } from '../ApplicationContextError';
import { ApplicationContextPhase } from '../types';

const LOGGER_NAMESPACE = "[PluginEventService]" as const;

/**
 * Plugin event listener function type
 */
export type PluginEventListener = (
  eventType: string,
  pluginId: string,
  data: any
) => void | Promise<void>;

/**
 * Error event handler function type
 */
export type ErrorEventHandler = (data: ErrorHookData) => void;

/**
 * Plugin event data structure
 */
export interface PluginEventData {
  eventType: string;
  pluginId: string;
  pluginName?: string;
  timestamp: Date;
  contextName: string;
  data: any;
}

/**
 * Plugin phase change event data
 */
export interface PluginPhaseChangeEventData {
  pluginId: string;
  pluginName: string;
  phase: ApplicationContextPhase;
  contextName: string;
  timestamp: Date;
}

/**
 * Plugin error event data
 */
export interface PluginErrorEventData {
  pluginId: string;
  pluginName: string;
  error: Error;
  contextName: string;
  timestamp: Date;
  recoverable: boolean;
}

/**
 * PluginEventService manages plugin event broadcasting and handling operations.
 * Enhanced with ServiceHooks integration for comprehensive event management.
 *
 * This service provides focused functionality for:
 * - Plugin event broadcasting and subscription
 * - Phase change notifications to plugins
 * - Plugin error handling and propagation
 * - Event filtering and routing
 * - ServiceHooks error event integration
 */
export class PluginEventService {
  private readonly eventHub: EventHub;
  private readonly logger: Logger;
  private readonly contextName: string;
  
  // ServiceHooks integration
  private pluginEngine: IPluginEngine | null = null;
  private errorEventHandlers: Set<ErrorEventHandler> = new Set();
  
  // Event management
  private eventListeners: Map<string, Set<PluginEventListener>> = new Map();
  private eventHistory: PluginEventData[] = [];
  private maxHistorySize: number = 1000;
  
  constructor(
    eventHub: EventHub,
    logger: Logger,
    contextName: string
  ) {
    this.eventHub = eventHub;
    this.logger = logger;
    this.contextName = contextName;
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
   * Register an error event handler
   */
  onErrorEvent(handler: ErrorEventHandler): void {
    this.errorEventHandlers.add(handler);
    
    this.logger.debug(`${ LOGGER_NAMESPACE } Error event handler registered`, {
      contextName: this.contextName,
      handlerCount: this.errorEventHandlers.size
    });
  }
  
  /**
   * Unregister an error event handler
   */
  offErrorEvent(handler: ErrorEventHandler): void {
    this.errorEventHandlers.delete(handler);
    
    this.logger.debug(`${ LOGGER_NAMESPACE } Error event handler unregistered`, {
      contextName: this.contextName,
      handlerCount: this.errorEventHandlers.size
    });
  }
  
  /**
   * Handle error events from the core engine
   */
  private handleErrorEvent(data: ErrorHookData): void {
    this.logger.debug(`${ LOGGER_NAMESPACE } Handling error event`, {
      contextName: this.contextName,
      pluginId: data.pluginId,
      context: data.context,
      recoverable: data.recoverable
    });
    
    // Broadcast error event
    this.broadcastPluginError({
      pluginId: data.pluginId || 'unknown',
      pluginName: data.pluginId || 'unknown',
      error: data.error as Error,
      contextName: this.contextName,
      timestamp: data.timestamp,
      recoverable: data.recoverable
    });
    
    // Notify registered handlers
    this.errorEventHandlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        this.logger.error(`${ LOGGER_NAMESPACE } Error in error event handler`, {
          contextName: this.contextName,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }
  
  // ====================================================================================
  // EVENT MANAGEMENT OPERATIONS
  // ====================================================================================
  
  /**
   * Subscribe to plugin events
   */
  subscribeToPluginEvent(
    eventType: string,
    listener: PluginEventListener
  ): void {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, new Set());
    }
    
    this.eventListeners.get(eventType)!.add(listener);
    
    this.logger.debug(`${ LOGGER_NAMESPACE } Event listener registered`, {
      contextName: this.contextName,
      eventType,
      listenerCount: this.eventListeners.get(eventType)!.size
    });
  }
  
  /**
   * Unsubscribe from plugin events
   */
  unsubscribeFromPluginEvent(
    eventType: string,
    listener: PluginEventListener
  ): void {
    const listeners = this.eventListeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
      
      if (listeners.size === 0) {
        this.eventListeners.delete(eventType);
      }
      
      this.logger.debug(`${ LOGGER_NAMESPACE } Event listener unregistered`, {
        contextName: this.contextName,
        eventType,
        remainingCount: listeners.size
      });
    }
  }
  
  /**
   * Broadcast a plugin event
   */
  async broadcastPluginEvent(eventData: PluginEventData): Promise<Either<ApplicationContextError, void>> {
    try {
      this.logger.debug(`${ LOGGER_NAMESPACE } Broadcasting plugin event`, {
        contextName: this.contextName,
        eventType: eventData.eventType,
        pluginId: eventData.pluginId
      });
      
      // Add to event history
      this.addToEventHistory(eventData);
      
      // Notify specific event listeners
      const listeners = this.eventListeners.get(eventData.eventType);
      if (listeners) {
        for (const listener of listeners) {
          try {
            await listener(eventData.eventType, eventData.pluginId, eventData.data);
          } catch (error) {
            this.logger.error(`${ LOGGER_NAMESPACE } Error in event listener`, {
              contextName: this.contextName,
              eventType: eventData.eventType,
              pluginId: eventData.pluginId,
              error: error instanceof Error ? error.message : String(error)
            });
          }
        }
      }
      
      // Broadcast via EventHub
      this.eventHub.emit('plugin-event', eventData);
      
      return Either.right(undefined as void);
      
    } catch (error) {
      return Either.left(ApplicationContextError.create(
        UnifiedErrorCode.EVENT_BROADCAST_FAILED,
        `Failed to broadcast plugin event: ${ error instanceof Error ? error.message : String(error) }`,
        'broadcastPluginEvent',
        { contextName: this.contextName, eventType: eventData.eventType, pluginId: eventData.pluginId }
      ));
    }
  }
  
  /**
   * Broadcast plugin phase change event
   */
  async broadcastPhaseChange(phaseData: PluginPhaseChangeEventData): Promise<Either<ApplicationContextError, void>> {
    const eventData: PluginEventData = {
      eventType: 'phase-change',
      pluginId: phaseData.pluginId,
      pluginName: phaseData.pluginName,
      timestamp: phaseData.timestamp,
      contextName: phaseData.contextName,
      data: { phase: phaseData.phase }
    };
    
    return this.broadcastPluginEvent(eventData);
  }
  
  /**
   * Broadcast plugin error event
   */
  async broadcastPluginError(errorData: PluginErrorEventData): Promise<Either<ApplicationContextError, void>> {
    const eventData: PluginEventData = {
      eventType: 'plugin-error',
      pluginId: errorData.pluginId,
      pluginName: errorData.pluginName,
      timestamp: errorData.timestamp,
      contextName: errorData.contextName,
      data: {
        error: errorData.error.message,
        stack: errorData.error.stack,
        recoverable: errorData.recoverable
      }
    };
    
    return this.broadcastPluginEvent(eventData);
  }
  
  /**
   * Get event history
   */
  getEventHistory(
    eventType?: string,
    pluginId?: string
  ): PluginEventData[] {
    let filteredHistory = this.eventHistory;
    
    if (eventType) {
      filteredHistory = filteredHistory.filter(event => event.eventType === eventType);
    }
    
    if (pluginId) {
      filteredHistory = filteredHistory.filter(event => event.pluginId === pluginId);
    }
    
    return [...filteredHistory];
  }
  
  /**
   * Clear event history
   */
  clearEventHistory(): void {
    this.eventHistory.length = 0;
    
    this.logger.debug(`${ LOGGER_NAMESPACE } Event history cleared`, {
      contextName: this.contextName
    });
  }
  
  // ====================================================================================
  // HELPER METHODS
  // ====================================================================================
  
  /**
   * Add event to history with size management
   */
  private addToEventHistory(eventData: PluginEventData): void {
    this.eventHistory.push(eventData);
    
    // Trim history if it exceeds max size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.splice(0, this.eventHistory.length - this.maxHistorySize);
    }
  }
  
  /**
   * Emit error event for ServiceHooks integration
   */
  private emitErrorEvent(data: ErrorHookData): void {
    this.handleErrorEvent(data);
  }
  
  /**
   * Clean up resources
   */
  dispose(): void {
    this.eventListeners.clear();
    this.errorEventHandlers.clear();
    this.eventHistory.length = 0;
    
    this.logger.debug(`${ LOGGER_NAMESPACE } Service disposed`, {
      contextName: this.contextName
    });
  }
}
