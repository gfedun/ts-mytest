import { EventHub } from '@/eventhub';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Logger } from '@/logger';
import { Plugin } from '@/plugin';
import { ApplicationContext } from './ApplicationContext';
import { ApplicationContextError } from './ApplicationContextError';
import {
  ApplicationContextPhase
} from './types';

import {
  LifecycleHookData,
  LoadingHookData,
  DependencyHookData,
  ConfigurationHookData,
  RegistryHookData,
  ErrorHookData,
  MetricsHookData
} from '@/plugin/integration/ServiceHooks';

const LOGGER_NAMESPACE = "[ApplicationContextEventsBridge]" as const;

/**
 * Enhanced event mapping for ContextBridge integration
 */
interface ContextBridgeEventMap {
  'lifecycle': LifecycleHookData;
  'loading': LoadingHookData;
  'dependency': DependencyHookData;
  'configuration': ConfigurationHookData;
  'registry': RegistryHookData;
  'error': ErrorHookData;
  'metrics': MetricsHookData;
}

/**
 * Bridge that connects PluginManager events to ApplicationContext events
 * Enhanced with ContextBridge integration for plugin core engine events
 *
 * This class listens to both legacy PluginManager events and new ContextBridge events,
 * transforming them into context-level events that are broadcast through the EventHub,
 * providing a unified event stream for all ApplicationContext-related activities.
 */
export class ApplicationContextEventsBridge {
  private readonly context: ApplicationContext<any>;
  private readonly eventHub: EventHub;
  private readonly logger: Logger;
  private initialized = false;
  private eventListeners = new Map<string, Function>();
  private contextBridgeListeners = new Map<string, Function>();
  
  // Enhanced integration features
  private eventTransformationEnabled = true;
  private backwardCompatibilityMode = true;
  private eventFilteringEnabled = false;
  private eventPerformanceTracking = true;
  private eventMetrics = new Map<string, { count: number; lastEmitted: Date; avgDuration: number }>();
  
  constructor(
    context: ApplicationContext<any>,
    eventHub: EventHub,
    logger: Logger
  ) {
    this.context = context;
    this.eventHub = eventHub;
    this.logger = logger;
  }
  
  /**
   * Initialize the events bridge by setting up all event listeners
   * Enhanced with ContextBridge event handling
   */
  initialize(): void {
    if (this.initialized) {
      this.logger.warn(`${LOGGER_NAMESPACE} Already initialized`);
      return;
    }
    
    try {
      this.logger.debug(`${LOGGER_NAMESPACE} Initializing events bridge`, {
        contextName: this.context.getName(),
        backwardCompatibilityMode: this.backwardCompatibilityMode,
        eventTransformationEnabled: this.eventTransformationEnabled
      });
      
      // Setup legacy plugin event bridges (for backward compatibility)
      if (this.backwardCompatibilityMode) {
        this.setupLegacyPluginEventBridge();
        // Remove calls to non-existent methods
        // this.setupContextEventBridge();
        // this.setupQueueEventBridge();
        // this.setupTopicEventBridge();
        // this.setupPortEventBridge();
      }
      
      // Setup new ContextBridge event handlers
      this.setupContextBridgeEventHandlers();
      
      this.initialized = true;
      
      this.logger.info(`${LOGGER_NAMESPACE} Events bridge initialized successfully`, {
        contextName: this.context.getName(),
        legacyBridgedEvents: this.eventListeners.size,
        contextBridgeEvents: this.contextBridgeListeners.size,
        totalEvents: this.eventListeners.size + this.contextBridgeListeners.size
      });
      
    } catch (error) {
      const contextError = ApplicationContextError.create(
        UnifiedErrorCode.CONTEXT_SERVICE_INITIALIZATION_FAILED,
        'Failed to initialize ApplicationContextEventsBridge',
        'initialize',
        {
          contextName: this.context.getName(),
          serviceName: 'ApplicationContextEventsBridge'
        },
        undefined,
        error instanceof Error ? error : undefined
      );
      
      this.logger.error(`${LOGGER_NAMESPACE} Events bridge initialization failed`, {
        error: contextError.getDetailedMessage()
      });
      
      throw contextError;
    }
  }

