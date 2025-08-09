import { Either } from '@/either';

// EventHub-related imports for delegation
import {
  EventListener,
  EventPriority,
  EventSubscription
} from '@/eventhub';
import { EventBuilder } from '@/eventhub/EventBuilder';
import { EventBrokerPort } from '@/eventhub/ports/EventBrokerPort';
import { EventPublisherPort } from '@/eventhub/ports/EventPublisherPort';
import { EventSubscriberPort } from '@/eventhub/ports/EventSubscriberPort';
import { EventBrokerConfig } from '@/eventhub/ports/types';
import { MessageReceiver } from '@/eventhub/queue/MessageReceiver';
import { MessageSender } from '@/eventhub/queue/MessageSender';
import { Queue } from '@/eventhub/queue/Queue';
import { QueueConfig } from '@/eventhub/queue/types';
import { Publisher } from '@/eventhub/topic/Publisher';
import { Subscriber } from '@/eventhub/topic/Subscriber';
import { Topic } from '@/eventhub/topic/Topic';
import { TopicConfig } from '@/eventhub/topic/types';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { ExceptionFactory } from '@/exception/ExceptionFactory';
import { Logger } from '@/logger';
import { Maybe } from "@/maybe";

// Plugin-related imports for delegation
import { Plugin } from '@/plugin';
import { PluginState } from '@/plugin';
import { ServiceLifetime } from "@/service";
import {
  Service,
  ServiceDescriptor
} from "@/service";
import { ApplicationContextError } from './ApplicationContextError';
import { EventHubContext } from './EventHubContext';
import { PluginEngineContext } from './PluginEngineContext'; // Updated import
import { ApplicationContextEventsBridge } from './ApplicationContextEventsBridge';
import {
  ApplicationContextConfig,
  ApplicationContextEvents,
  ApplicationContextPhase
} from './types';

// Import plugin integration types for enhanced cross-context communication
import { PluginEngineBuilderConfig } from '@/plugin';

const LOGGER_NAMESPACE = "[ApplicationContext]" as const;

/**
 * Enhanced Application Context - Cross-Context Orchestration Layer
 *
 * This enhanced ApplicationContext serves as an orchestration layer that
 * coordinates specialized contexts (EventHubContext and PluginEngineContext)
 * with enhanced cross-context communication, error handling, and integration
 * with the new plugin core engine architecture.
 */
export class ApplicationContext<TConfig extends ApplicationContextConfig = ApplicationContextConfig> {
  private readonly logger: Logger;
  private readonly config: TConfig;
  
  // Orchestrated Contexts - Updated to use PluginEngineContext
  private readonly eventHubContext: EventHubContext;
  private readonly pluginEngineContext: PluginEngineContext;
  
  // Enhanced Cross-Context Communication
  private readonly eventsBridge: ApplicationContextEventsBridge;
  private contextCommunicationChannels: Map<string, any> = new Map();
  private crossContextEventHandlers: Map<string, Function[]> = new Map();
  
  // Context State Management
  private phase: ApplicationContextPhase = ApplicationContextPhase.Uninitialized;
  private readonly initializationTimestamp: Date;
  private contextHealth: Map<string, { healthy: boolean; lastCheck: Date; errors: string[] }> = new Map();
  
  // Enhanced Error Handling
  private errorPropagationEnabled = true;
  private errorRecoveryStrategies: Map<string, Function> = new Map();
  
  // Add missing phase transition property
  private phaseTransitionInProgress = false;

  constructor(
    config: TConfig,
    logger: Logger
  ) {
    this.config = config;
    this.logger = logger;
    this.initializationTimestamp = new Date();

    // Initialize orchestrated contexts with enhanced configuration
    this.eventHubContext = new EventHubContext(
      this.config.eventHub,
      this.logger
    );

    // Build PluginEngineContext with enhanced configuration
    const pluginEngineConfig: PluginEngineBuilderConfig = {
      // Use basic config since 'plugins' property doesn't exist in TConfig
      eventHubIntegration: true,
      serviceHooksEnabled: true,
      contextBridgeEnabled: true
    };

    this.pluginEngineContext = new PluginEngineContext(
      pluginEngineConfig,
      this.eventHubContext.getEventHub(),
      this.logger,
      this.getName()
    );

    // Set up enhanced cross-context communication
    this.setupCrossContextCommunication();
    
    // Initialize contexts health monitoring
    this.initializeContextHealthMonitoring();

    // Set up enhanced events bridge with ContextBridge integration
    this.eventsBridge = new ApplicationContextEventsBridge(
      this,
      this.eventHubContext.getEventHub(),
      this.logger
    );

    this.logger.info(`${LOGGER_NAMESPACE} ApplicationContext created with enhanced cross-context communication`, {
      contextName: this.getName(),
      phase: this.phase,
      contexts: ['EventHub', 'PluginEngine'],
      crossContextCommunication: true,
      healthMonitoring: true
    });
  }

