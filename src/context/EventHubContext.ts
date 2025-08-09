/**
 * @fileoverview EventHub Context - Lean EventHub Orchestrator
 *
 * A lightweight context that orchestrates EventHub services instead of
 * implementing all functionality directly. This follows proper separation
 * of concerns and single responsibility principles.
 */

import { Either } from '@/either';
import {
  EventHub,
  EventListener
} from '@/eventhub';
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
import { Logger } from '@/logger';
import { Maybe } from '@/maybe';
import { ApplicationContextError } from './ApplicationContextError';
import { ApplicationContextEventsBridge } from './ApplicationContextEventsBridge';
import { MetricsService } from './services/MetricsService';
import { PortService } from './services/PortService';
import { QueueService } from './services/QueueService';
import { TopicService } from './services/TopicService';
import {
  ApplicationContextPhase,
  EventHubMetrics
} from './types';

const LOGGER_NAMESPACE = "[EventHubContext]" as const;

/**
 * EventHubContext - A lean orchestrator for EventHub operations
 *
 * This context delegates responsibilities to focused services:
 * - QueueService: Queue management
 * - TopicService: Topic management
 * - PortService: Port and external broker management
 * - MetricsService: Metrics collection
 */
export class EventHubContext {
  private readonly logger: Logger;
  private readonly eventHub: EventHub;
  private readonly contextName: string;
  private phase: ApplicationContextPhase = ApplicationContextPhase.Uninitialized;
  
  // Focused services that handle specific responsibilities
  private readonly queueService: QueueService;
  private readonly topicService: TopicService;
  private readonly portService: PortService;
  private readonly metricsService: MetricsService;
  
  // Events bridge for unified event streaming
  private eventsBridge: ApplicationContextEventsBridge | undefined;
  
  constructor(
    eventHub: EventHub,
    logger: Logger,
    contextName: string = 'EventHubContext'
  ) {
    this.eventHub = eventHub;
    this.logger = logger;
    this.contextName = contextName;
    
    // Initialize focused services
    this.queueService = new QueueService(eventHub, logger);
    this.topicService = new TopicService(eventHub, logger);
    this.portService = new PortService(eventHub, logger);
    this.metricsService = new MetricsService(logger);
    
    this.logger.info(`${ LOGGER_NAMESPACE } EventHubContext created`, {
      contextName: this.contextName
    });
  }
  
  // ====================================================================================
  // BASIC CONTEXT METHODS
  // ====================================================================================
  
  getContextName(): string {
    return this.contextName;
  }
  
  getPhase(): ApplicationContextPhase {
    return this.phase;
  }
  
  getEventHub(): EventHub {
    return this.eventHub;
  }
  
  // ====================================================================================
  // LIFECYCLE METHODS
  // ====================================================================================
  
  async initialize(): Promise<Either<ApplicationContextError, void>> {
    this.logger.info(`${ LOGGER_NAMESPACE } Initializing EventHubContext`);
    
    try {
      this.phase = ApplicationContextPhase.PluginInitialization;
      
      // Initialize events bridge
      await this.initializeEventsBridge();
      
      this.phase = ApplicationContextPhase.Ready;
      this.logger.info(`${ LOGGER_NAMESPACE } EventHubContext initialized successfully`);
      
      return Either.right(undefined as void);
    } catch (error) {
      this.phase = ApplicationContextPhase.Failed;
      const contextError = ApplicationContextError.create(
        UnifiedErrorCode.CONTEXT_INITIALIZATION_FAILED,
        'Failed to initialize EventHubContext',
        'initialize',
        { contextName: this.contextName },
        undefined,
        error instanceof Error ? error : undefined
      );
      
      return Either.left(contextError);
    }
  }
  
  async start(): Promise<Either<ApplicationContextError, void>> {
    if (this.phase !== ApplicationContextPhase.Ready) {
      return Either.left(ApplicationContextError.create(
        UnifiedErrorCode.INVALID_STATE,
        'EventHubContext must be initialized before starting',
        'start'
      ));
    }
    
    this.phase = ApplicationContextPhase.Running;
    this.logger.info(`${ LOGGER_NAMESPACE } EventHubContext started successfully`);
    
    return Either.right(undefined as void);
  }
  