  // ====================================================================================
  // CONTEXTBRIDGE EVENT INTEGRATION (NEW)
  // ====================================================================================

  /**
   * Setup ContextBridge event handlers for plugin core engine integration
   */
  private setupContextBridgeEventHandlers(): void {
    this.logger.debug(`${LOGGER_NAMESPACE} Setting up ContextBridge event handlers`);

    // Lifecycle events from core engine
    this.setupContextBridgeHandler('lifecycle', (data: LifecycleHookData) => {
      this.handleLifecycleEvent(data);
    });

    // Plugin loading events
    this.setupContextBridgeHandler('loading', (data: LoadingHookData) => {
      this.handleLoadingEvent(data);
    });

    // Dependency resolution events
    this.setupContextBridgeHandler('dependency', (data: DependencyHookData) => {
      this.handleDependencyEvent(data);
    });

    // Configuration events
    this.setupContextBridgeHandler('configuration', (data: ConfigurationHookData) => {
      this.handleConfigurationEvent(data);
    });

    // Registry events
    this.setupContextBridgeHandler('registry', (data: RegistryHookData) => {
      this.handleRegistryEvent(data);
    });

    // Error events
    this.setupContextBridgeHandler('error', (data: ErrorHookData) => {
      this.handleErrorEvent(data);
    });

    // Performance metrics events
    this.setupContextBridgeHandler('metrics', (data: MetricsHookData) => {
      this.handleMetricsEvent(data);
    });
  }