  // ====================================================================================
  // ENHANCED CROSS-CONTEXT COMMUNICATION
  // ====================================================================================

  /**
   * Set up enhanced cross-context communication channels
   */
  private setupCrossContextCommunication(): void {
    this.logger.debug(`${LOGGER_NAMESPACE} Setting up cross-context communication`);

    // Create communication channels between contexts
    this.contextCommunicationChannels.set('eventHub->pluginEngine', {
      forward: (event: any) => this.forwardEventToPluginEngine(event),
      backward: (response: any) => this.handlePluginEngineResponse(response)
    });

    this.contextCommunicationChannels.set('pluginEngine->eventHub', {
      forward: (event: any) => this.forwardEventToEventHub(event),
      backward: (response: any) => this.handleEventHubResponse(response)
    });

    // Set up cross-context event subscriptions
    this.setupCrossContextEventSubscriptions();

    // Initialize error propagation between contexts
    this.setupErrorPropagation();

    this.logger.info(`${LOGGER_NAMESPACE} Cross-context communication established`, {
      channels: this.contextCommunicationChannels.size,
      errorPropagation: this.errorPropagationEnabled
    });
  }

  /**
   * Set up cross-context event subscriptions
   */
  private setupCrossContextEventSubscriptions(): void {
    // Subscribe to EventHub events and forward relevant ones to PluginEngine
    this.eventHubContext.getEventHub().on('*', (eventData: any) => {
      this.handleCrossContextEvent('eventHub', 'pluginEngine', eventData);
    });

    // Subscribe to PluginEngine events via enhanced event subscription
    this.pluginEngineContext.subscribeToEvents('*', (eventData: any) => {
      this.handleCrossContextEvent('pluginEngine', 'eventHub', eventData);
    });
  }

  /**
   * Handle cross-context events with filtering and routing
   */
  private handleCrossContextEvent(sourceContext: string, targetContext: string, eventData: any): void {
    try {
      const channelKey = `${sourceContext}->${targetContext}`;
      const channel = this.contextCommunicationChannels.get(channelKey);

      if (channel && this.shouldForwardEvent(eventData, sourceContext, targetContext)) {
        channel.forward(eventData);
        
        // Update context health based on successful communication
        this.updateContextHealth(sourceContext, true);
      }
    } catch (error) {
      this.logger.error(`${LOGGER_NAMESPACE} Error in cross-context communication`, {
        sourceContext,
        targetContext,
        error: error instanceof Error ? error.message : String(error)
      });
      
      this.updateContextHealth(sourceContext, false, [error instanceof Error ? error.message : String(error)]);
    }
  }

  /**
   * Determine if event should be forwarded between contexts
   */
  private shouldForwardEvent(eventData: any, sourceContext: string, targetContext: string): boolean {
    // Filter events to avoid loops and unnecessary forwarding
    if (eventData.source === targetContext) {
      return false; // Avoid circular forwarding
    }

    // Forward plugin lifecycle events between contexts
    if (eventData.type?.startsWith('plugin:') && targetContext === 'eventHub') {
      return true;
    }

    // Forward EventHub events to PluginEngine for processing
    if (sourceContext === 'eventHub' && targetContext === 'pluginEngine') {
      return eventData.type?.startsWith('context:') || false;
    }

    return false;
  }

  /**
   * Forward events to PluginEngine context
   */
  private forwardEventToPluginEngine(event: any): void {
    // Transform event for PluginEngine consumption
    const transformedEvent = {
      ...event,
      source: 'ApplicationContext',
      targetContext: 'PluginEngine',
      timestamp: new Date()
    };

    // Emit via PluginEngine's event system
    this.pluginEngineContext.getEventHub().emit('cross-context-event', transformedEvent);
  }

  /**
   * Forward events to EventHub context
   */
  private forwardEventToEventHub(event: any): void {
    // Transform event for EventHub consumption
    const transformedEvent = {
      ...event,
      source: 'ApplicationContext',
      targetContext: 'EventHub',
      timestamp: new Date()
    };

    // Emit via EventHub
    this.eventHubContext.getEventHub().emit('cross-context-event', transformedEvent);
  }

  /**
   * Handle responses from PluginEngine context
   */
  private handlePluginEngineResponse(response: any): void {
    this.logger.debug(`${LOGGER_NAMESPACE} Received response from PluginEngine`, {
      responseType: response.type,
      success: response.success
    });

    // Process response and update context state if needed
    if (!response.success) {
      this.updateContextHealth('pluginEngine', false, [response.error || 'Unknown error']);
    }
  }

