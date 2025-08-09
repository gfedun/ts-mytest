import { Either } from "@/either";
import {
  Event,
  EventHubError,
  QueueConfig
} from "@/eventhub";
import { ArrayQueueMessageBus } from "@/eventhub/queue/ArrayQueueMessageBus";
import { HeapQueueMessageBus } from "@/eventhub/queue/HeapQueueMessageBus";
import { QueueMessageBus } from "@/eventhub/queue/QueueMessageBus";
import {
  ConsumeOptions,
  ConsumerInfo,
  EventQueueConfig,
  MessageHandler,
  QueueMetrics,
  ReceivedMessage
} from "@/eventhub/queue/types";
import { EventPriority } from "@/eventhub/types";
import { UnifiedErrorCode } from "@/exception/ErrorCodes";
import { Maybe } from "@/maybe";

/**
 * Queue interface for Point-to-Point messaging
 */
export abstract class Queue {
  
  static create(
    name: string,
    config: QueueConfig,
    busType: 'array' | 'heap' = 'array'
  ): Queue {
    return new QueueImpl(name, config, busType)
  }
  /** Queue name */
  abstract readonly name: string;
  /** Queue configuration */
  abstract readonly config: QueueConfig;
  /** Send a message to the queue */
  abstract send<T>(
    message: T,
    priority?: EventPriority
  ): Promise<Either<EventHubError, void>>;
  /** Receive a message from the queue */
  abstract receive<T>(): Promise<Either<EventHubError, Maybe<T>>>;
  /** Get queue size */
  abstract size(): number;
  /** Check if queue is empty */
  abstract isEmpty(): boolean;
  /** Clear all messages */
  abstract clear(): Promise<Either<EventHubError, void>>;
  /** Start the queue */
  abstract start(): Promise<Either<EventHubError, void>>;
  /** Stop the queue */
  abstract stop(): Promise<Either<EventHubError, void>>;
  /** Check if queue is running */
  abstract isRunning(): boolean;
  /** Get queue metrics */
  abstract getMetrics(): any; // Using any to avoid circular dependency with QueueMetrics
}

