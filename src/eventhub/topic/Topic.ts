import { Either } from "@/either";
import {
  Event,
  EventListener
} from "@/eventhub";
import { EventHubError } from "@/eventhub/EventHubError";
import { ArrayTopicMessageBus } from "@/eventhub/topic/ArrayTopicMessageBus";
import { HeapTopicMessageBus } from "@/eventhub/topic/HeapTopicMessageBus";
import { TopicMessageBus } from "@/eventhub/topic/TopicMessageBus";
import {
  EventSubscription,
  SubscriberInfo,
  SubscriptionOptions,
  TopicConfig,
  TopicMetrics
} from "@/eventhub/topic/types";
import { EventPriority } from "@/eventhub/types";
import { UnifiedErrorCode } from "@/exception/ErrorCodes";

/**
 * Topic interface for Publisher-Subscriber pattern
 */
export abstract class Topic {
  static create(
    name: string,
    config: TopicConfig
  ): Topic {
    return new TopicImpl(name, config)
  }
  /** Topic name */
  abstract readonly name: string;
  /** Topic configuration */
  abstract readonly config: TopicConfig;
  
  /** Start the topic */
  abstract start(): Promise<Either<EventHubError, void>>;
  /** Stop the topic */
  abstract stop(): Promise<Either<EventHubError, void>>;
  /** Check if topic is running */
  abstract isRunning(): boolean;
  
  /** Publish a message to the topic */
  abstract publish<T>(
    message: T,
    metadata?: Record<string, any>
  ): Promise<Either<EventHubError, void>>;
  /** Subscribe to topic messages */
  abstract subscribe<T>(
    listener: EventListener<T>,
    options?: SubscriptionOptions
  ): Promise<Either<EventHubError, EventSubscription>>;
  /** Unsubscribe from topic */
  abstract unsubscribe(subscriptionId: string): Promise<Either<EventHubError, void>>;
  /** Get all subscriptions */
  abstract getSubscriptions(): EventSubscription[];
  /** Get topic metrics */
  abstract getMetrics(): TopicMetrics;
  /** Get message count */
  abstract getMessageCount(): number;
  /** Clear all messages */
  abstract clear(): Promise<Either<EventHubError, void>>;
}

/**
 * Core Topic implementation with Publisher-Subscriber pattern using layered architecture
 */