  /**
   * Handle responses from EventHub context
   */
  private handleEventHubResponse(response: any): void {
    this.logger.debug(`${LOGGER_NAMESPACE} Received response from EventHub`, {
      responseType: response.type,
      success: response.success
    });

    // Process response and update context state if needed
    if (!response.success) {
      this.updateContextHealth('eventHub', false, [response.error || 'Unknown error']);
    }
  }

  // ====================================================================================
  // ENHANCED ERROR HANDLING AND PROPAGATION
  // ====================================================================================

  /**
   * Set up error propagation between contexts
   */
  private setupErrorPropagation(): void {
    if (!this.errorPropagationEnabled) {
      return;
    }

    // Set up error recovery strategies
    this.errorRecoveryStrategies.set('eventHub', this.recoverEventHubContext.bind(this));
    this.errorRecoveryStrategies.set('pluginEngine', this.recoverPluginEngineContext.bind(this));

    this.logger.debug(`${LOGGER_NAMESPACE} Error propagation and recovery strategies initialized`);
  }

  /**
   * Handle error propagation across contexts
   */
  private propagateError(sourceContext: string, error: ApplicationContextError): void {
    this.logger.warn(`${LOGGER_NAMESPACE} Propagating error from ${sourceContext}`, {
      error: error.message,
      errorCode: error.code
    });

    // Update context health
    this.updateContextHealth(sourceContext, false, [error.message]);

    // Attempt recovery if strategy exists
    const recoveryStrategy = this.errorRecoveryStrategies.get(sourceContext);
    if (recoveryStrategy) {
      try {
        recoveryStrategy(error);
      } catch (recoveryError) {
        this.logger.error(`${LOGGER_NAMESPACE} Error recovery failed for ${sourceContext}`, {
          originalError: error.message,
          recoveryError: recoveryError instanceof Error ? recoveryError.message : String(recoveryError)
        });
      }
    }
  }

