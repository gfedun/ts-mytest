/**
 * @fileoverview Core EventHub Implementation
 *
 * This module contains the main EventHub class that manages centralized
 * event routing, distribution, queues, outlets, and adapters for both
 * in-memory and external message broker integration.
 *
 * @author
 * @version 1.0.0
 */

import { Either } from '@/either';
import { Queue } from "@/eventhub/queue/Queue";
import {
  EventQueueConfig,
  QueueConfig
} from "@/eventhub/queue/types";
import {
  EventSubscription,
  SubscriptionOptions,
  TopicConfig
} from "@/eventhub/topic";
import { Publisher } from "@/eventhub/topic/Publisher";
import { Subscriber } from "@/eventhub/topic/Subscriber";
import { Topic } from "@/eventhub/topic/Topic";
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Logger } from "@/logger";
import { Maybe } from '@/maybe';
import { Mutable } from "@/utils";
import { EventHubError } from './EventHubError';
import {
  EventBrokerPort,
  EventPublisherPort,
  EventSubscriberPort
} from './ports';
import { EventBrokerConfig } from './ports/types';
import { MessageReceiver } from './queue/MessageReceiver';
import { MessageSender } from './queue/MessageSender';
import { QueueManager } from './queue/QueueManager';
import { TopicManager } from './topic/TopicManager';
import {
  Event,
  EventAdapter,
  EventHubConfig,
  EventHubMetrics,
  EventListener,
  EventPriority
} from './types';

/**
 * Internal EventHub lifecycle events
 */
export interface EventHubInternalEvents {
  // Queue lifecycle events
  'queue:created': { queueName: string; config: QueueConfig; timestamp: Date };
  'queue:deleted': { queueName: string; timestamp: Date };
  'message:sent': { queueName: string; messageId?: string; timestamp: Date };
  'message:received': { queueName: string; messageId?: string; timestamp: Date };
  
  // Topic lifecycle events
  'topic:created': { topicName: string; config: TopicConfig; timestamp: Date };
  'topic:deleted': { topicName: string; timestamp: Date };
  'message:published': { topicName: string; messageId?: string; timestamp: Date };
  'subscription:created': { topicName: string; subscriptionId: string; timestamp: Date };
  'subscription:cancelled': { topicName: string; subscriptionId: string; timestamp: Date };
  
  // Port/Broker lifecycle events
  'port:registered': { portName: string; portType: string; timestamp: Date };
  'port:unregistered': { portName: string; timestamp: Date };
  'broker:connected': { brokerId: string; config: EventBrokerConfig; timestamp: Date };
  'broker:disconnected': { brokerId: string; timestamp: Date };
  'broker:connection_failed': { brokerId: string; error: string; timestamp: Date };
}

/**
 * Internal event listener type
 */
export type InternalEventListener<K extends keyof EventHubInternalEvents> = (
  data: EventHubInternalEvents[K]
) => void;

/**
 * Add missing type definitions
 */
interface EventListenerRegistration {
  id: string;
  listener: EventListener;
  options?: SubscriptionOptions;
  registeredAt?: Date;
}

interface ExtEventSubscription
  extends Mutable<EventSubscription> {
  eventType: string;
  setActive: (active: boolean) => void;
  incrementRetries: () => void;
  getRetries: () => number;
}

/**
 * EventHub main interface
 */
export abstract class EventHub {
  /** EventHub name */
  abstract readonly name: string;
  /** EventHub configuration */
  abstract readonly config: EventHubConfig;
  
  /** Initialize the EventHub */
  abstract initialize(): Promise<Either<EventHubError, void>>;
  /** Start the EventHub */
  abstract start(): Promise<Either<EventHubError, void>>;
  /** Stop the EventHub */
  abstract stop(): Promise<Either<EventHubError, void>>;
  /** Check if EventHub is running */
  abstract isRunning(): boolean;
  
  /** Emit an event */
  abstract emit<T>(event: Event<T>): Promise<Either<EventHubError, void>>;
  