  /**
   * Setup individual ContextBridge event handler
   */
  private setupContextBridgeHandler<K extends keyof ContextBridgeEventMap>(
    eventType: K,
    handler: (data: ContextBridgeEventMap[K]) => void
  ): void {
    const wrappedHandler = (data: ContextBridgeEventMap[K]) => {
      const startTime = this.eventPerformanceTracking ? Date.now() : 0;
      
      try {
        handler(data);
        
        if (this.eventPerformanceTracking) {
          this.updateEventMetrics(eventType, Date.now() - startTime);
        }
      } catch (error) {
        this.logger.error(`${LOGGER_NAMESPACE} Error in ContextBridge event handler`, {
          eventType,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    };

    this.contextBridgeListeners.set(eventType, wrappedHandler);
  }

  /**
   * Handle lifecycle events from ContextBridge
   */
  private handleLifecycleEvent(data: LifecycleHookData): void {
    // Transform to ApplicationContext event format
    const contextEventData = {
      pluginId: data.pluginId,
      plugin: data.plugin,
      phase: this.mapLifecyclePhaseToContextPhase(data.phase),
      previousPhase: data.previousPhase ? this.mapLifecyclePhaseToContextPhase(data.previousPhase) : undefined,
      contextName: this.context.getName(),
      timestamp: data.timestamp,
      metadata: data.metadata
    };

    this.publishContextEvent('plugin:lifecycle', contextEventData);
  }

  /**
   * Handle loading events from ContextBridge
   */
  private handleLoadingEvent(data: LoadingHookData): void {
    if (data.success) {
      const contextEventData = {
        pluginId: data.pluginId,
        loadPath: data.loadPath,
        loadTimeMs: data.loadTimeMs,
        contextName: this.context.getName(),
        timestamp: data.timestamp,
        metadata: data.metadata
      };
      this.publishContextEvent('plugin:loaded', contextEventData);
    } else {
      const contextEventData = {
        pluginId: data.pluginId,
        loadPath: data.loadPath,
        error: data.error,
        loadTimeMs: data.loadTimeMs,
        contextName: this.context.getName(),
        timestamp: data.timestamp,
        metadata: data.metadata
      };
      this.publishContextEvent('plugin:loadFailed', contextEventData);
    }
  }

  /**
   * Handle dependency events from ContextBridge
   */
  private handleDependencyEvent(data: DependencyHookData): void {
    const contextEventData = {
      pluginId: data.pluginId,
      dependencies: data.dependencies,
      resolved: data.resolved,
      unresolvedDependencies: data.unresolvedDependencies,
      circularDependencies: data.circularDependencies,
      contextName: this.context.getName(),
      timestamp: data.timestamp,
      metadata: data.metadata
    };

    this.publishContextEvent('plugin:dependencyResolved', contextEventData);
  }

  /**
   * Handle configuration events from ContextBridge
   */
  private handleConfigurationEvent(data: ConfigurationHookData): void {
    if (data.success) {
      const contextEventData = {
        pluginId: data.pluginId,
        configurationKeys: data.configurationKeys,
        contextName: this.context.getName(),
        timestamp: data.timestamp,
        metadata: data.metadata
      };
      this.publishContextEvent('plugin:configured', contextEventData);
    } else {
      const contextEventData = {
        pluginId: data.pluginId,
        configurationKeys: data.configurationKeys,
        error: data.error,
        contextName: this.context.getName(),
        timestamp: data.timestamp,
        metadata: data.metadata
      };
      this.publishContextEvent('plugin:configurationFailed', contextEventData);
    }
  }

  /**
   * Handle registry events from ContextBridge
   */
  private handleRegistryEvent(data: RegistryHookData): void {
    const eventType = data.operation === 'register' ? 'plugin:registered' : 'plugin:unregistered';
    const contextEventData = {
      pluginId: data.pluginId, // Use pluginId as it exists on RegistryHookData
      operation: data.operation,
      success: data.success,
      error: data.error,
      contextName: this.context.getName(),
      timestamp: data.timestamp,
      metadata: data.metadata
    };

    this.publishContextEvent(eventType, contextEventData);
  }

  /**
   * Handle error events from ContextBridge
   */
  private handleErrorEvent(data: ErrorHookData): void {
    const contextEventData = {
      pluginId: data.pluginId,
      error: data.error,
      context: data.context,
      recoverable: data.recoverable,
      contextName: this.context.getName(),
      timestamp: data.timestamp,
      metadata: data.metadata
    };

    this.publishContextEvent('plugin:error', contextEventData);
  }

  /**
   * Handle metrics events from ContextBridge
   */
  private handleMetricsEvent(data: MetricsHookData): void {
    const contextEventData = {
      pluginId: data.pluginId,
      metricName: data.metricName,
      value: data.value,
      unit: data.unit,
      tags: data.tags,
      contextName: this.context.getName(),
      timestamp: data.timestamp,
      metadata: data.metadata
    };

    this.publishContextEvent('plugin:metrics', contextEventData);
  }

  /**
   * Map plugin lifecycle phase to ApplicationContext phase
   */
  private mapLifecyclePhaseToContextPhase(phase: any): ApplicationContextPhase {
    // This would map between plugin LifecyclePhase and ApplicationContextPhase
    // For now, using a simple mapping - should be enhanced based on actual phase definitions
    switch (phase) {
      case 'LOADING':
      case 'INITIALIZING':
        return ApplicationContextPhase.PluginInitialization;
      case 'STARTED':
      case 'RUNNING':
        return ApplicationContextPhase.Running;
      case 'STOPPING':
        return ApplicationContextPhase.ShuttingDown;
      case 'STOPPED':
        return ApplicationContextPhase.Stopped;
      default:
        return ApplicationContextPhase.PluginInitialization;
    }
  }

  // ====================================================================================
  // ENHANCED EVENT MANAGEMENT
  // ====================================================================================

  /**
   * Update event performance metrics
   */
  private updateEventMetrics(eventType: string, duration: number): void {
    const existing = this.eventMetrics.get(eventType);
    if (existing) {
      existing.count++;
      existing.lastEmitted = new Date();
      existing.avgDuration = (existing.avgDuration * (existing.count - 1) + duration) / existing.count;
    } else {
      this.eventMetrics.set(eventType, {
        count: 1,
        lastEmitted: new Date(),
        avgDuration: duration
      });
    }
  }

  /**
   * Get event performance metrics
   */
  getEventMetrics(): Map<string, { count: number; lastEmitted: Date; avgDuration: number }> {
    return new Map(this.eventMetrics);
  }

  /**
   * Enable/disable event filtering
   */
  setEventFiltering(enabled: boolean): void {
    this.eventFilteringEnabled = enabled;
    this.logger.debug(`${LOGGER_NAMESPACE} Event filtering ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Enable/disable backward compatibility mode
   */
  setBackwardCompatibility(enabled: boolean): void {
    this.backwardCompatibilityMode = enabled;
    this.logger.debug(`${LOGGER_NAMESPACE} Backward compatibility ${enabled ? 'enabled' : 'disabled'}`);
  }

  // ====================================================================================
  // MISSING METHODS IMPLEMENTATION
  // ====================================================================================

  /**
   * Publish context event to EventHub
   */
  private publishContextEvent(eventType: string, eventData: any): void {
    try {
      this.eventHub.emit({
        id: `context-event-${Date.now()}`,
        type: eventType,
        data: eventData,
        priority: 1,
        timestamp: new Date()
      });
    } catch (error) {
      this.logger.error(`${LOGGER_NAMESPACE} Failed to publish context event`, {
        eventType,
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  // ====================================================================================
  // LEGACY PLUGIN EVENT BRIDGE (FOR BACKWARD COMPATIBILITY)
  // ====================================================================================

  /**
   * Setup legacy plugin event bridge for backward compatibility
   */
  private setupLegacyPluginEventBridge(): void {
    this.logger.debug(`${LOGGER_NAMESPACE} Setting up legacy plugin event bridge`);

    // Bridge plugin registration events
    this.bridgePluginEvent('plugin:registered', (plugin: Plugin) => {
      const eventData = {
        plugin: plugin,
        contextName: this.context.getName(),
        timestamp: new Date()
      };
      this.publishContextEvent('plugin:registered', eventData);
    });

    // Bridge plugin initialization events
    this.bridgePluginEvent('plugin:initialized', (
      plugin: Plugin,
      duration?: number
    ) => {
      const eventData = {
        plugin: plugin,
        contextName: this.context.getName(),
        timestamp: new Date(),
        duration: duration
      };
      this.publishContextEvent('plugin:initialized', eventData);
    });

    // Add more legacy event bridges as needed
  }

  /**
   * Bridge a plugin event to context event
   */
  private bridgePluginEvent(eventName: string, handler: (...args: any[]) => void): void {
    try {
      // Check if context has getPluginEngine method and if the engine has event methods
      const pluginEngine = this.context.getPluginEngine?.();
      if (pluginEngine && typeof pluginEngine.on === 'function') {
        pluginEngine.on(eventName, handler);
        this.eventListeners.set(eventName, handler);
      } else {
        // Fallback: just store the handler for cleanup purposes
        this.eventListeners.set(eventName, handler);
        this.logger.debug(`${LOGGER_NAMESPACE} Plugin event bridging not available for: ${eventName}`);
      }
    } catch (error) {
      this.logger.warn(`${LOGGER_NAMESPACE} Failed to bridge plugin event: ${eventName}`, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  /**
   * Destroy the events bridge and clean up all listeners
   */
  destroy(): void {
    if (!this.initialized) {
      return;
    }

    this.logger.debug(`${LOGGER_NAMESPACE} Destroying events bridge`);

    // Clean up legacy event listeners
    this.eventListeners.forEach((listener, eventName) => {
      try {
        const pluginEngine = this.context.getPluginEngine?.();
        if (pluginEngine && typeof pluginEngine.off === 'function') {
          pluginEngine.off(eventName, listener);
        }
      } catch (error) {
        this.logger.warn(`${LOGGER_NAMESPACE} Error removing event listener: ${eventName}`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });

    // Clear all maps
    this.eventListeners.clear();
    this.contextBridgeListeners.clear();
    this.eventMetrics.clear();

    this.initialized = false;
    this.logger.info(`${LOGGER_NAMESPACE} Events bridge destroyed`);
  }
}