class TopicImpl
  extends Topic {
  private _isRunning: boolean = false;
  private _messageBus: TopicMessageBus;
  private _subscriberManager: SubscriberManager;
  private _metricsTracker: TopicMetricsTracker;
  
  constructor(
    public readonly name: string,
    public readonly config: TopicConfig
  ) {
    super()
    this._metricsTracker = new TopicMetricsTracker(this.name);
    this._subscriberManager = new SubscriberManager(this.name);
    
    // Create EventQueueConfig for MessageBus constructors
    const busConfig = {
      name: this.name,
      maxSize: config.maxSize || 1000,
      persistent: config.persistent || false,
      enableDeduplication: true
    };
    
    // Choose MessageBus implementation based on config
    if (config.priorityQueue) {
      this._messageBus = new HeapTopicMessageBus(busConfig);
    } else {
      this._messageBus = new ArrayTopicMessageBus(busConfig);
    }
  }
  
  async start(): Promise<Either<EventHubError, void>> {
    try {
      if (this._isRunning) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.CONTEXT_TOPIC_CREATION_FAILED,
          `Topic '${ this.name }' is already running`,
          'start',
          {
            timestamp: new Date(),
            module: 'EVENTHUB',
            topicName: this.name
          }
        ));
      }
      
      this._isRunning = true;
      return Either.right(undefined as void);
    } catch (error) {
      const startError = EventHubError.create(
        UnifiedErrorCode.CONTEXT_TOPIC_CREATION_FAILED,
        `Failed to start topic '${ this.name }'`,
        'start',
        {
          timestamp: new Date(),
          module: 'EVENTHUB',
          topicName: this.name
        },
        undefined,
        error instanceof Error ? error : undefined
      );
      return Either.left(startError);
    }
  }
  
  async stop(): Promise<Either<EventHubError, void>> {
    try {
      if (!this._isRunning) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.RESOURCE_NOT_FOUND,
          `Topic '${ this.name }' is not running`,
          'stop',
          {
            timestamp: new Date(),
            module: 'EVENTHUB',
            topicName: this.name
          }
        ));
      }
      
      this._isRunning = false;
      await this._messageBus.clear();
      this._subscriberManager.clearSubscribers();
      
      return Either.right(undefined as void);
    } catch (error) {
      const stopError = EventHubError.create(
        UnifiedErrorCode.CONTEXT_TOPIC_DELETION_FAILED,
        `Failed to stop topic '${ this.name }'`,
        'stop',
        {
          timestamp: new Date(),
          module: 'EVENTHUB',
          topicName: this.name
        },
        undefined,
        error instanceof Error ? error : undefined
      );
      return Either.left(stopError);
    }
  }
  
  async publish<T>(
    message: T,
    metadata?: Record<string, any>
  ): Promise<Either<EventHubError, void>> {
    try {
      if (!this._isRunning) {
        return Either.left(new EventHubError(
          UnifiedErrorCode.EVENTHUB_INVALID_STATE,
          `Topic '${ this.name }' is not running`,
          {
            topicName: this.name,
            timestamp: new Date(),
            module: 'Topic'
          }
        ));
      }
      
      // Create event from message
      const priority = metadata?.priority as EventPriority || EventPriority.NORMAL;
      const event: Event<T> = {
        id: `evt_${ Date.now() }_${ Math.random().toString(36).substring(2) }`,
        type: this.name,
        data: message,
        priority: priority,
        timestamp: new Date(),
        metadata: metadata || {}
      };
      
      // Add to message bus
      const addResult = await this._messageBus.enqueue(event);
      
      if (Either.isLeft(addResult)) {
        return Either.left(addResult.left);
      }
      
      // Notify subscribers
      const subscribers = this._subscriberManager.getActiveSubscribers();
      
      // Process subscribers sequentially with for-loop
      for (const subscription of subscribers) {
        const startTime = Date.now(); // Start timing
        try {
          const result = subscription.listener(event);
          if (result instanceof Promise) {
            await result;
          }
          const processingTime = Date.now() - startTime; // Calculate processing time
          this._metricsTracker.markConsumed(processingTime);
        } catch (error) {
          // const processingTime = Date.now() - startTime; // Calculate processing time even for errors
          this._metricsTracker.markFailed();
          
          // Log the error but continue processing other subscribers
          const processingError = new EventHubError(
            UnifiedErrorCode.EVENT_DELIVERY_FAILED,
            `Failed to deliver message to subscription ${ subscription.id }`,
            {
              topicName: this.name,
              subscriptionId: subscription.id,
              eventId: event.id,
              timestamp: new Date(),
              module: 'Topic'
            },
            {},
            error instanceof Error ? error : undefined
          );
          
          // You can choose to either:
          // 1. Continue processing other subscribers (current approach)
          console.warn(`Subscription ${ subscription.id } failed:`, processingError.message);
          
          // 2. Or throw to stop processing completely
          // throw processingError;
        }
      }
      
      this._metricsTracker.markPublished();
      
      return Either.right(undefined as void);
    } catch (error) {
      const publishError = new EventHubError(
        UnifiedErrorCode.EVENT_PROCESSING_FAILED,
        `Failed to publish message to topic '${ this.name }'`,
        {
          topicName: this.name,
          timestamp: new Date(),
          module: 'Topic'
        },
        {},
        error instanceof Error ? error : undefined
      );
      return Either.left(publishError);
    }
  }
  
  async subscribe<T>(
    listener: EventListener<T>,
    options?: SubscriptionOptions
  ): Promise<Either<EventHubError, EventSubscription>> {
    try {
      if (!this._isRunning) {
        return Either.left(new EventHubError(
          UnifiedErrorCode.EVENTHUB_INVALID_STATE,
          `Topic '${ this.name }' is not running`,
          {
            topicName: this.name,
            timestamp: new Date(),
            module: 'Topic'
          }
        ));
      }
      
      const subscriberInfo = this._subscriberManager.addSubscriber(
        listener as EventListener,
        options
      );
      
      // Convert SubscriberInfo to EventSubscription
      const eventSubscription: EventSubscription = {
        id: subscriberInfo.id,
        topicName: this.name,
        listener: subscriberInfo.listener,
        options: subscriberInfo.options,
        createdAt: subscriberInfo.registeredAt,
        active: subscriberInfo.active
      };
      
      return Either.right(eventSubscription);
    } catch (error) {
      const subscribeError = new EventHubError(
        UnifiedErrorCode.EVENT_PROCESSING_FAILED,
        `Failed to subscribe to topic '${ this.name }'`,
        {
          topicName: this.name,
          timestamp: new Date(),
          module: 'Topic'
        },
        {},
        error instanceof Error ? error : undefined
      );
      return Either.left(subscribeError);
    }
  }
  
  async unsubscribe(subscriptionId: string): Promise<Either<EventHubError, void>> {
    try {
      const removed = this._subscriberManager.removeSubscriber(subscriptionId);
      
      if (!removed) {
        return Either.left(new EventHubError(
          UnifiedErrorCode.RESOURCE_NOT_FOUND,
          `Subscription ${ subscriptionId } not found`,
          {
            subscriptionId,
            topicName: this.name,
            timestamp: new Date(),
            module: 'Topic'
          }
        ));
      }
      
      return Either.right(undefined as void);
    } catch (error) {
      const unsubscribeError = new EventHubError(
        UnifiedErrorCode.EVENT_PROCESSING_FAILED,
        'Failed to unsubscribe from topic',
        {
          subscriptionId,
          topicName: this.name,
          timestamp: new Date(),
          module: 'Topic'
        },
        {},
        error instanceof Error ? error : undefined
      );
      return Either.left(unsubscribeError);
    }
  }
  
  getSubscriptions(): EventSubscription[] {
    const subscriberInfos = this._subscriberManager.getActiveSubscribers();
    
    // Convert SubscriberInfo[] to EventSubscription[]
    return subscriberInfos.map(subscriberInfo => ({
      id: subscriberInfo.id,
      topicName: this.name,
      listener: subscriberInfo.listener,
      options: subscriberInfo.options,
      createdAt: subscriberInfo.registeredAt,
      active: subscriberInfo.active
    }));
  }
  
  getMetrics(): TopicMetrics {
    const baseMetrics = this._metricsTracker.getMetrics();
    const messagesInQueue = this._messageBus.size();
    
    return {
      ...baseMetrics,
      messagesInQueue,
      subscribersCount: this._subscriberManager.getActiveSubscriberCount()
    };
  }
  
  isRunning(): boolean {
    return this._isRunning;
  }
  
  getMessageCount(): number {
    return this._messageBus.size();
  }
  
  async clear(): Promise<Either<EventHubError, void>> {
    try {
      await this._messageBus.clear();
      return Either.right(undefined as void);
    } catch (error) {
      const clearError = new EventHubError(
        UnifiedErrorCode.RESOURCE_DELETION_FAILED,
        `Failed to clear topic '${ this.name }'`,
        {
          topicName: this.name,
          timestamp: new Date(),
          module: 'Topic'
        },
        {},
        error instanceof Error ? error : undefined
      );
      return Either.left(clearError);
    }
  }
}