  /** Publish event with automatic Event wrapping */
  abstract publish<T>(
    eventType: string,
    data: T,
    source?: string,
    priority?: EventPriority,
    options?: {
      correlationId?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<Either<EventHubError, void>>;
  
  /** Subscribe to events */
  abstract on<T>(
    eventType: string,
    listener: EventListener<T>,
    options?: SubscriptionOptions
  ): Either<EventHubError, EventSubscription>;
  
  /** Unsubscribe from events */
  abstract off(subscriptionId: string): Either<EventHubError, void>;
  
  /** Topic management */
  abstract createTopic(config: TopicConfig): Promise<Either<EventHubError, Topic>>;
  abstract getTopic(name: string): Maybe<Topic>;
  abstract deleteTopic(name: string): Promise<Either<EventHubError, void>>;
  
  /** Publisher/Subscriber pattern */
  abstract getPublisher(): Publisher;
  abstract getSubscriber(): Subscriber;
  
  /** Queue management */
  abstract createQueue(config: QueueConfig): Promise<Either<EventHubError, Queue>>;
  abstract getQueue(name: string): Maybe<Queue>;
  abstract deleteQueue(name: string): Promise<Either<EventHubError, void>>;
  
  /** Message sending/receiving */
  abstract getMessageSender(): MessageSender;
  abstract getMessageReceiver(): MessageReceiver;
  
  /** Port management for external broker integration */
  abstract registerEventBrokerPort(
    name: string,
    port: EventBrokerPort
  ): Either<EventHubError, void>;
  abstract unregisterEventBrokerPort(name: string): Either<EventHubError, void>;
  abstract getEventBrokerPort(name: string): Maybe<EventBrokerPort>;
  abstract getEventPublisherPort(): EventPublisherPort;
  abstract getEventSubscriberPort(): EventSubscriberPort;
  abstract connectToExternalBroker(config: EventBrokerConfig): Promise<Either<EventHubError, void>>;
  abstract disconnectFromExternalBroker(brokerId: string): Promise<Either<EventHubError, void>>;
  
  /** Get metrics */
  abstract getMetrics(): EventHubMetrics;
}

const defaultEventQueueConfig: EventQueueConfig = {
  name: "default",
  maxSize: 10000,
  persistent: false,
  enableDeduplication: true, // Good for preventing duplicate processing
}

const defaultEventHubConfig: EventHubConfig = {
  enableMetrics: true,
  eventTimeoutMs: 30000,
}

/**
 * Core EventHub implementation for centralized event management
 */
export class EventHubImpl
  extends EventHub {
  
  public readonly config: EventHubConfig;
  private _initialized = false;
  private _running = false;
  private _listeners = new Map<string, Set<EventListenerRegistration>>();
  private _brokers = new Map<string, EventBrokerPort>();
  private _adapters = new Map<string, EventAdapter>();
  private _subscriptions = new Map<string, ExtEventSubscription>();
  private _metrics: {
    eventsProcessed: number;
    failedEvents: number;
    activeSubscriptions: number;
    [key: string]: any;
  };
  private _startTime?: Date;
  
  // Publisher-Subscriber components
  private _topicManager: TopicManager;
  private _publisher: Publisher;
  private _subscriber: Subscriber;
  
  // Point-to-Point Queue components
  private _queueManager: QueueManager;
  private _messageSender: MessageSender;
  private _messageReceiver: MessageReceiver;
  
  // Internal event emission
  private _internalEventListeners = new Map<keyof EventHubInternalEvents, Set<InternalEventListener<any>>>();
  
  constructor(
    public readonly name: string,
    private readonly _logger: Logger,
    config: Partial<EventHubConfig>
  ) {
    super();
    this.config = {
      ...defaultEventHubConfig,
      ...config
    };
    
    this._metrics = {
      eventsProcessed: 0,
      failedEvents: 0,
      activeSubscriptions: 0
    };
    
    // Initialize Publisher-Subscriber components
    this._topicManager = TopicManager.create();
    this._publisher = Publisher.create(this._topicManager);
    this._subscriber = Subscriber.create(this._topicManager);
    
    // Initialize Point-to-Point Queue components
    this._queueManager = QueueManager.create();
    this._messageSender = MessageSender.create(this._queueManager);
    this._messageReceiver = MessageReceiver.create(this._queueManager);
  }
  
  // ====================================================================================
  // INTERNAL EVENT EMISSION METHODS
  // ====================================================================================
  
  /**
   * Add listener for internal EventHub lifecycle events
   */
  public onInternal<K extends keyof EventHubInternalEvents>(
    eventType: K,
    listener: InternalEventListener<K>
  ): void {
    if (!this._internalEventListeners.has(eventType)) {
      this._internalEventListeners.set(eventType, new Set());
    }
    this._internalEventListeners.get(eventType)!.add(listener);
  }
  
  /**
   * Remove listener for internal EventHub lifecycle events
   */
  public offInternal<K extends keyof EventHubInternalEvents>(
    eventType: K,
    listener: InternalEventListener<K>
  ): void {
    const listeners = this._internalEventListeners.get(eventType);
    if (listeners) {
      listeners.delete(listener);
    }
  }
  
  /**
   * Emit internal EventHub lifecycle event
   */
  private emitInternal<K extends keyof EventHubInternalEvents>(
    eventType: K,
    data: EventHubInternalEvents[K]
  ): void {
    const listeners = this._internalEventListeners.get(eventType);
    if (listeners) {
      listeners.forEach(listener => {
        try {
          listener(data);
        } catch (error) {
          this.error(`Error in internal event listener for ${eventType}:`, error);
        }
      });
    }
  }
  
  // ====================================================================================
  // POINT-TO-POINT QUEUE METHODS
  // ====================================================================================
  
  /**
   * Create a new queue for Point-to-Point messaging
   */
  async createQueue(config: QueueConfig): Promise<Either<EventHubError, Queue>> {
    if (!this._running) {
      return Either.left(EventHubError.create(
        UnifiedErrorCode.EVENTHUB_INVALID_STATE,
        'EventHub is stopped, cannot create queue',
        'createQueue',
        {
          timestamp: new Date(),
          module: 'EVENTHUB',
          queueName: config.name
        }
      ));
    }
    
    const result = await this._queueManager.createQueue(config);
    
    // Emit internal event on successful queue creation
    if (result.isRight()) {
      this.emitInternal('queue:created', {
        queueName: config.name,
        config,
        timestamp: new Date()
      });
    }
    
    return result;
  }
  
  /**
   * Get an existing queue
   */
  getQueue(name: string): Maybe<Queue> {
    return this._queueManager.getQueue(name);
  }
  
  /**
   * Delete a queue
   */
  async deleteQueue(name: string): Promise<Either<EventHubError, void>> {
    const result = await this._queueManager.deleteQueue(name);
    
    // Emit internal event on successful queue deletion
    if (result.isRight()) {
      this.emitInternal('queue:deleted', {
        queueName: name,
        timestamp: new Date()
      });
    }
    
    return result;
  }
  
  /**
   * Get MessageSender instance for sending messages to queues
   */
  getMessageSender(): MessageSender {
    return this._messageSender;
  }
  
  /**
   * Get MessageReceiver instance for receiving messages from queues
   */
  getMessageReceiver(): MessageReceiver {
    return this._messageReceiver;
  }
  
  /**
   * Get QueueManager instance for advanced queue management
   */
  getQueueManager(): QueueManager {
    return this._queueManager;
  }
  
  // ====================================================================================
  // PORT MANAGEMENT METHODS - External Broker Integration
  // ====================================================================================
  
  /**
   * Register an EventBrokerPort for external broker communication
   */
  registerEventBrokerPort(
    name: string,
    port: EventBrokerPort
  ): Either<EventHubError, void> {
    try {
      this.debug(`Registering EventBrokerPort: ${ name }`, { portType: port.type });
      
      // Check if port with same name already exists
      if (this._brokers.has(name)) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.ADAPTER_INITIALIZATION_FAILED,
          `EventBrokerPort '${ name }' already exists`,
          'registerEventBrokerPort',
          {
            timestamp: new Date(),
            module: 'EVENTHUB',
            adapterId: name
          }
        ));
      }
      
      // Validate port
      if (!port.name || !port.type) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.INVALID_ADAPTER_CONFIG,
          `Invalid EventBrokerPort configuration for '${ name }': missing name or type`,
          'registerEventBrokerPort',
          {
            timestamp: new Date(),
            module: 'EVENTHUB',
            adapterId: name,
            additionalData: { brokerType: port.type }
          }
        ));
      }
      
      // Register the port
      this._brokers.set(name, port);
      
      // Emit internal event on successful port registration
      this.emitInternal('port:registered', {
        portName: name,
        portType: port.type,
        timestamp: new Date()
      });
      
      this.info(`EventBrokerPort registered successfully: ${ name }`, {
        portType: port.type,
        totalPorts: this._brokers.size
      });
      
      return Either.right(undefined as void);
      
    } catch (error) {
      const portError = EventHubError.create(
        UnifiedErrorCode.ADAPTER_INITIALIZATION_FAILED,
        `Failed to register EventBrokerPort '${ name }': ${ error instanceof Error ? error.message : String(error) }`,
        'registerEventBrokerPort',
        {
          timestamp: new Date(),
          module: 'EVENTHUB',
          adapterId: name,
          additionalData: { brokerType: port.type }
        },
        undefined,
        error instanceof Error ? error : undefined
      );
      this._logger.error(portError.getDetailedMessage());
      return Either.left(portError);
    }
  }
  
  /**
   * Unregister an EventBrokerPort
   */
  unregisterEventBrokerPort(name: string): Either<EventHubError, void> {
    try {
      this.debug(`Unregistering EventBrokerPort: ${ name }`);
      
      // Check if port exists
      if (!this._brokers.has(name)) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.ADAPTER_NOT_FOUND,
          `EventBrokerPort '${ name }' not found`,
          'unregisterEventBrokerPort',
          {
            timestamp: new Date(),
            module: 'EVENTHUB',
            adapterId: name
          }
        ));
      }
      
      // Remove the port
      this._brokers.delete(name);
      
      // Emit internal event on successful port unregistration
      this.emitInternal('port:unregistered', {
        portName: name,
        timestamp: new Date()
      });
      
      this.info(`EventBrokerPort unregistered successfully: ${ name }`, {
        totalPorts: this._brokers.size
      });
      
      return Either.right(undefined as void);
      
    } catch (error) {
      const portError = EventHubError.create(
        UnifiedErrorCode.ADAPTER_INITIALIZATION_FAILED,
        `Failed to unregister EventBrokerPort '${ name }': ${ error instanceof Error ? error.message : String(error) }`,
        'unregisterEventBrokerPort',
        {
          timestamp: new Date(),
          module: 'EVENTHUB',
          adapterId: name
        },
        undefined,
        error instanceof Error ? error : undefined
      );
      this._logger.error(portError.getDetailedMessage());
      return Either.left(portError);
    }
  }
  
  /**
   * Get a registered EventBrokerPort by name
   */
  getEventBrokerPort(name: string): Maybe<EventBrokerPort> {
    try {
      this.debug(`Getting EventBrokerPort: ${ name }`);
      
      const port = this._brokers.get(name);
      if (port) {
        return Maybe.just(port);
      }
      
      this.debug(`EventBrokerPort '${ name }' not found`);
      return Maybe.nothing();
      
    } catch (error) {
      this.warn(
        `Failed to get EventBrokerPort '${ name }': ${ error instanceof Error ? error.message : String(error) }`);
      return Maybe.nothing();
    }
  }
  
  /**
   * Get the EventPublisherPort for publishing events to external brokers
   */
  getEventPublisherPort(): EventPublisherPort {
    // For now, return a default implementation that publishes through registered brokers
    return {
      name: 'eventhub-publisher-port',
      type: 'eventhub-internal',
      publish: async (event) => {
        try {
          if (!this._running) {
            return Either.left(EventHubError.create(
              UnifiedErrorCode.EVENTHUB_NOT_INITIALIZED,
              'EventHub is not running - cannot publish to external brokers',
              'publish',
              {
                timestamp: new Date(),
                module: 'EVENTHUB',
                eventId: event.id,
                eventType: event.type
              }
            ));
          }
          
          // Publish through all registered broker ports
          const brokerResults = await Promise.allSettled(
            Array.from(this._brokers.values()).map(async (broker) => {
              if ('publish' in broker && typeof broker.publish === 'function') {
                return await (broker as any).publish(event);
              }
              return Either.right(undefined);
            })
          );
          
          // Check if any broker failed
          const failures = brokerResults
            .filter(result => result.status === 'rejected')
            .map(result => (result as PromiseRejectedResult).reason);
          
          if (failures.length > 0) {
            return Either.left(EventHubError.create(
              UnifiedErrorCode.ADAPTER_SEND_FAILED,
              `Failed to publish to ${ failures.length } broker(s)`,
              'publish',
              {
                timestamp: new Date(),
                module: 'EVENTHUB',
                eventId: event.id,
                eventType: event.type,
                additionalData: { failureCount: failures.length }
              }
            ));
          }
          
          return Either.right(undefined as void);
        } catch (error) {
          return Either.left(EventHubError.create(
            UnifiedErrorCode.ADAPTER_SEND_FAILED,
            `Unexpected error publishing event: ${ error instanceof Error ? error.message : String(error) }`,
            'publish',
            {
              timestamp: new Date(),
              module: 'EVENTHUB',
              eventId: event.id,
              eventType: event.type
            },
            undefined,
            error instanceof Error ? error : undefined
          ));
        }
      },
      publishBatch: async (events) => {
        try {
          if (!this._running) {
            return Either.left(EventHubError.create(
              UnifiedErrorCode.EVENTHUB_NOT_INITIALIZED,
              'EventHub is not running - cannot publish batch to external brokers',
              'publishBatch',
              {
                timestamp: new Date(),
                module: 'EVENTHUB',
                additionalData: { eventCount: events.length }
              }
            ));
          }
          
          // Publish batch through all registered broker ports
          const brokerResults = await Promise.allSettled(
            Array.from(this._brokers.values()).map(async (broker) => {
              if ('publishBatch' in broker && typeof broker.publishBatch === 'function') {
                return await (broker as any).publishBatch(events);
              }
              // Fall back to individual publishes if batch not supported
              return await Promise.all(events.map(event =>
                'publish' in broker && typeof broker.publish === 'function'
                  ? (broker as any).publish(event)
                  : Either.right(undefined)
              ));
            })
          );
          
          const failures = brokerResults
            .filter(result => result.status === 'rejected')
            .map(result => (result as PromiseRejectedResult).reason);
          
          if (failures.length > 0) {
            return Either.left(EventHubError.create(
              UnifiedErrorCode.ADAPTER_SEND_FAILED,
              `Failed to publish batch to ${ failures.length } broker(s)`,
              'publishBatch',
              {
                timestamp: new Date(),
                module: 'EVENTHUB',
                additionalData: { eventCount: events.length, failureCount: failures.length }
              }
            ));
          }
          
          return Either.right(undefined as void);
        } catch (error) {
          return Either.left(EventHubError.create(
            UnifiedErrorCode.ADAPTER_SEND_FAILED,
            `Unexpected error publishing event batch: ${ error instanceof Error ? error.message : String(error) }`,
            'publishBatch',
            {
              timestamp: new Date(),
              module: 'EVENTHUB',
              additionalData: { eventCount: events.length }
            },
            undefined,
            error instanceof Error ? error : undefined
          ));
        }
      },
      isReady: async () => {
        try {
          if (!this._running) {
            return Either.right(false);
          }
          
          // Check if any broker ports are ready
          const readinessResults = await Promise.allSettled(
            Array.from(this._brokers.values()).map(async (broker) => {
              if ('isReady' in broker && typeof broker.isReady === 'function') {
                return await (broker as any).isReady();
              }
              return Either.right(true); // Default to ready if method not available
            })
          );
          
          const anyReady = readinessResults.some(result =>
            result.status === 'fulfilled' &&
            Either.isRight(result.value) &&
            result.value.right === true
          );
          
          return Either.right(anyReady || this._brokers.size === 0); // Ready if any broker is ready or no brokers
        } catch (error) {
          return Either.left(EventHubError.create(
            UnifiedErrorCode.ADAPTER_CONNECTION_FAILED,
            `Error checking subscriber port readiness: ${ error instanceof Error ? error.message : String(error) }`,
            'isReady',
            {
              timestamp: new Date(),
              module: 'EVENTHUB'
            },
            undefined,
            error instanceof Error ? error : undefined
          ));
        }
      }
    };
  }
  
  /**
   * Get the EventSubscriberPort for subscribing to events from external brokers
   */
  getEventSubscriberPort(): EventSubscriberPort {
    // Return a default implementation that subscribes through registered brokers
    return {
      name: 'eventhub-subscriber-port',
      type: 'eventhub-internal',
      subscribe: async <T>(handler: EventListener<T>) => {
        try {
          if (!this._running) {
            return Either.left(EventHubError.create(
              UnifiedErrorCode.EVENTHUB_NOT_INITIALIZED,
              'EventHub is not running - cannot subscribe to external brokers',
              'subscribe',
              {
                timestamp: new Date(),
                module: 'EVENTHUB'
              }
            ));
          }
          
          // Subscribe through all registered broker ports that support subscription
          const subscriptionResults = await Promise.allSettled(
            Array.from(this._brokers.values()).map(async (broker) => {
              if ('subscribe' in broker && typeof broker.subscribe === 'function') {
                return await (broker as any).subscribe(handler);
              }
              return Either.right(undefined);
            })
          );
          
          // Check if any subscription failed
          const failures = subscriptionResults
            .filter(result => result.status === 'rejected')
            .map(result => (result as PromiseRejectedResult).reason);
          
          if (failures.length > 0) {
            return Either.left(EventHubError.create(
              UnifiedErrorCode.ADAPTER_INITIALIZATION_FAILED,
              `Failed to subscribe to ${ failures.length } broker(s)`,
              'subscribe',
              {
                timestamp: new Date(),
                module: 'EVENTHUB',
                additionalData: { failureCount: failures.length }
              }
            ));
          }
          
          return Either.right(undefined as void);
        } catch (error) {
          return Either.left(EventHubError.create(
            UnifiedErrorCode.ADAPTER_INITIALIZATION_FAILED,
            `Unexpected error subscribing to external brokers: ${ error instanceof Error ? error.message : String(
              error) }`,
            'subscribe',
            {
              timestamp: new Date(),
              module: 'EVENTHUB'
            },
            undefined,
            error instanceof Error ? error : undefined
          ));
        }
      },
      unsubscribe: async () => {
        try {
          if (!this._running) {
            return Either.left(EventHubError.create(
              UnifiedErrorCode.EVENTHUB_NOT_INITIALIZED,
              'EventHub is not running - cannot unsubscribe from external brokers',
              'unsubscribe',
              {
                timestamp: new Date(),
                module: 'EVENTHUB'
              }
            ));
          }
          
          // Unsubscribe from all registered broker ports that support unsubscription
          const unsubscribeResults = await Promise.allSettled(
            Array.from(this._brokers.values()).map(async (broker) => {
              if ('unsubscribe' in broker && typeof broker.unsubscribe === 'function') {
                return await (broker as any).unsubscribe();
              }
              return Either.right(undefined);
            })
          );
          
          const failures = unsubscribeResults
            .filter(result => result.status === 'rejected')
            .map(result => (result as PromiseRejectedResult).reason);
          
          if (failures.length > 0) {
            return Either.left(EventHubError.create(
              UnifiedErrorCode.ADAPTER_INITIALIZATION_FAILED,
              `Failed to unsubscribe from ${ failures.length } broker(s)`,
              'unsubscribe',
              {
                timestamp: new Date(),
                module: 'EVENTHUB',
                additionalData: { failureCount: failures.length }
              }
            ));
          }
          
          return Either.right(undefined as void);
        } catch (error) {
          return Either.left(EventHubError.create(
            UnifiedErrorCode.ADAPTER_INITIALIZATION_FAILED,
            `Unexpected error unsubscribing from external brokers: ${ error instanceof Error ? error.message : String(
              error) }`,
            'unsubscribe',
            {
              timestamp: new Date(),
              module: 'EVENTHUB'
            },
            undefined,
            error instanceof Error ? error : undefined
          ));
        }
      },
      isSubscribed: async () => {
        try {
          if (!this._running) {
            return Either.right(false);
          }
          
          // Check if any broker ports are subscribed
          const subscriptionResults = await Promise.allSettled(
            Array.from(this._brokers.values()).map(async (broker) => {
              if ('isSubscribed' in broker && typeof broker.isSubscribed === 'function') {
                return await (broker as any).isSubscribed();
              }
              return Either.right(false); // Default to not subscribed if method not available
            })
          );
          
          const anySubscribed = subscriptionResults.some(result =>
            result.status === 'fulfilled' &&
            Either.isRight(result.value) &&
            result.value.right === true
          );
          
          return Either.right(anySubscribed);
        } catch (error) {
          return Either.left(EventHubError.create(
            UnifiedErrorCode.ADAPTER_CONNECTION_FAILED,
            `Error checking subscription status: ${ error instanceof Error ? error.message : String(error) }`,
            'isSubscribed',
            {
              timestamp: new Date(),
              module: 'EVENTHUB'
            },
            undefined,
            error instanceof Error ? error : undefined
          ));
        }
      },
      isReady: async () => {
        try {
          if (!this._running) {
            return Either.right(false);
          }
          
          // Check if any broker ports are ready for subscription
          const readinessResults = await Promise.allSettled(
            Array.from(this._brokers.values()).map(async (broker) => {
              if ('isReady' in broker && typeof broker.isReady === 'function') {
                return await (broker as any).isReady();
              }
              return Either.right(true); // Default to ready if method not available
            })
          );
          
          const anyReady = readinessResults.some(result =>
            result.status === 'fulfilled' &&
            Either.isRight(result.value) &&
            result.value.right === true
          );
          
          return Either.right(anyReady || this._brokers.size === 0); // Ready if any broker is ready or no brokers
        } catch (error) {
          return Either.left(EventHubError.create(
            UnifiedErrorCode.ADAPTER_CONNECTION_FAILED,
            `Error checking subscriber port readiness: ${ error instanceof Error ? error.message : String(error) }`,
            'isReady',
            {
              timestamp: new Date(),
              module: 'EVENTHUB'
            },
            undefined,
            error instanceof Error ? error : undefined
          ));
        }
      }
    };
  }
  
  /**
   * Connect to an external broker using the provided configuration
   */
  async connectToExternalBroker(config: EventBrokerConfig): Promise<Either<EventHubError, void>> {
    try {
      this.debug('Connecting to external broker', {
        connection: typeof config.connection === 'string' ? config.connection : '[object]',
        serialization: config.serialization,
        subscriptions: config.subscriptions?.length || 0
      });
      
      if (!this._running) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.EVENTHUB_NOT_INITIALIZED,
          'Cannot connect to external broker - EventHub is not running',
          'connectToExternalBroker',
          {
            timestamp: new Date(),
            module: 'EVENTHUB',
            additionalData: { serialization: config.serialization }
          }
        ));
      }
      
      // For now, this is a placeholder implementation
      // In a real implementation, this would:
      // 1. Create appropriate broker adapter based on config
      // 2. Establish connection
      // 3. Set up subscriptions
      // 4. Register the adapter as a broker port
      
      this.info('External broker connection functionality not yet fully implemented');
      
      return Either.left(EventHubError.create(
        UnifiedErrorCode.ADAPTER_CONNECTION_FAILED,
        'External broker connection not yet fully implemented',
        'connectToExternalBroker',
        {
          timestamp: new Date(),
          module: 'EVENTHUB',
          additionalData: { serialization: config.serialization }
        }
      ));
      
    } catch (error) {
      return Either.left(EventHubError.create(
        UnifiedErrorCode.ADAPTER_CONNECTION_FAILED,
        `Unexpected error connecting to external broker: ${ error instanceof Error ? error.message : String(error) }`,
        'connectToExternalBroker',
        {
          timestamp: new Date(),
          module: 'EVENTHUB',
          additionalData: { serialization: config.serialization }
        },
        undefined,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  /**
   * Disconnect from an external broker
   */
  async disconnectFromExternalBroker(brokerId: string): Promise<Either<EventHubError, void>> {
    try {
      this.debug(`Disconnecting from external broker: ${ brokerId }`);
      
      // Check if broker exists
      const broker = this._brokers.get(brokerId);
      if (!broker) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.ADAPTER_NOT_FOUND,
          `External broker '${ brokerId }' not found`,
          'disconnectFromExternalBroker',
          {
            timestamp: new Date(),
            module: 'EVENTHUB',
            adapterId: brokerId
          }
        ));
      }
      
      // Disconnect if broker supports it
      if ('disconnect' in broker && typeof broker.disconnect === 'function') {
        const disconnectResult = await (broker as any).disconnect();
        if (Either.isLeft(disconnectResult)) {
          return Either.left(EventHubError.create(
            UnifiedErrorCode.ADAPTER_DISCONNECTION_FAILED,
            `Failed to disconnect from external broker '${ brokerId }': ${ disconnectResult.left.message }`,
            'disconnectFromExternalBroker',
            {
              timestamp: new Date(),
              module: 'EVENTHUB',
              adapterId: brokerId
            },
            undefined,
            disconnectResult.left
          ));
        }
      }
      
      // Remove broker from registry
      this._brokers.delete(brokerId);
      
      this.info(`Successfully disconnected from external broker: ${ brokerId }`);
      return Either.right(undefined as void);
      
    } catch (error) {
      return Either.left(EventHubError.create(
        UnifiedErrorCode.ADAPTER_DISCONNECTION_FAILED,
        `Unexpected error disconnecting from external broker '${ brokerId }': ${ error instanceof Error ? error.message : String(
          error) }`,
        'disconnectFromExternalBroker',
        {
          timestamp: new Date(),
          module: 'EVENTHUB',
          adapterId: brokerId
        },
        undefined,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  /**
   * Initialize the EventHub
   */
  async initialize(): Promise<Either<EventHubError, void>> {
    try {
      if (this._initialized) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.EVENTHUB_ALREADY_INITIALIZED,
          'EventHub is already initialized',
          'initialize',
          {
            timestamp: new Date(),
            module: 'EVENTHUB',
            additionalData: { currentState: 'initialized' }
          }
        ));
      }
      
      this._initialized = true;
      this._logger.info('EventHub initialized successfully');
      return Either.right(undefined as void);
    } catch (error) {
      const initError = EventHubError.create(
        UnifiedErrorCode.EVENTHUB_NOT_INITIALIZED,
        'EventHub initialization failed',
        'initialize',
        {
          timestamp: new Date(),
          module: 'EVENTHUB',
          additionalData: { currentState: 'initializing' }
        },
        undefined,
        error instanceof Error ? error : undefined
      );
      this._logger.error(initError.getDetailedMessage());
      return Either.left(initError);
    }
  }
  
  /**
   * Start the EventHub
   */
  async start(): Promise<Either<EventHubError, void>> {
    try {
      if (!this._initialized) {
        const initResult = await this.initialize();
        if (Either.isLeft(initResult)) {
          return initResult;
        }
      }
      
      if (this._running) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.EVENTHUB_ALREADY_INITIALIZED,
          'EventHub is already running',
          'start',
          {
            timestamp: new Date(),
            module: 'EVENTHUB',
            additionalData: { currentState: 'running' }
          }
        ));
      }
      
      this._running = true;
      this._startTime = new Date();
      this._logger.info('EventHub started successfully');
      
      return Either.right(undefined as void);
    } catch (error) {
      const startError = EventHubError.create(
        UnifiedErrorCode.EVENTHUB_INVALID_STATE,
        'Failed to start EventHub',
        'start',
        {
          timestamp: new Date(),
          module: 'EVENTHUB',
          additionalData: { currentState: 'starting' }
        },
        undefined,
        error instanceof Error ? error : undefined
      );
      this._logger.error(startError.getDetailedMessage());
      return Either.left(startError);
    }
  }
  
  /**
   * Stop the EventHub
   */
  async stop(): Promise<Either<EventHubError, void>> {
    try {
      if (!this._running) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.EVENTHUB_INVALID_STATE,
          'EventHub is not running',
          'stop',
          {
            timestamp: new Date(),
            module: 'EVENTHUB',
            additionalData: { currentState: 'stopped' }
          }
        ));
      }
      
      // Stop all topics - use available method
      const topics = this._topicManager.listTopics();
      for (const topicName of topics) {
        try {
          await this._topicManager.deleteTopic(topicName);
        } catch (error) {
          this._logger.error(`Failed to stop topic ${ topicName }:`, error);
        }
      }
      
      this._running = false;
      this._logger.info('EventHub stopped successfully');
      return Either.right(undefined as void);
    } catch (error) {
      const stopError = EventHubError.create(
        UnifiedErrorCode.EVENTHUB_SHUTDOWN_FAILED,
        'Failed to stop EventHub',
        'stop',
        {
          timestamp: new Date(),
          module: 'EVENTHUB',
          additionalData: { currentState: 'stopping' }
        },
        undefined,
        error instanceof Error ? error : undefined
      );
      this._logger.error(stopError.getDetailedMessage());
      return Either.left(stopError);
    }
  }
  
  /**
   * Check if EventHub is running
   */
  isRunning(): boolean {
    return this._running;
  }
  
  /**
   * Emit an event (existing functionality)
   */
  async emit<T>(event: Event<T>): Promise<Either<EventHubError, void>> {
    try {
      if (!this._running) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.EVENTHUB_NOT_INITIALIZED,
          'EventHub is not running',
          'emit',
          {
            timestamp: new Date(),
            module: 'EVENTHUB',
            eventId: event.id,
            eventType: event.type,
            additionalData: { currentState: 'stopped' }
          }
        ));
      }
      
      // Validate event
      if (!event.id || !event.type) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.EVENT_VALIDATION_FAILED,
          'Event validation failed: missing required fields',
          'emit',
          {
            timestamp: new Date(),
            module: 'EVENTHUB',
            eventId: event.id,
            eventType: event.type
          }
        ));
      }
      
      // Process listeners for this event type
      const listeners = this._listeners.get(event.type) || new Set();
      const processingPromises = Array.from(listeners).map(async (registration) => {
        try {
          const result = registration.listener(event);
          if (result instanceof Promise) {
            await result;
          }
        } catch (error) {
          const processingError = EventHubError.create(
            UnifiedErrorCode.EVENT_PROCESSING_FAILED,
            `Event processing failed for ${ event.id }: ${ error instanceof Error ? error.message : String(error) }`,
            'emit',
            {
              timestamp: new Date(),
              module: 'EVENTHUB',
              eventId: event.id,
              eventType: event.type
            },
            undefined,
            error instanceof Error ? error : undefined
          );
          this._logger.error(processingError.getDetailedMessage());
          throw processingError;
        }
      });
      
      await Promise.all(processingPromises);
      this._metrics.eventsProcessed++;
      
      return Either.right(undefined as void);
    } catch (error) {
      this._metrics.failedEvents++;
      if (error instanceof EventHubError) {
        return Either.left(error);
      }
      
      const processingError = EventHubError.create(
        UnifiedErrorCode.EVENT_PROCESSING_FAILED,
        'Event processing failed',
        'emit',
        {
          timestamp: new Date(),
          module: 'EVENTHUB',
          eventId: event.id,
          eventType: event.type
        },
        undefined,
        error instanceof Error ? error : undefined
      );
      return Either.left(processingError);
    }
  }
  
  /**
   * Publish event with automatic Event wrapping
   * This prevents double-wrapping by creating the Event object internally
   */
  async publish<T>(
    eventType: string,
    data: T,
    source: string = this.name,
    priority: EventPriority = EventPriority.NORMAL,
    options: {
      correlationId?: string;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<Either<EventHubError, void>> {
    try {
      // Create Event object internally to prevent double-wrapping
      const event: Event<T> = {
        id: `evt-${ Date.now() }-${ Math.random().toString(36).substring(2, 9) }`,
        type: eventType,
        data: data,
        priority: priority,
        source: source,
        timestamp: new Date()
      };
      
      // Add optional properties
      if (options.correlationId) {
        (event as any).correlationId = options.correlationId;
      }
      
      if (options.metadata) {
        (event as any).metadata = options.metadata;
      }
      
      // Use existing emit method
      return await this.emit(event);
    } catch (error) {
      const publishError = EventHubError.create(
        UnifiedErrorCode.EVENT_PROCESSING_FAILED,
        'Event publishing failed',
        'publish',
        {
          timestamp: new Date(),
          module: 'EVENTHUB',
          eventType,
          additionalData: { source }
        },
        undefined,
        error instanceof Error ? error : undefined
      );
      this._logger.error(publishError.getDetailedMessage());
      return Either.left(publishError);
    }
  }
  
  /**
   * Subscribe to events (existing functionality)
   */
  on<T>(
    eventType: string,
    listener: EventListener<T>,
    options: SubscriptionOptions = {}
  ): Either<EventHubError, EventSubscription> {
    try {
      if (!eventType || !listener) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.EVENT_VALIDATION_FAILED,
          'Invalid subscription parameters: eventType and listener are required',
          'on',
          {
            timestamp: new Date(),
            module: 'EVENTHUB',
            eventType,
            additionalData: { hasListener: !!listener }
          }
        ));
      }
      
      const subscriptionId = `${ eventType }-${ Date.now() }-${ Math.random().toString(36).substring(2) }`;
      
      const registration: EventListenerRegistration = {
        id: subscriptionId,
        listener: listener as EventListener,
        options,
        registeredAt: new Date()
      };
      
      if (!this._listeners.has(eventType)) {
        this._listeners.set(eventType, new Set());
      }
      
      this._listeners.get(eventType)!.add(registration);
      
      const subscription: ExtEventSubscription = {
        id: subscriptionId,
        topicName: eventType,
        eventType,
        listener: listener as EventListener,
        options,
        createdAt: new Date(),
        active: true,
        setActive: (active: boolean) => {
          (subscription as any).active = active;
        },
        incrementRetries: () => { /* implementation */ },
        getRetries: () => 0
      };
      
      this._subscriptions.set(subscriptionId, subscription);
      this._metrics.activeSubscriptions++;
      
      this._logger.debug(`Created subscription ${ subscriptionId } for event type ${ eventType }`);
      return Either.right(subscription as EventSubscription);
    } catch (error) {
      const subscriptionError = EventHubError.create(
        UnifiedErrorCode.EVENT_PROCESSING_FAILED,
        'Failed to create subscription',
        'on',
        {
          timestamp: new Date(),
          module: 'EVENTHUB',
          eventType,
          subscriptionId: ''
        },
        undefined,
        error instanceof Error ? error : undefined
      );
      this._logger.error(subscriptionError.getDetailedMessage());
      return Either.left(subscriptionError);
    }
  }
  
  /**
   * Unsubscribe from events (existing functionality)
   */
  off(subscriptionId: string): Either<EventHubError, void> {
    try {
      const subscription = this._subscriptions.get(subscriptionId);
      if (!subscription) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.EVENT_PROCESSING_FAILED,
          `Subscription not found`,
          'off',
          {
            timestamp: new Date(),
            module: 'EVENTHUB',
            subscriptionId,
            additionalData: { availableSubscriptions: this._subscriptions.size }
          }
        ));
      }
      
      const listeners = this._listeners.get(subscription.eventType);
      if (listeners) {
        const registration = Array.from(listeners).find(reg => reg.id === subscriptionId);
        if (registration) {
          listeners.delete(registration);
        }
      }
      
      this._subscriptions.delete(subscriptionId);
      this._metrics.activeSubscriptions--;
      
      this._logger.debug(`Removed subscription ${ subscriptionId }`);
      return Either.right(undefined as void);
    } catch (error) {
      const unsubscribeError = EventHubError.create(
        UnifiedErrorCode.EVENT_PROCESSING_FAILED,
        'Failed to remove subscription',
        'off',
        {
          timestamp: new Date(),
          module: 'EVENTHUB',
          subscriptionId
        },
        undefined,
        error instanceof Error ? error : undefined
      );
      this._logger.error(unsubscribeError.getDetailedMessage());
      return Either.left(unsubscribeError);
    }
  }
  
  /**
   * Create a new topic for Publisher-Subscriber pattern
   */
  async createTopic(config: TopicConfig): Promise<Either<EventHubError, Topic>> {
    if (!this._running) {
      return Either.left(EventHubError.create(
        UnifiedErrorCode.EVENTHUB_INVALID_STATE,
        'EventHub is stopped, cannot create topic',
        'createTopic',
        {
          timestamp: new Date(),
          module: 'EVENTHUB',
          topicName: config.name
        }
      ));
    }
    
    const result = await this._topicManager.createTopic(config);
    
    // Emit internal event on successful topic creation
    if (result.isRight()) {
      this.emitInternal('topic:created', {
        topicName: config.name,
        config,
        timestamp: new Date()
      });
    }
    
    return result;
  }
  
  /**
   * Get an existing topic
   */
  getTopic(name: string): Maybe<Topic> {
    return this._topicManager.getTopic(name);
  }
  
  /**
   * Delete a topic
   */
  async deleteTopic(name: string): Promise<Either<EventHubError, void>> {
    const result = await this._topicManager.deleteTopic(name);
    
    // Emit internal event on successful topic deletion
    if (result.isRight()) {
      this.emitInternal('topic:deleted', {
        topicName: name,
        timestamp: new Date()
      });
    }
    
    return result;
  }
  
  /**
   * Get Publisher instance for publishing events
   */
  getPublisher(): Publisher {
    return this._publisher;
  }
  
  /**
   * Get Subscriber instance for subscribing to events
   */
  getSubscriber(): Subscriber {
    return this._subscriber;
  }
  
  /**
   * Get EventHub metrics including topic metrics
   */
  getMetrics(): EventHubMetrics {
    // Use available method instead of getAllTopicsMetrics
    const topics = this._topicManager.listTopics();
    let totalTopicMessages = 0;
    
    for (const topicName of topics) {
      try {
        const metrics = this._topicManager.getTopicMetrics(topicName);
        if (Maybe.isJust(metrics)) {
          totalTopicMessages += (metrics.value as any).messagesPublished || 0;
        }
      } catch (error) {
        // Ignore errors for individual topic metrics
      }
    }
    
    return {
      activeSubscriptions: this._metrics.activeSubscriptions,
      activeTopics: topics.length,
      avgProcessingTimeMs: 0,
      uptimeMs: this._startTime ? Date.now() - this._startTime.getTime() : 0
    };
  }
  
  doToInfo(): string {
    return JSON.stringify({
      name: this.name,
      running: this._running,
      initialized: this._initialized,
      topics: this._topicManager.listTopics(),
      metrics: this.getMetrics()
    });
  }
  
  doToDebug(): string {
    return JSON.stringify({
      name: this.name,
      config: this.config,
      running: this._running,
      initialized: this._initialized,
      topics: this._topicManager.listTopics(),
      subscriptions: this._subscriptions.size,
      brokers: Array.from(this._brokers.keys()),
      adapters: Array.from(this._adapters.keys()),
      metrics: this.getMetrics()
    });
  }
  
  private debug(
    message: string,
    ...args: any[]
  ): void {
    this._logger.debug(`[EventHub] ${ message }`, ...args);
  }
  
  private info(
    message: string,
    ...args: any[]
  ): void {
    this._logger.info(`[EventHub] ${ message }`, ...args);
  }
  
  private warn(
    message: string,
    ...args: any[]
  ): void {
    this._logger.warn(`[EventHub] ${ message }`, ...args);
  }
  
  private error(
    message: string,
    ...args: any[]
  ): void {
    this._logger.error(`[EventHub] ${ message }`, ...args);
  }
}