  async stop(): Promise<Either<ApplicationContextError, void>> {
    this.logger.info(`${ LOGGER_NAMESPACE } Stopping EventHubContext`);
    
    try {
      this.phase = ApplicationContextPhase.ShuttingDown;
      
      // Cleanup all services
      await this.cleanup();
      
      this.phase = ApplicationContextPhase.Stopped;
      this.logger.info(`${ LOGGER_NAMESPACE } EventHubContext stopped successfully`);
      
      return Either.right(undefined as void);
    } catch (error) {
      this.phase = ApplicationContextPhase.Failed;
      return Either.left(ApplicationContextError.create(
        UnifiedErrorCode.OPERATION_NOT_ALLOWED,
        'Failed to stop EventHubContext',
        'stop',
        undefined,
        undefined,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  private async cleanup(): Promise<void> {
    const errors: string[] = [];
    
    // Cleanup services in reverse order
    const portResult = await this.portService.cleanup();
    if (Either.isLeft(portResult)) {
      errors.push(`Port cleanup: ${ portResult.left.message }`);
    }
    
    const topicResult = await this.topicService.cleanup();
    if (Either.isLeft(topicResult)) {
      errors.push(`Topic cleanup: ${ topicResult.left.message }`);
    }
    
    const queueResult = await this.queueService.cleanup();
    if (Either.isLeft(queueResult)) {
      errors.push(`Queue cleanup: ${ queueResult.left.message }`);
    }
    
    if (this.eventsBridge) {
      this.eventsBridge.destroy();
      this.eventsBridge = undefined;
    }
    
    if (errors.length > 0) {
      this.logger.warn(`${ LOGGER_NAMESPACE } Some cleanup operations failed: ${ errors.join(', ') }`);
    }
  }
  
  private async initializeEventsBridge(): Promise<void> {
    const contextInterface = {
      getName: () => this.contextName,
      getPhase: () => this.phase,
      pluginManager: { on: () => {}, off: () => {} }
    };
    
    this.eventsBridge = new ApplicationContextEventsBridge(
      contextInterface as any,
      this.eventHub,
      this.logger
    );
    
    this.eventsBridge.initialize();
  }
  
  // ====================================================================================
  // QUEUE METHODS - Delegated to QueueService
  // ====================================================================================
  
  async createQueue(config: QueueConfig) { return this.queueService.createQueue(config); }
  async deleteQueue(name: string) { return this.queueService.deleteQueue(name); }
  getQueue(name: string) { return this.queueService.getQueue(name); }
  getMessageSender() { return this.queueService.getMessageSender(); }
  getMessageReceiver() { return this.queueService.getMessageReceiver(); }
  async sendMessage<T>(
    queueName: string,
    message: T
  ) { return this.queueService.sendMessage(queueName, message); }
  async receiveMessage<T>(queueName: string) { return this.queueService.receiveMessage<T>(queueName); }
  
  // ====================================================================================
  // TOPIC METHODS - Delegated to TopicService
  // ====================================================================================
  
  async createTopic(config: TopicConfig) { return this.topicService.createTopic(config); }
  async deleteTopic(name: string) { return this.topicService.deleteTopic(name); }
  getTopic(name: string) { return this.topicService.getTopic(name); }
  getPublisher() { return this.topicService.getPublisher(); }
  getSubscriber() { return this.topicService.getSubscriber(); }
  async publishToTopic<T>(
    topicName: string,
    message: T
  ) { return this.topicService.publishToTopic(topicName, message); }
  async subscribeToTopic<T>(
    topicName: string,
    listener: EventListener<T>
  ) { return this.topicService.subscribeToTopic(topicName, listener); }
  async unsubscribeFromTopic(subscriptionId: string) { return this.topicService.unsubscribeFromTopic(subscriptionId); }
  
  // ====================================================================================
  // PORT METHODS - Delegated to PortService
  // ====================================================================================
  
  registerEventBrokerPort(
    name: string,
    port: EventBrokerPort
  ) { return this.portService.registerEventBrokerPort(name, port); }
  unregisterEventBrokerPort(name: string) { return this.portService.unregisterEventBrokerPort(name); }
  getEventBrokerPort(name: string) { return this.portService.getEventBrokerPort(name); }
  getEventPublisherPort() { return this.portService.getEventPublisherPort(); }
  getEventSubscriberPort() { return this.portService.getEventSubscriberPort(); }
  async connectToExternalBroker(config: EventBrokerConfig) {
    // Generate a unique name for the broker connection
    const brokerName = `broker-${Date.now()}`;
    return this.portService.connectToExternalBroker(brokerName, config);
  }
  async disconnectFromExternalBroker(brokerId: string) {
    return this.portService.disconnectFromExternalBroker(brokerId);
  }
  
  // ====================================================================================
  // METRICS METHODS - Delegated to MetricsService
  // ====================================================================================
  
  async getEventHubMetrics(): Promise<EventHubMetrics> {
    return this.metricsService.getEventHubMetrics(
      this.contextName,
      this.phase,
      this.queueService,
      this.topicService,
      this.portService
    );
  }
  
  // ====================================================================================
  // EVENTS BRIDGE METHODS
  // ====================================================================================
  
  getEventsBridge(): Maybe<ApplicationContextEventsBridge> {
    return this.eventsBridge ? Maybe.just(this.eventsBridge) : Maybe.nothing();
  }
  
  isEventsBridgeInitialized(): boolean {
    return this.eventsBridge !== undefined;
  }
}