/**
 * Centralized subscriber management for topic operations
 *
 * This class handles all subscriber-related functionality that was previously
 * scattered across Topic implementations. It provides a clean separation
 * between storage operations (TopicMessageBus) and subscriber management business logic.
 *
 * Features:
 * - Subscriber registration and lifecycle management
 * - Message delivery to multiple subscribers
 * - Subscriber options handling (retry, ordering, priority, etc.)
 * - Subscriber metrics and statistics
 * - Error handling and retry mechanisms
 * - Thread-safe subscriber operations
 */
export class SubscriberManager {
  private subscribers = new Map<string, SubscriberInfo>();
  private readonly topicName: string;
  
  constructor(topicName: string) {
    this.topicName = topicName;
  }
  
  /**
   * Add a new subscriber with the specified listener and options
   * @param listener Event listener function
   * @param options Optional subscription configuration
   * @returns SubscriberInfo object containing subscriber details
   */
  addSubscriber(
    listener: EventListener,
    options: SubscriptionOptions = {}
  ): SubscriberInfo {
    const subscriberId = this.generateSubscriberId();
    
    const subscriberInfo: SubscriberInfo = {
      id: subscriberId,
      listener,
      options: {
        maxRetries: 3,
        retryDelay: 1000,
        // ordered: true,
        priority: 0,
        ...options
      },
      registeredAt: new Date(),
      active: true,
      messagesProcessed: 0,
      messagesFailed: 0,
      retryCount: 0
    };
    
    this.subscribers.set(subscriberId, subscriberInfo);
    
    return subscriberInfo; // Return the full SubscriberInfo instead of just the ID
  }
  