class QueueImpl
  extends Queue {
  private _isRunning: boolean = false;
  
  // New layered architecture components
  private messageBus: QueueMessageBus;
  private consumerManager: ConsumerManager<any>;
  private metricsTracker: QueueMetricsTracker;
  
  // Consumer processing state
  private processingLoops = new Map<string, boolean>();
  private processingPromises = new Map<string, Promise<void>>();
  
  constructor(
    public readonly name: string,
    public readonly config: QueueConfig,
    busType: 'array' | 'heap' = 'array'
  ) {
    super()
    // Create appropriate message bus
    this.messageBus = busType === 'heap'
      ? new HeapQueueMessageBus(this.createBusConfig())
      : new ArrayQueueMessageBus(this.createBusConfig());
    
    this.consumerManager = new ConsumerManager(this.name);
    this.metricsTracker = new QueueMetricsTracker(this.name);
  }
  
  /**
   * Create EventQueueConfig from QueueConfig for MessageBus
   */
  private createBusConfig(): EventQueueConfig {
    return {
      name: this.config.name,
      maxSize: this.config.maxQueueSize || 10000,
      persistent: this.config.persistent || false,
      enableDeduplication: true
    };
  }
  
  async send<T>(
    message: T,
    priority?: EventPriority
  ): Promise<Either<EventHubError, void>> {
    try {
      if (!this._isRunning) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.EVENTHUB_INVALID_STATE,
          `Queue '${ this.name }' is not running`,
          'send',
          { queueName: this.name }
        ));
      }
      
      const messageId = `msg_${ Date.now() }_${ Math.random().toString(36).substr(2, 9) }`;
      
      // Create Event object for the MessageBus
      const event: Event = {
        id: messageId,
        type: 'queue.message',
        data: message,
        priority: priority || EventPriority.NORMAL,
        timestamp: new Date(),
        source: this.name,
        metadata: {
          queueName: this.name,
          deliveryCount: 0
        }
      };
      
      // Enqueue message using MessageBus synchronously
      // Note: This assumes the MessageBus has a synchronous enqueue method
      // For async operations, we'd need to change the Queue interface
      const enqueueResult = await this.messageBus.enqueue(event);
      if (Either.isLeft(enqueueResult)) {
        return Either.left(enqueueResult.left);
      }
      
      // Track metrics for sent message
      this.metricsTracker.markEnqueued();
      
      return Either.right(undefined as void);
    } catch (error) {
      const sendError = EventHubError.create(
        UnifiedErrorCode.EVENT_PROCESSING_FAILED,
        'Failed to send message to queue',
        'send',
        { queueName: this.name },
        undefined,
        error instanceof Error ? error : undefined
      );
      return Either.left(sendError);
    }
  }
  
  async receive<T>(): Promise<Either<EventHubError, Maybe<T>>> {
    try {
      if (!this._isRunning) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.EVENTHUB_INVALID_STATE,
          `Queue '${ this.name }' is not running`,
          'receive',
          { queueName: this.name }
        ));
      }
      
      // Use MessageBus to dequeue a message synchronously
      const eventMaybe = await this.messageBus.dequeue();
      if (Maybe.isNothing(eventMaybe)) {
        return Either.right(Maybe.nothing());
      }
      
      const event = eventMaybe.value;
      
      // Track metrics for received message
      this.metricsTracker.markDequeued();
      
      return Either.right(Maybe.just(event.data as T));
    } catch (error) {
      const receiveError = EventHubError.create(
        UnifiedErrorCode.EVENT_PROCESSING_FAILED,
        'Failed to receive message from queue',
        'receive',
        { queueName: this.name },
        undefined,
        error instanceof Error ? error : undefined
      );
      return Either.left(receiveError);
    }
  }
  
  async consume<T>(
    handler: MessageHandler<T>,
    options?: ConsumeOptions
  ): Promise<Either<EventHubError, string>> {
    try {
      // For Point-to-Point queues, only one consumer is allowed
      if (this.consumerManager.hasActiveConsumers()) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.RESOURCE_UNAVAILABLE,
          `Queue '${ this.name }' already has a consumer. Only one consumer allowed for Point-to-Point queues.`,
          'consume',
          { queueName: this.name }
        ));
      }
      
      const consumerId = this.consumerManager.addConsumer(handler, options);
      
      // Start the message processing loop for this consumer
      await this.startMessageProcessingLoop(consumerId);
      
      return Either.right(consumerId);
    } catch (error) {
      const consumeError = EventHubError.create(
        UnifiedErrorCode.EVENT_PROCESSING_FAILED,
        'Failed to start consuming messages from queue',
        'consume',
        { queueName: this.name },
        undefined,
        error instanceof Error ? error : undefined
      );
      return Either.left(consumeError);
    }
  }
  
  async stopConsuming(consumerId: string): Promise<Either<EventHubError, void>> {
    try {
      // Stop the processing loop first
      this.stopMessageProcessingLoop(consumerId);
      
      // Remove the consumer
      const removed = this.consumerManager.removeConsumer(consumerId);
      if (!removed) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.RESOURCE_NOT_FOUND,
          `Consumer ${ consumerId } not found`,
          'stopConsuming',
          {
            queueName: this.name,
            additionalData: { consumerId }
          }
        ));
      }
      
      return Either.right(undefined as void);
    } catch (error) {
      const stopError = EventHubError.create(
        UnifiedErrorCode.EVENT_PROCESSING_FAILED,
        'Failed to stop consuming messages from queue',
        'stopConsuming',
        {
          queueName: this.name,
          additionalData: { consumerId }
        },
        undefined,
        error instanceof Error ? error : undefined
      );
      return Either.left(stopError);
    }
  }
  
  /**
   * Start the message processing loop for a consumer
   */
  private async startMessageProcessingLoop(consumerId: string): Promise<void> {
    if (this.processingLoops.has(consumerId)) {
      return; // Already running
    }
    
    this.processingLoops.set(consumerId, true);
    
    const processMessages = async () => {
      while (this.processingLoops.get(consumerId) && this._isRunning) {
        try {
          // Dequeue message from the MessageBus
          const eventMaybe = await this.messageBus.dequeue();
          
          if (Maybe.isJust(eventMaybe)) {
            const event = eventMaybe.value;
            
            try {
              // Process the message using ConsumerManager
              const processingTime = await this.consumerManager.processMessage(event);
              
              // Track metrics
              this.metricsTracker.markProcessed(processingTime);
              
            } catch (error) {
              // Handle processing error
              await this.handleMessageProcessingError(event, error);
              this.metricsTracker.markFailed();
            }
          } else {
            // No messages available, wait before checking again
            await new Promise(resolve => setTimeout(resolve, 50));
          }
        } catch (error) {
          // Handle dequeue or other processing errors
          console.error(`Consumer processing error for ${ consumerId }:`, error);
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
    };
    
    // Store the processing promise
    const processingPromise = processMessages().catch(error => {
      console.error(`Consumer fatal error for ${ consumerId }:`, error);
      this.processingLoops.delete(consumerId);
    });
    
    this.processingPromises.set(consumerId, processingPromise);
    
    // Give the consumer a moment to start
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  
  /**
   * Stop the message processing loop for a consumer
   */
  private stopMessageProcessingLoop(consumerId: string): void {
    this.processingLoops.set(consumerId, false);
    this.processingLoops.delete(consumerId);
    
    // Clean up the processing promise
    this.processingPromises.delete(consumerId);
  }
  
  /**
   * Handle message processing errors with retry logic
   */
  private async handleMessageProcessingError(
    event: Event,
    error: any
  ): Promise<void> {
    const deliveryCount = (event.metadata?.deliveryCount || 0) + 1;
    const maxRetries = 3; // Default max retries since deadLetterQueue is not in QueueConfig
    
    if (deliveryCount < maxRetries) {
      // Retry: Re-enqueue the message with updated delivery count
      const retryEvent = {
        ...event,
        metadata: {
          ...event.metadata,
          deliveryCount,
          lastError: error instanceof Error ? error.message : String(error),
          retryAt: new Date(Date.now() + 1000) // 1 second retry delay
        }
      };
      
      // Re-enqueue for retry
      await this.messageBus.enqueue(retryEvent);
    } else {
      // Max retries exceeded - log the error
      console.error(`Message ${ event.id } exceeded max retries (${ maxRetries }):`, error);
      
      // Could implement dead letter queue here in the future
      console.log(`Message ${ event.id } would be sent to dead letter queue`);
    }
  }
  
  async acknowledge(messageId: string): Promise<Either<EventHubError, void>> {
    try {
      // For this implementation, acknowledgment is handled within the message processing
      // This method could be used for manual acknowledgment scenarios
      return Either.right(undefined as void);
    } catch (error) {
      const ackError = EventHubError.create(
        UnifiedErrorCode.EVENT_PROCESSING_FAILED,
        'Failed to acknowledge message',
        'acknowledge',
        {
          queueName: this.name,
          additionalData: { messageId }
        },
        undefined,
        error instanceof Error ? error : undefined
      );
      return Either.left(ackError);
    }
  }
  
  async reject(
    messageId: string,
    reason?: string
  ): Promise<Either<EventHubError, void>> {
    try {
      // For this implementation, rejection (nack) is handled within the message processing
      // This method could be used for manual rejection scenarios
      return Either.right(undefined as void);
    } catch (error) {
      const rejectError = EventHubError.create(
        UnifiedErrorCode.EVENT_PROCESSING_FAILED,
        'Failed to reject message',
        'reject',
        {
          queueName: this.name,
          additionalData: { messageId, reason }
        },
        undefined,
        error instanceof Error ? error : undefined
      );
      return Either.left(rejectError);
    }
  }
  
  getMetrics(): QueueMetrics {
    return this.metricsTracker.getMetrics(
      this.messageBus.size(),
      this.consumerManager.getActiveConsumerCount(),
      0 // pendingAcknowledgments - will be implemented later
    );
  }
  
  async start(): Promise<Either<EventHubError, void>> {
    try {
      this._isRunning = true;
      
      // Restart any existing consumer processing loops
      for (const consumerId of this.processingLoops.keys()) {
        await this.startMessageProcessingLoop(consumerId);
      }
      
      return Either.right(undefined as void);
    } catch (error) {
      const startError = EventHubError.create(
        UnifiedErrorCode.CONTEXT_QUEUE_CREATION_FAILED,
        'Failed to start queue',
        'start',
        { queueName: this.name },
        undefined,
        error instanceof Error ? error : undefined
      );
      return Either.left(startError);
    }
  }
  
  async stop(): Promise<Either<EventHubError, void>> {
    try {
      this._isRunning = false;
      
      // Stop all processing loops
      for (const consumerId of Array.from(this.processingLoops.keys())) {
        this.stopMessageProcessingLoop(consumerId);
      }
      
      // Wait for processing loops to complete
      const promises = Array.from(this.processingPromises.values());
      if (promises.length > 0) {
        await Promise.allSettled(promises);
      }
      
      return Either.right(undefined as void);
    } catch (error) {
      const stopError = EventHubError.create(
        UnifiedErrorCode.CONTEXT_QUEUE_DELETION_FAILED,
        'Failed to stop queue',
        'stop',
        { queueName: this.name },
        undefined,
        error instanceof Error ? error : undefined
      );
      return Either.left(stopError);
    }
  }
  
  isRunning(): boolean {
    return this._isRunning;
  }
  
  size(): number {
    return this.messageBus.size();
  }
  
  isEmpty(): boolean {
    return this.messageBus.isEmpty();
  }
  
  async clear(): Promise<Either<EventHubError, void>> {
    try {
      await this.messageBus.clear();
      return Either.right(undefined as void);
    } catch (error) {
      const clearError = EventHubError.create(
        UnifiedErrorCode.RESOURCE_DELETION_FAILED,
        'Failed to clear queue',
        'clear',
        { queueName: this.name },
        undefined,
        error instanceof Error ? error : undefined
      );
      return Either.left(clearError);
    }
  }
}

/**
 * Centralized consumer management for queue operations
 *
 * This class handles all consumer-related functionality that was previously
 * scattered across MessageBus implementations. It provides a clean separation
 * between storage operations (MessageBus) and consumer management business logic.
 *
 * Features:
 * - Consumer registration and lifecycle management
 * - Message processing with ack/nack support
 * - Consumer options handling (retry, ordering, etc.)
 * - Consumer metrics and statistics
 * - Error handling and retry mechanisms
 * - Thread-safe consumer operations
 */
class ConsumerManager<T> {
  private consumers = new Map<string, ConsumerInfo<T>>();
  private readonly queueName: string;
  
  constructor(queueName: string) {
    this.queueName = queueName;
  }
  
  /**
   * Add a new consumer with the specified handler and options
   * @param handler Message handler function
   * @param options Optional consumer configuration
   * @returns Unique consumer ID
   */
  addConsumer(
    handler: MessageHandler<T>,
    options: ConsumeOptions = {}
  ): string {
    const consumerId = this.generateConsumerId();
    
    const consumerInfo: ConsumerInfo<T> = {
      id: consumerId,
      handler,
      options,
      registeredAt: new Date(),
      active: true,
      messagesProcessed: 0,
      messagesFailed: 0
    };
    
    this.consumers.set(consumerId, consumerInfo);
    
    return consumerId;
  }
  
  /**
   * Remove a consumer by ID
   * @param consumerId The consumer ID to remove
   * @returns True if consumer was found and removed, false otherwise
   */
  removeConsumer(consumerId: string): boolean {
    const consumer = this.consumers.get(consumerId);
    if (consumer) {
      consumer.active = false;
      this.consumers.delete(consumerId);
      return true;
    }
    return false;
  }
  
  /**
   * Check if there are any active consumers
   * @returns True if at least one consumer is active
   */
  hasActiveConsumers(): boolean {
    return Array.from(this.consumers.values()).some(consumer => consumer.active);
  }
  
  /**
   * Get the number of active consumers
   * @returns Count of active consumers
   */
  getActiveConsumerCount(): number {
    return Array.from(this.consumers.values()).filter(consumer => consumer.active).length;
  }
  
  /**
   * Process a message using the registered consumers
   * @param message The event message to process
   * @returns Promise that resolves with processing time when message processing is complete
   */
  async processMessage(message: Event<T>): Promise<number> {
    const activeConsumers = Array.from(this.consumers.values()).filter(consumer => consumer.active);
    
    if (activeConsumers.length === 0) {
      throw EventHubError.create(
        UnifiedErrorCode.RESOURCE_UNAVAILABLE,
        `No active consumers available for queue '${ this.queueName }'`,
        'processMessage',
        { queueName: this.queueName, eventId: message.id }
      );
    }
    
    // For Point-to-Point queues, only one consumer should process the message
    // Use round-robin or take the first available consumer
    const consumer = activeConsumers[0];
    
    return await this.processMessageWithConsumer(message, consumer);
  }
  
  /**
   * Process a message with a specific consumer, handling ack/nack logic
   * @param message The event message to process
   * @param consumer The consumer to process the message
   * @returns Processing time in milliseconds for metrics tracking
   */
  private async processMessageWithConsumer(
    message: Event<T>,
    consumer: ConsumerInfo<T>
  ): Promise<number> {
    const startTime = Date.now();
    let acked = false;
    let nacked = false;
    let nackReason: string | undefined;
    
    try {
      // Create message wrapper that matches ReceivedMessage<T> interface
      const messageWrapper: ReceivedMessage<T> = {
        id: message.id,
        priority: message.priority,
        data: message.data,
        // event: message,
        receivedAt: new Date(),
        // deliveryCount: (message.metadata?.deliveryCount || 0) + 1,
        requiresAck: true,
        ack: () => {
          if (!acked && !nacked) {
            acked = true;
            consumer.messagesProcessed++;
          }
        },
        nack: (reason?: string) => {
          if (!acked && !nacked) {
            nacked = true;
            nackReason = reason;
            consumer.messagesFailed++;
          }
        }
      };
      
      // Process the message with the consumer's handler
      await consumer.handler(messageWrapper);
      
      // Auto-ack if not explicitly called and no errors occurred
      if (!acked && !nacked) {
        messageWrapper.ack();
      }
      
      // Handle nacked messages
      if (nacked) {
        await this.handleNackedMessage(message, consumer, nackReason);
      }
      
      // Return processing time for metrics tracking
      return Date.now() - startTime;
      
    } catch (error) {
      consumer.messagesFailed++;
      
      // Handle processing error - could retry or dead letter
      await this.handleProcessingError(message, consumer, error as EventHubError);
      
      // Return processing time even for failed messages
      return Date.now() - startTime;
    }
  }
  
  /**
   * Handle messages that were explicitly nacked by consumers
   * @param message The nacked message
   * @param consumer The consumer that nacked the message
   * @param reason Optional reason for nacking
   */
  private async handleNackedMessage(
    message: Event<T>,
    consumer: ConsumerInfo<T>,
    reason?: string
  ): Promise<void> {
    const maxRetries = consumer.options.maxRetries || 3;
    const currentAttempt = (message.metadata?.attempt || 0) + 1;
    
    if (currentAttempt < maxRetries) {
      // Could requeue message with retry count
      console.warn(
        `Message ${ message.id } nacked by consumer ${ consumer.id } in queue '${ this.queueName }'. ` +
        `Attempt ${ currentAttempt }/${ maxRetries }. Reason: ${ reason || 'unknown' }`
      );
    } else {
      // Max retries exceeded - send to dead letter queue or log
      console.error(
        `Message ${ message.id } exceeded max retries (${ maxRetries }) in queue '${ this.queueName }'. ` +
        `Reason: ${ reason || 'unknown' }`
      );
    }
  }
  
  /**
   * Handle processing errors that occurred during message processing
   * @param message The message that failed processing
   * @param consumer The consumer that encountered the error
   * @param error The error that occurred
   */
  private async handleProcessingError(
    message: Event<T>,
    consumer: ConsumerInfo<T>,
    error: EventHubError
  ): Promise<void> {
    console.error(
      `Error processing message ${ message.id } with consumer ${ consumer.id } in queue '${ this.queueName }':`,
      error
    );
    
    // Could implement retry logic, circuit breaker, or dead letter queue here
    const maxRetries = consumer.options.maxRetries || 3;
    const currentAttempt = (message.metadata?.attempt || 0) + 1;
    
    if (currentAttempt < maxRetries) {
      // Could requeue for retry
      console.warn(`Will retry message ${ message.id }. Attempt ${ currentAttempt }/${ maxRetries }`);
    } else {
      console.error(`Message ${ message.id } exceeded max retries due to processing errors`);
    }
  }
  
  /**
   * Get consumer statistics
   * @returns Consumer statistics and metrics
   */
  getConsumerStats(): {
    totalConsumers: number;
    activeConsumers: number;
    totalMessagesProcessed: number;
    totalMessagesFailed: number;
    consumers: Array<{
      id: string;
      active: boolean;
      messagesProcessed: number;
      messagesFailed: number;
      registeredAt: Date;
    }>;
  } {
    const consumers = Array.from(this.consumers.values());
    
    return {
      totalConsumers: consumers.length,
      activeConsumers: consumers.filter(c => c.active).length,
      totalMessagesProcessed: consumers.reduce((
        sum,
        c
      ) => sum + c.messagesProcessed, 0),
      totalMessagesFailed: consumers.reduce((
        sum,
        c
      ) => sum + c.messagesFailed, 0),
      consumers: consumers.map(c => ({
        id: c.id,
        active: c.active,
        messagesProcessed: c.messagesProcessed,
        messagesFailed: c.messagesFailed,
        registeredAt: c.registeredAt
      }))
    };
  }
  
  /**
   * Stop all consumers
   */
  stopAllConsumers(): void {
    this.consumers.forEach(consumer => {
      consumer.active = false;
    });
  }
  
  /**
   * Clear all consumers
   */
  clearConsumers(): void {
    this.consumers.clear();
  }
  
  /**
   * Generate a unique consumer ID
   * @returns Unique consumer identifier
   */
  private generateConsumerId(): string {
    return `consumer-${ this.queueName }-${ Date.now() }-${ Math.random().toString(36).substr(2, 9) }`;
  }
}

/**
 * Centralized metrics tracking for queue operations
 *
 * This class handles all metrics-related functionality that was previously
 * scattered across MessageBus implementations. It provides a clean separation
 * between storage operations (MessageBus) and business metrics tracking.
 *
 * Features:
 * - Process and failure counting
 * - Processing time tracking with rolling average
 * - Activity timestamp tracking
 * - Memory-efficient storage (limits processing time history)
 * - Thread-safe metrics updates
 */
export class QueueMetricsTracker {
  private _totalProcessed = 0;
  private _totalFailed = 0;
  private _processingTimes: number[] = [];
  private _lastActivity = new Date();
  private _totalEnqueued = 0;
  private _totalDequeued = 0;
  
  private readonly queueName: string;
  private readonly maxProcessingTimeHistory = 100; // Keep last 100 processing times
  
  constructor(queueName: string) {
    this.queueName = queueName;
  }
  
  /**
   * Mark an event as successfully processed
   * @param processingTime Time taken to process the event in milliseconds
   */
  markProcessed(processingTime: number): void {
    this._totalProcessed++;
    this._processingTimes.push(processingTime);
    this._lastActivity = new Date();
    
    // Keep only last N processing times for memory efficiency
    if (this._processingTimes.length > this.maxProcessingTimeHistory) {
      this._processingTimes = this._processingTimes.slice(-this.maxProcessingTimeHistory);
    }
  }
  
  /**
   * Mark an event as failed during processing
   */
  markFailed(): void {
    this._totalFailed++;
    this._lastActivity = new Date();
  }
  
  /**
   * Record an enqueue operation
   */
  markEnqueued(): void {
    this._totalEnqueued++;
    this._lastActivity = new Date();
  }
  
  /**
   * Record a dequeue operation
   */
  markDequeued(): void {
    this._totalDequeued++;
    this._lastActivity = new Date();
  }
  
  /**
   * Get comprehensive queue metrics
   * @param currentQueueSize Current number of messages in the queue
   * @param activeConsumers Number of active consumers
   * @param pendingAcknowledgments Number of messages pending acknowledgment
   * @returns Complete queue metrics
   */
  getMetrics(
    currentQueueSize: number = 0,
    activeConsumers: number = 0,
    pendingAcknowledgments: number = 0
  ): QueueMetrics {
    const averageProcessingTime = this._processingTimes.length > 0
      ? this._processingTimes.reduce((
      sum,
      time
    ) => sum + time, 0) / this._processingTimes.length
      : 0;
    
    return {
      queueName: this.queueName,
      messagesSent: this._totalEnqueued,
      messagesReceived: this._totalDequeued,
      messagesInQueue: currentQueueSize,
      activeConsumers,
      failedMessages: this._totalFailed,
      avgProcessingTimeMs: Math.round(averageProcessingTime * 100) / 100, // Round to 2 decimal places
      lastActivity: this._lastActivity,
      pendingAcknowledgments
    };
  }
  
  /**
   * Reset all metrics (useful for testing or queue reset scenarios)
   */
  reset(): void {
    this._totalProcessed = 0;
    this._totalFailed = 0;
    this._totalEnqueued = 0;
    this._totalDequeued = 0;
    this._processingTimes = [];
    this._lastActivity = new Date();
  }
  
  /**
   * Get current processing statistics summary
   * @returns Processing statistics
   */
  getProcessingStats(): {
    totalProcessed: number;
    totalFailed: number;
    successRate: number;
    averageProcessingTime: number;
  } {
    const total = this._totalProcessed + this._totalFailed;
    const successRate = total > 0 ? (this._totalProcessed / total) * 100 : 100;
    const averageProcessingTime = this._processingTimes.length > 0
      ? this._processingTimes.reduce((
      sum,
      time
    ) => sum + time, 0) / this._processingTimes.length
      : 0;
    
    return {
      totalProcessed: this._totalProcessed,
      totalFailed: this._totalFailed,
      successRate: Math.round(successRate * 100) / 100,
      averageProcessingTime: Math.round(averageProcessingTime * 100) / 100
    };
  }
  
  /**
   * Get last activity timestamp
   * @returns Date of last recorded activity
   */
  getLastActivity(): Date {
    return new Date(this._lastActivity);
  }
}