  /**
   * Recover EventHub context
   */
  private async recoverEventHubContext(error: ApplicationContextError): Promise<void> {
    this.logger.info(`${LOGGER_NAMESPACE} Attempting EventHub context recovery`);
    
    try {
      // Attempt to restart EventHub if it's in a failed state
      if (!this.eventHubContext.getEventHub().isRunning()) {
        const restartResult = await this.eventHubContext.start();
        if (Either.isLeft(restartResult)) {
          throw new Error(`EventHub restart failed: ${restartResult.left.message}`);
        }
      }
      
      this.updateContextHealth('eventHub', true);
      this.logger.info(`${LOGGER_NAMESPACE} EventHub context recovery successful`);
      
    } catch (recoveryError) {
      this.logger.error(`${LOGGER_NAMESPACE} EventHub context recovery failed`, {
        error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError)
      });
    }
  }

  /**
   * Recover PluginEngine context
   */
  private async recoverPluginEngineContext(error: ApplicationContextError): Promise<void> {
    this.logger.info(`${LOGGER_NAMESPACE} Attempting PluginEngine context recovery`);
    
    try {
      // Attempt to reinitialize PluginEngine if needed
      const phase = this.pluginEngineContext.getPhase();
      if (phase === ApplicationContextPhase.Failed) {
        const reinitResult = await this.pluginEngineContext.initialize();
        if (Either.isLeft(reinitResult)) {
          throw new Error(`PluginEngine reinitialize failed: ${reinitResult.left.message}`);
        }
      }
      
      this.updateContextHealth('pluginEngine', true);
      this.logger.info(`${LOGGER_NAMESPACE} PluginEngine context recovery successful`);
      
    } catch (recoveryError) {
      this.logger.error(`${LOGGER_NAMESPACE} PluginEngine context recovery failed`, {
        error: recoveryError instanceof Error ? recoveryError.message : String(recoveryError)
      });
    }
  }

  // ====================================================================================
  // CONTEXT HEALTH MONITORING
  // ====================================================================================

  /**
   * Initialize context health monitoring
   */
  private initializeContextHealthMonitoring(): void {
    this.contextHealth.set('eventHub', {
      healthy: true,
      lastCheck: new Date(),
      errors: []
    });

    this.contextHealth.set('pluginEngine', {
      healthy: true,
      lastCheck: new Date(),
      errors: []
    });

    this.contextHealth.set('application', {
      healthy: true,
      lastCheck: new Date(),
      errors: []
    });
  }

  /**
   * Update context health status
   */
  private updateContextHealth(contextName: string, healthy: boolean, errors: string[] = []): void {
    const healthInfo = this.contextHealth.get(contextName);
    if (healthInfo) {
      healthInfo.healthy = healthy;
      healthInfo.lastCheck = new Date();
      if (errors.length > 0) {
        healthInfo.errors.push(...errors);
        // Keep only last 10 errors
        healthInfo.errors = healthInfo.errors.slice(-10);
      } else if (healthy) {
        healthInfo.errors = []; // Clear errors on recovery
      }
    }
  }

  /**
   * Get context health status
   */
  getContextHealth(): Map<string, { healthy: boolean; lastCheck: Date; errors: string[] }> {
    return new Map(this.contextHealth);
  }

  /**
   * Check overall application health
   */
  isHealthy(): boolean {
    return Array.from(this.contextHealth.values()).every(health => health.healthy);
  }

  // ====================================================================================
  // ENHANCED INITIALIZATION FLOW
  // ====================================================================================

  /**
   * Enhanced initialization with cross-context coordination
   */
  async initialize(): Promise<Either<ApplicationContextError, void>> {
    this.logger.info(`${LOGGER_NAMESPACE} Initializing ApplicationContext with cross-context coordination`, {
      contextName: this.getName(),
      currentPhase: this.phase
    });

    try {
      this.phase = ApplicationContextPhase.ConfigurationLoading;

      // Initialize EventHub context first
      this.logger.debug(`${LOGGER_NAMESPACE} Initializing EventHub context`);
      const eventHubResult = await this.eventHubContext.initialize();
      if (Either.isLeft(eventHubResult)) {
        this.phase = ApplicationContextPhase.Failed;
        this.updateContextHealth('eventHub', false, [eventHubResult.left.message]);
        return Either.left(this.createContextError(
          'initialize',
          `EventHub initialization failed: ${eventHubResult.left.message}`,
          eventHubResult.left
        ));
      }

      // Initialize PluginEngine context
      this.logger.debug(`${LOGGER_NAMESPACE} Initializing PluginEngine context`);
      const pluginEngineResult = await this.pluginEngineContext.initialize();
      if (Either.isLeft(pluginEngineResult)) {
        this.phase = ApplicationContextPhase.Failed;
        this.updateContextHealth('pluginEngine', false, [pluginEngineResult.left.message]);
        return Either.left(this.createContextError(
          'initialize',
          `PluginEngine initialization failed: ${pluginEngineResult.left.message}`,
          pluginEngineResult.left
        ));
      }

      // Initialize events bridge with ContextBridge integration
      try {
        this.eventsBridge.initialize();
        
        // Connect events bridge to ContextBridge if available
        const contextBridge = (this.pluginEngineContext as any).contextBridge;
        if (contextBridge) {
          this.eventsBridge.connectToContextBridge(contextBridge);
        }
      } catch (error) {
        this.logger.warn(`${LOGGER_NAMESPACE} Events bridge initialization failed`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }

      this.phase = ApplicationContextPhase.Running;
      this.updateContextHealth('application', true);

      this.logger.info(`${LOGGER_NAMESPACE} ApplicationContext initialized successfully`, {
        contextName: this.getName(),
        phase: this.phase,
        initializationTime: Date.now() - this.initializationTimestamp.getTime()
      });

      return Either.right(undefined);

    } catch (error) {
      this.phase = ApplicationContextPhase.Failed;
      this.updateContextHealth('application', false, [error instanceof Error ? error.message : String(error)]);
      
      return Either.left(this.createContextError(
        'initialize',
        `ApplicationContext initialization failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      ));
    }
  }

  // ====================================================================================
  // ERROR HANDLING METHODS
  // ====================================================================================

  /**
   * Create a context error with proper error details
   */
  private createContextError(
    operation: string,
    message: string,
    cause?: Error
  ): ApplicationContextError {
    return ApplicationContextError.create(
      UnifiedErrorCode.CONTEXT_INITIALIZATION_FAILED,
      message,
      operation,
      {
        contextName: this.getName(),
        phase: this.phase,
        timestamp: new Date()
      },
      undefined,
      cause
    );
  }
  
  async start(): Promise<Either<ApplicationContextError, void>> {
    try {
      if (this.phase !== ApplicationContextPhase.Running) {
        return Either.left(
          new ApplicationContextError(
            UnifiedErrorCode.INVALID_STATE_TRANSITION,
            `Cannot start ApplicationContext from phase: ${ this.phase }`,
            {
              timestamp: new Date(),
              module: 'ApplicationContext',
              contextName: this.config.name,
              currentPhase: this.phase,
              targetPhase: ApplicationContextPhase.Running
            }
          )
        );
      }
      
      // Start EventHubContext
      this.logger.debug('Starting EventHubContext');
      const eventHubResult = await this.eventHubContext.start();
      if (eventHubResult.isLeft()) {
        return Either.left(
          new ApplicationContextError(
            UnifiedErrorCode.SERVICE_START_FAILED,
            `EventHubContext start failed: ${ eventHubResult.left.message }`,
            {
              timestamp: new Date(),
              module: 'ApplicationContext',
              contextName: this.config.name,
              currentPhase: this.phase,
              serviceName: 'EventHubContext'
            }
          )
        );
      }
      this.logger.info('EventHubContext started successfully');
      
      // Start PluginManagerContext
      this.logger.debug('Starting PluginManagerContext');
      const pluginManagerResult = await this.pluginEngineContext.start();
      if (Either.isLeft(pluginManagerResult)) {
        return Either.left(
          new ApplicationContextError(
            UnifiedErrorCode.SERVICE_START_FAILED,
            `PluginManagerContext start failed: ${ pluginManagerResult.left.message }`,
            {
              timestamp: new Date(),
              module: 'ApplicationContext',
              contextName: this.config.name,
              currentPhase: this.phase,
              serviceName: 'PluginManagerContext'
            }
          )
        );
      }
      this.logger.info('PluginManagerContext started successfully');
      
      // Transition to running phase
      await this.transitionTo(ApplicationContextPhase.Running);
      
      this.logger.info('ApplicationContext started successfully', {
        contextName: this.config.name,
        phase: this.phase,
        uptime: this.getUptime()
      });
      
      return Either.right(undefined as void);
    } catch (error) {
      await this.transitionTo(ApplicationContextPhase.Failed);
      return Either.left(
        new ApplicationContextError(
          UnifiedErrorCode.INVALID_OPERATION,
          `ApplicationContext start failed: ${ error instanceof Error ? error.message : String(error) }`,
          {
            timestamp: new Date(),
            module: 'ApplicationContext',
            contextName: this.config.name,
            currentPhase: this.phase
          }
        )
      );
    }
  }
  
  async stop(): Promise<Either<ApplicationContextError, void>> {
    try {
      if (this.phase !== ApplicationContextPhase.Running) {
        return Either.left(
          new ApplicationContextError(
            UnifiedErrorCode.INVALID_STATE_TRANSITION,
            `Cannot stop ApplicationContext from phase: ${ this.phase }`,
            {
              timestamp: new Date(),
              module: 'ApplicationContext',
              contextName: this.config.name,
              currentPhase: this.phase,
              targetPhase: ApplicationContextPhase.Running
            }
          )
        );
      }
      
      this.logger.info('Stopping ApplicationContext', {
        contextName: this.config.name,
        currentPhase: this.phase
      });
      
      // Stop PluginManagerContext first
      this.logger.debug('Stopping PluginManagerContext');
      const pluginManagerResult = await this.pluginEngineContext.stop();
      if (pluginManagerResult.isLeft()) {
        this.logger.warn('PluginManagerContext stop failed', {
          error: pluginManagerResult.left.message,
          contextName: this.config.name
        });
      } else {
        this.logger.info('PluginManagerContext stopped successfully');
      }
      
      // Stop EventHubContext
      this.logger.debug('Stopping EventHubContext');
      const eventHubResult = await this.eventHubContext.stop();
      if (eventHubResult.isLeft()) {
        this.logger.warn('EventHubContext stop failed', {
          error: eventHubResult.left.message,
          contextName: this.config.name
        });
      } else {
        this.logger.info('EventHubContext stopped successfully');
      }
      
      // Transition to stopped phase
      await this.transitionTo(ApplicationContextPhase.Stopped);
      
      this.logger.info('ApplicationContext stopped successfully', {
        contextName: this.config.name,
        phase: this.phase,
        uptime: this.getUptime()
      });
      
      return Either.right(undefined as void);
    } catch (error) {
      await this.transitionTo(ApplicationContextPhase.Failed);
      return Either.left(
        new ApplicationContextError(
          UnifiedErrorCode.INVALID_OPERATION,
          `ApplicationContext stop failed: ${ error instanceof Error ? error.message : String(error) }`,
          {
            timestamp: new Date(),
            module: 'ApplicationContext',
            contextName: this.config.name,
            currentPhase: this.phase
          }
        )
      );
    }
  }
  
  // ====================================================================================
  // PHASE TRANSITION MANAGEMENT
  // ====================================================================================
  
  private async transitionTo(targetPhase: ApplicationContextPhase): Promise<void> {
    if (this.phaseTransitionInProgress) {
      this.logger.warn('Phase transition already in progress', {
        currentPhase: this.phase,
        targetPhase
      });
      return;
    }
    
    this.phaseTransitionInProgress = true;
    
    try {
      this.validatePhaseTransition(this.phase, targetPhase);
      
      const previousPhase = this.phase;
      this.phase = targetPhase;
      
      this.logger.debug('Phase transition completed', {
        fromPhase: previousPhase,
        toPhase: targetPhase,
        contextName: this.config.name
      });
      
      // Note: updatePhase methods don't exist on specialized contexts yet
      // This is acceptable since they manage their own internal phases
      
    } finally {
      this.phaseTransitionInProgress = false;
    }
  }
  
  protected validatePhaseTransition(
    fromPhase: ApplicationContextPhase,
    toPhase: ApplicationContextPhase
  ): void {
    // Allow transitions to Failed from any phase
    if (toPhase === ApplicationContextPhase.Failed) {
      return;
    }
    
    // For now, allow basic transitions - we'll expand this as needed
    // This is a simplified version to avoid the Record type mismatch
    const validTransitions = new Map<ApplicationContextPhase, ApplicationContextPhase[]>([
      [ApplicationContextPhase.Uninitialized, [ApplicationContextPhase.ConfigurationLoading]],
      [ApplicationContextPhase.ConfigurationLoading, [ApplicationContextPhase.PluginManagerSetup]],
      [ApplicationContextPhase.PluginManagerSetup, [ApplicationContextPhase.Ready]],
      [ApplicationContextPhase.Ready, [ApplicationContextPhase.Running]],
      [ApplicationContextPhase.Running, [ApplicationContextPhase.Stopped]],
      [ApplicationContextPhase.Stopped, [ApplicationContextPhase.ConfigurationLoading]],
      [ApplicationContextPhase.Failed, [ApplicationContextPhase.ConfigurationLoading]]
    ]);
    
    const allowedTransitions = validTransitions.get(fromPhase) || [];
    if (!allowedTransitions.includes(toPhase)) {
      throw new Error(`Invalid phase transition from ${ fromPhase } to ${ toPhase }`);
    }
  }
  
  // ====================================================================================
  // STATE ACCESS METHODS
  // ====================================================================================
  
  getPhase(): ApplicationContextPhase {
    return this.phase;
  }
  
  getName(): string {
    return this.config.name;
  }
  
  getUptime(): number {
    return Date.now() - this.initializationTimestamp.getTime();
  }
  
  // ====================================================================================
  // SERVICE REGISTRY METHODS - DELEGATED TO PLUGINMANAGERCONTEXT
  // ====================================================================================
  
  resolve<T extends Service>(
    serviceDescriptor: ServiceDescriptor<T>,
  ): Maybe<T> {
    try {
      const result = this.pluginEngineContext.getService(serviceDescriptor);
      if (Either.isRight(result)) {
        this.logger.debug(`Service resolved: ${ serviceDescriptor.toString() }`);
        return Maybe.just(result.right);
      }
      this.logger.debug(`Service not found: ${ serviceDescriptor.toString() }`);
      return Maybe.nothing();
    } catch (error) {
      this.logger.warn(`Service resolution failed: ${ serviceDescriptor.toString() }: ${ error }`);
      return Maybe.nothing();
    }
  }
  
  tryResolve<T extends Service>(
    descriptor: ServiceDescriptor<T>,
  ): Either<ApplicationContextError, T> {
    const result = this.pluginEngineContext.getService(descriptor);
    if (Either.isLeft(result)) {
      return Either.left(
        ExceptionFactory.convertAndPreserve<ApplicationContextError>(
          result.left,
          UnifiedErrorCode.CONTEXT_SERVICE_RESOLUTION_FAILED,
          'CONTEXT',
          'tryResolve',
          undefined,
          {
            additionalData: {
              contextName: this.config.name,
              serviceDescriptor: descriptor.toString()
            }
          }
        )
      );
    }
    return Either.right(result.right);
  }
  
  registerService<T extends Service>(
    descriptor: ServiceDescriptor<T>,
    factory: () => T,
    lifetime: ServiceLifetime = ServiceLifetime.Singleton
  ): Either<ApplicationContextError, void> {
    const result = this.pluginEngineContext.registerService(descriptor, factory, lifetime);
    if (Either.isLeft(result)) {
      return Either.left(
        new ApplicationContextError(
          UnifiedErrorCode.SERVICE_REGISTRATION_FAILED,
          `Service registration failed: ${ descriptor.toString() }`,
          {
            timestamp: new Date(),
            module: 'ApplicationContext',
            contextName: this.config.name,
            currentPhase: this.phase,
            additionalData: { serviceDescriptor: descriptor.toString() }
          }
        )
      );
    }
    return Either.right(undefined as void);
  }
  
  unregisterService(descriptor: ServiceDescriptor): Either<ApplicationContextError, void> {
    const result = this.pluginEngineContext.unregisterService(descriptor);
    if (Either.isLeft(result)) {
      return Either.left(
        new ApplicationContextError(
          UnifiedErrorCode.SERVICE_UNREGISTRATION_FAILED,
          `Service unregistration failed: ${ descriptor.toString() }`,
          {
            timestamp: new Date(),
            module: 'ApplicationContext',
            contextName: this.config.name,
            currentPhase: this.phase,
            additionalData: { serviceDescriptor: descriptor.toString() }
          }
        )
      );
    }
    return Either.right(undefined as void);
  }
  
  // ====================================================================================
  // EVENT EMISSION METHODS - FOR BRIDGE SUPPORT
  // ====================================================================================
  
  /**
   * Emit an event through the EventHub
   * @internal - Used by ApplicationContextEventsBridge
   */
  emit<K extends keyof ApplicationContextEvents>(
    eventName: K,
    eventData: ApplicationContextEvents[K]
  ): void {
    const eventHub = this.eventHubContext.getEventHub();
    // Create a proper Event object with the EventBuilder
    const event = EventBuilder
      .ofType(eventName as string)
      .withPayload(eventData)
      .fromSource(this.config.name)
      .withPriority(EventPriority.NORMAL)
      .build();
    
    // Use the async emit method properly
    eventHub.emit(event).catch(error => {
      this.logger.error('Failed to emit event', {
        eventType: eventName,
        error: error instanceof Error ? error.message : String(error)
      });
    });
  }

  // ====================================================================================
  // EVENTHUB METHODS - DELEGATED TO EVENTHUBCONTEXT
  // ====================================================================================
  
  // Queue Operations
  async createQueue(config: QueueConfig): Promise<Either<ApplicationContextError, Queue>> {
    return this.eventHubContext.createQueue(config);
  }
  
  async deleteQueue(name: string): Promise<Either<ApplicationContextError, void>> {
    return this.eventHubContext.deleteQueue(name);
  }
  
  getQueue(name: string): Maybe<Queue> {
    return this.eventHubContext.getQueue(name);
  }
  
  getMessageSender(): MessageSender {
    return this.eventHubContext.getMessageSender();
  }
  
  getMessageReceiver(): MessageReceiver {
    return this.eventHubContext.getMessageReceiver();
  }
  
  async sendMessage<T>(
    queueName: string,
    message: T
  ): Promise<Either<ApplicationContextError, void>> {
    return this.eventHubContext.sendMessage(queueName, message);
  }
  
  async receiveMessage<T>(queueName: string): Promise<Either<ApplicationContextError, Maybe<T>>> {
    return this.eventHubContext.receiveMessage<T>(queueName);
  }
  
  // Topic Operations
  async createTopic(config: TopicConfig): Promise<Either<ApplicationContextError, Topic>> {
    return this.eventHubContext.createTopic(config);
  }
  
  async deleteTopic(name: string): Promise<Either<ApplicationContextError, void>> {
    return this.eventHubContext.deleteTopic(name);
  }
  
  getTopic(name: string): Maybe<Topic> {
    return this.eventHubContext.getTopic(name);
  }
  
  getPublisher(): Publisher {
    return this.eventHubContext.getPublisher();
  }
  
  getSubscriber(): Subscriber {
    return this.eventHubContext.getSubscriber();
  }
  
  async publishToTopic<T>(
    topicName: string,
    message: T
  ): Promise<Either<ApplicationContextError, void>> {
    return this.eventHubContext.publishToTopic(topicName, message);
  }
  
  async subscribeToTopic<T>(
    topicName: string,
    listener: EventListener<T>
  ): Promise<Either<ApplicationContextError, EventSubscription>> {
    return this.eventHubContext.subscribeToTopic(topicName, listener);
  }
  
  async unsubscribeFromTopic(subscriptionId: string): Promise<Either<ApplicationContextError, void>> {
    return this.eventHubContext.unsubscribeFromTopic(subscriptionId);
  }
  
  // Port/Broker Operations
  registerEventBrokerPort(
    name: string,
    port: EventBrokerPort
  ): Either<ApplicationContextError, void> {
    return this.eventHubContext.registerEventBrokerPort(name, port);
  }
  
  unregisterEventBrokerPort(name: string): Either<ApplicationContextError, void> {
    return this.eventHubContext.unregisterEventBrokerPort(name);
  }
  
  getEventBrokerPort(name: string): Maybe<EventBrokerPort> {
    return this.eventHubContext.getEventBrokerPort(name);
  }
  
  getEventPublisherPort(): EventPublisherPort {
    return this.eventHubContext.getEventPublisherPort();
  }
  
  getEventSubscriberPort(): EventSubscriberPort {
    return this.eventHubContext.getEventSubscriberPort();
  }
  
  async connectToExternalBroker(config: EventBrokerConfig): Promise<Either<ApplicationContextError, void>> {
    // Note: EventHubContext.connectToExternalBroker returns Either<ApplicationContextError, string>
    // but we need Either<ApplicationContextError, void> for interface compatibility
    const result = await this.eventHubContext.connectToExternalBroker(config);
    if (result.isLeft()) {
      // Convert error type properly
      return Either.left(result.left);
    }
    // Convert the successful string result to void for interface compatibility
    this.logger.debug('External broker connected successfully', { brokerId: result.right });
    return Either.right(undefined as void);
  }
  
  async disconnectFromExternalBroker(brokerId: string): Promise<Either<ApplicationContextError, void>> {
    return this.eventHubContext.disconnectFromExternalBroker(brokerId);
  }
  
  // ====================================================================================
  // PLUGIN METHODS - DELEGATED TO PLUGINMANAGERCONTEXT
  // ====================================================================================
  
  getAllPlugins(): readonly Plugin[] {
    // Note: PluginManagerContext doesn't have getAllPlugins method yet
    // Return empty array for now - this will be implemented when the method is added
    this.logger.warn('getAllPlugins not yet implemented in PluginManagerContext');
    return [];
  }
  
  getPluginsByState(state: PluginState): readonly Plugin[] {
    // Note: PluginManagerContext doesn't have getPluginsByState method yet
    // Return empty array for now - this will be implemented when the method is added
    this.logger.warn('getPluginsByState not yet implemented in PluginManagerContext', { state });
    return [];
  }
  
  getPlugin(id: string): Maybe<Plugin> {
    // Note: PluginManagerContext doesn't have getPlugin method yet
    // Return Maybe.nothing() for now - this will be implemented when the method is added
    this.logger.warn('getPlugin not yet implemented in PluginManagerContext', { id });
    return Maybe.nothing();
  }
  
  async registerPlugin(plugin: Plugin): Promise<Either<ApplicationContextError, void>> {
    // Note: PluginManagerContext doesn't have registerPlugin method yet
    // Return error for now - this will be implemented when the method is added
    this.logger.warn('registerPlugin not yet implemented in PluginManagerContext', { pluginId: plugin.id });
    return Either.left(
      new ApplicationContextError(
        UnifiedErrorCode.INVALID_OPERATION,
        'Plugin registration not yet implemented in PluginManagerContext',
        {
          timestamp: new Date(),
          module: 'ApplicationContext',
          contextName: this.config.name,
          currentPhase: this.phase,
          pluginId: plugin.id
        }
      )
    );
  }
  
  async unregisterPlugin(plugin: Plugin): Promise<Either<ApplicationContextError, void>> {
    // Note: PluginManagerContext doesn't have unregisterPlugin method yet
    // Return error for now - this will be implemented when the method is added
    this.logger.warn('unregisterPlugin not yet implemented in PluginManagerContext', { pluginId: plugin.id });
    return Either.left(
      new ApplicationContextError(
        UnifiedErrorCode.INVALID_OPERATION,
        'Plugin unregistration not yet implemented in PluginManagerContext',
        {
          timestamp: new Date(),
          module: 'ApplicationContext',
          contextName: this.config.name,
          currentPhase: this.phase,
          pluginId: plugin.id
        }
      )
    );
  }
  
  async unloadPlugin(pluginId: string): Promise<Either<ApplicationContextError, void>> {
    // Note: PluginManagerContext doesn't have unloadPlugin method yet
    // Return error for now - this will be implemented when the method is added
    this.logger.warn('unloadPlugin not yet implemented in PluginManagerContext', { pluginId });
    return Either.left(
      new ApplicationContextError(
        UnifiedErrorCode.INVALID_OPERATION,
        'Plugin unloading not yet implemented in PluginManagerContext',
        {
          timestamp: new Date(),
          module: 'ApplicationContext',
          contextName: this.config.name,
          currentPhase: this.phase,
          pluginId
        }
      )
    );
  }
  
  // ====================================================================================
  // BACKWARD COMPATIBILITY ACCESSORS
  // ====================================================================================
  
  get pluginEngine(): PluginEngineContext {
    return this.pluginEngineContext;
  }

  // Legacy property for backward compatibility
  get pluginManager(): PluginEngineContext {
    this.logger.warn(`${LOGGER_NAMESPACE} Using deprecated 'pluginManager' property. Use 'pluginEngine' instead.`);
    return this.pluginEngineContext;
  }
  
  // ====================================================================================
  // LOGGING METHODS
  // ==================================================================================
  
  protected debug(
    message: string,
    meta?: Record<string, any>
  ): void {
    this.logger.debug(`${ LOGGER_NAMESPACE } ${ message }`, meta);
  }
  
  protected info(
    message: string,
    meta?: Record<string, any>
  ): void {
    this.logger.info(`${ LOGGER_NAMESPACE } ${ message }`, meta);
  }
  
  protected warn(
    message: string,
    meta?: Record<string, any>
  ): void {
    this.logger.warn(`${ LOGGER_NAMESPACE } ${ message }`, meta);
  }
  
  protected error(
    message: string,
    meta?: Record<string, any>
  ): void {
    this.logger.error(`${ LOGGER_NAMESPACE } ${ message }`, meta);
  }
}