  /**
   * Remove a subscriber by ID
   * @param subscriberId The subscriber ID to remove
   * @returns True if subscriber was found and removed, false otherwise
   */
  removeSubscriber(subscriberId: string): boolean {
    const subscriber = this.subscribers.get(subscriberId);
    if (subscriber) {
      subscriber.active = false;
      this.subscribers.delete(subscriberId);
      return true;
    }
    return false;
  }
  
  /**
   * Check if there are any active subscribers
   * @returns True if at least one subscriber is active
   */
  hasActiveSubscribers(): boolean {
    return Array.from(this.subscribers.values()).some(subscriber => subscriber.active);
  }
  
  /**
   * Get the number of active subscribers
   * @returns Count of active subscribers
   */
  getActiveSubscriberCount(): number {
    return Array.from(this.subscribers.values()).filter(subscriber => subscriber.active).length;
  }
  
  getActiveSubscribers(): SubscriberInfo[] {
    return Array.from(this.subscribers.values()).filter(subscriber => subscriber.active)
  }
  
  /**
   * Deliver a message to all active subscribers
   * @param message The event message to deliver
   * @returns Promise that resolves with delivery results for metrics tracking
   */
  async deliverMessage(message: Event): Promise<{ processed: number; failed: number; averageTime: number }> {
    const activeSubscribers = Array.from(this.subscribers.values()).filter(subscriber => subscriber.active);
    
    if (activeSubscribers.length === 0) {
      return { processed: 0, failed: 0, averageTime: 0 };
    }
    
    // Sort subscribers by priority (higher priority first)
    const sortedSubscribers = activeSubscribers.sort((
      a,
      b
    ) => (b.options.priority || 0) - (a.options.priority || 0));
    
    const deliveryPromises = sortedSubscribers.map(subscriber =>
      this.deliverMessageToSubscriber(message, subscriber)
    );
    
    const results = await Promise.allSettled(deliveryPromises);
    
    // Calculate metrics
    const processingTimes: number[] = [];
    let processed = 0;
    let failed = 0;
    
    results.forEach((
      result,
      index
    ) => {
      if (result.status === 'fulfilled') {
        const { success, processingTime } = result.value;
        if (success) {
          processed++;
          processingTimes.push(processingTime);
        } else {
          failed++;
        }
      } else {
        failed++;
        console.error(`Delivery failed for subscriber ${ sortedSubscribers[index].id }:`, result.reason);
      }
    });
    
    const averageTime = processingTimes.length > 0
      ? processingTimes.reduce((
      sum,
      time
    ) => sum + time, 0) / processingTimes.length
      : 0;
    
    return { processed, failed, averageTime };
  }
  
  clearSubscribers() {
    this.subscribers.clear();
  }
  
  /**
   * Deliver a message to a specific subscriber with retry logic
   * @param message The event message to deliver
   * @param subscriber The subscriber to deliver the message to
   * @returns Promise with delivery result and processing time
   */
  private async deliverMessageToSubscriber(
    message: Event,
    subscriber: SubscriberInfo
  ): Promise<{ success: boolean; processingTime: number }> {
    const startTime = Date.now();
    
    try {
      // Apply subscriber-level filter if configured
      if (subscriber.options.filter && !subscriber.options.filter(message)) {
        return { success: true, processingTime: Date.now() - startTime };
      }
      
      // Deliver the message
      await subscriber.listener(message);
      
      // Update subscriber metrics
      subscriber.messagesProcessed++;
      subscriber.retryCount = 0; // Reset retry count on success
      
      return { success: true, processingTime: Date.now() - startTime };
      
    } catch (error) {
      subscriber.messagesFailed++;
      
      // Handle retry logic
      if (subscriber.retryCount < (subscriber.options.maxRetries || 3)) {
        subscriber.retryCount++;
        
        // Retry with delay
        if (subscriber.options.retryDelay) {
          await new Promise(resolve => setTimeout(resolve, subscriber.options.retryDelay));
        }
        
        // Recursive retry
        return await this.deliverMessageToSubscriber(message, subscriber);
      } else {
        // Max retries exceeded
        console.error(`Max retries exceeded for subscriber ${ subscriber.id } on topic ${ this.topicName }:`, error);
        subscriber.retryCount = 0; // Reset for next message
        return { success: false, processingTime: Date.now() - startTime };
      }
    }
  }
  
  /**
   * Get subscriber metrics for monitoring
   * @returns Object with subscriber statistics
   */
  getSubscriberMetrics() {
    const subscribers = Array.from(this.subscribers.values());
    const activeCount = subscribers.filter(s => s.active).length;
    const totalProcessed = subscribers.reduce((
      sum,
      s
    ) => sum + s.messagesProcessed, 0);
    const totalFailed = subscribers.reduce((
      sum,
      s
    ) => sum + s.messagesFailed, 0);
    
    return {
      totalSubscribers: subscribers.length,
      activeSubscribers: activeCount,
      totalMessagesProcessed: totalProcessed,
      totalMessagesFailed: totalFailed
    };
  }
  
  /**
   * Generate a unique subscriber ID
   * @returns Unique subscriber ID string
   */
  private generateSubscriberId(): string {
    return `${ this.topicName }-sub-${ Date.now() }-${ Math.random().toString(36).substring(2) }`;
  }
}

/**
 * Centralized metrics tracking for topic operations
 *
 * This class handles all metrics-related functionality that was previously
 * scattered across Topic implementations. It provides a clean separation
 * between storage operations (TopicMessageBus) and business metrics tracking.
 *
 * Features:
 * - Publish and consumption counting
 * - Processing time tracking with rolling average
 * - Activity timestamp tracking
 * - Memory-efficient storage (limits processing time history)
 * - Thread-safe metrics updates
 */
export class TopicMetricsTracker {
  private _messagesPublished = 0;
  private _messagesConsumed = 0;
  private _failedMessages = 0;
  private _processingTimes: number[] = [];
  private _lastActivity = new Date();
  
  private readonly topicName: string;
  private readonly maxProcessingTimeHistory = 100; // Keep last 100 processing times
  
  constructor(topicName: string) {
    this.topicName = topicName;
  }
  
  /**
   * Mark a message as published
   */
  markPublished(): void {
    this._messagesPublished++;
    this._lastActivity = new Date();
  }
  
  /**
   * Mark a message as consumed (delivered to subscribers)
   * @param processingTime Time taken to deliver the message in milliseconds
   */
  markConsumed(processingTime: number): void {
    this._messagesConsumed++;
    this._processingTimes.push(processingTime);
    this._lastActivity = new Date();
    
    // Keep only last N processing times for memory efficiency
    if (this._processingTimes.length > this.maxProcessingTimeHistory) {
      this._processingTimes = this._processingTimes.slice(-this.maxProcessingTimeHistory);
    }
  }
  
  /**
   * Mark a message delivery as failed
   */
  markFailed(): void {
    this._failedMessages++;
    this._lastActivity = new Date();
  }
  
  /**
   * Get comprehensive topic metrics
   * @param currentQueueSize Current number of messages in the topic queue
   * @param activeSubscribers Number of active subscribers
   * @returns Complete topic metrics
   */
  getMetrics(
    currentQueueSize: number = 0,
    activeSubscribers: number = 0
  ): TopicMetrics {
    const averageProcessingTime = this._processingTimes.length > 0
      ? this._processingTimes.reduce((
      sum,
      time
    ) => sum + time, 0) / this._processingTimes.length
      : 0;
    
    return {
      topicName: this.topicName,
      messagesPublished: this._messagesPublished,
      messagesConsumed: this._messagesConsumed,
      messagesInQueue: currentQueueSize,
      subscribersCount: activeSubscribers,
      failedMessages: this._failedMessages,
      avgProcessingTimeMs: averageProcessingTime,
      lastActivity: this._lastActivity
    };
  }
  
  /**
   * Reset all metrics (useful for testing or restarting)
   */
  reset(): void {
    this._messagesPublished = 0;
    this._messagesConsumed = 0;
    this._failedMessages = 0;
    this._processingTimes = [];
    this._lastActivity = new Date();
  }
  
  /**
   * Get current statistics summary
   */
  getSummary() {
    return {
      published: this._messagesPublished,
      consumed: this._messagesConsumed,
      failed: this._failedMessages,
      averageProcessingTime: this._processingTimes.length > 0
        ? this._processingTimes.reduce((
        sum,
        time
      ) => sum + time, 0) / this._processingTimes.length
        : 0,
      lastActivity: this._lastActivity
    };
  }
}
