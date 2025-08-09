/**
 * @fileoverview Queue Manager Implementation for Point-to-Point Messaging
 *
 * This module provides centralized management of queues using the new layered
 * architecture with MessageBus pattern for clear separation of concerns between
 * storage operations and business logic.
 *
 * @author
 * @version 1.0.0
 */

import { Either } from '@/either';
import {
  EventHubError,
  QueueConfig
} from "@/eventhub";
import { Queue } from "@/eventhub/queue/Queue";
import { QueueMetrics } from "@/eventhub/queue/types";
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import {
  ConsoleLogger,
  Logger
} from '@/logger';
import { Maybe } from '@/maybe';

/**
 * Queue Manager interface for managing queues
 */
export abstract class QueueManager {
  static create(): QueueManager {
    return new QueueManagerImpl()
  }
  /** Create a new queue */
  abstract createQueue(config: QueueConfig): Promise<Either<EventHubError, Queue>>;
  /** Get an existing queue */
  abstract getQueue(name: string): Maybe<Queue>;
  /** Delete a queue */
  abstract deleteQueue(name: string): Promise<Either<EventHubError, void>>;
  /** List all queues */
  abstract listQueues(): string[];
}

/**
 * Centralized queue manager for Point-to-Point messaging using layered architecture
 *
 * This implementation uses the new MessageBus pattern where QueueImpl handles
 * business logic and composes with appropriate MessageBus implementations for storage.
 */
class QueueManagerImpl
  extends QueueManager {
  private queues = new Map<string, Queue>();
  private readonly _logger: Logger;
  
  constructor() {
    super();
    // TODO:
    this._logger = ConsoleLogger;
  }
  
  /**
   * Create a new queue with the given configuration using the new layered architecture
   */
  async createQueue(config: QueueConfig): Promise<Either<EventHubError, Queue>> {
    try {
      // Validate configuration
      if (!config.name || config.name.trim() === '') {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.INVALID_CONFIGURATION,
          'Queue name is required',
          'createQueue',
          { queueName: config.name }
        ));
      }
      
      if (this.queues.has(config.name)) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.RESOURCE_ALREADY_EXISTS,
          `Queue '${ config.name }' already exists`,
          'createQueue',
          { queueName: config.name }
        ));
      }
      
      // Validate queue size
      if (config.maxQueueSize && config.maxQueueSize <= 0) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.INVALID_CONFIGURATION,
          'Queue maxQueueSize must be greater than 0',
          'createQueue',
          {
            queueName: config.name,
            additionalData: { queueSize: config.maxQueueSize }
          }
        ));
      }
      
      // Create QueueImpl with specified message bus type (new layered architecture)
      const queue = Queue.create(
        config.name,
        config,
        config.storageType || 'array' // New config option - defaults to array
      );
      
      // Start the queue immediately
      const startResult = await queue.start();
      if (Either.isLeft(startResult)) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.CONTEXT_QUEUE_CREATION_FAILED,
          `Failed to start queue '${ config.name }'`,
          'createQueue',
          { queueName: config.name },
          undefined,
          startResult.left
        ));
      }
      
      this.queues.set(config.name, queue);
      this.info(`Created queue '${ config.name }' with ${ config.storageType || 'array' } storage`);
      
      return Either.right(queue as Queue);
    } catch (error) {
      const creationError = EventHubError.create(
        UnifiedErrorCode.CONTEXT_QUEUE_CREATION_FAILED,
        `Failed to create queue '${ config.name }'`,
        'createQueue',
        { queueName: config.name },
        undefined,
        error instanceof Error ? error : undefined
      );
      this.error(creationError.message);
      return Either.left(creationError);
    }
  }
  
  /**
   * Get an existing queue by name
   */
  getQueue(name: string): Maybe<Queue> {
    const queue = this.queues.get(name);
    return queue ? Maybe.just(queue) : Maybe.nothing();
  }
  
  /**
   * Delete a queue and clean up resources
   */
  async deleteQueue(name: string): Promise<Either<EventHubError, void>> {
    try {
      const queue = this.queues.get(name);
      if (!queue) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.RESOURCE_NOT_FOUND,
          `Queue '${ name }' not found`,
          'deleteQueue',
          { queueName: name }
        ));
      }
      
      // Stop the queue (this will clean up consumers and processing loops)
      const stopResult = await queue.stop();
      if (Either.isLeft(stopResult)) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.CONTEXT_QUEUE_DELETION_FAILED,
          `Failed to stop queue '${ name }'`,
          'deleteQueue',
          { queueName: name },
          undefined,
          stopResult.left
        ));
      }
      
      // Remove from registry
      this.queues.delete(name);
      this.info(`Deleted queue '${ name }' successfully`);
      
      return Either.right(undefined as void);
    } catch (error) {
      const deletionError = EventHubError.create(
        UnifiedErrorCode.CONTEXT_QUEUE_DELETION_FAILED,
        `Failed to delete queue '${ name }'`,
        'deleteQueue',
        { queueName: name },
        undefined,
        error instanceof Error ? error : undefined
      );
      this.error(deletionError.message);
      return Either.left(deletionError);
    }
  }
  
  /**
   * List all queue names
   */
  listQueues(): string[] {
    return Array.from(this.queues.keys());
  }
  
  /**
   * Get metrics for a specific queue
   */
  getQueueMetrics(name: string): Maybe<QueueMetrics> {
    const queue = this.queues.get(name);
    return queue ? Maybe.just(queue.getMetrics()) : Maybe.nothing();
  }
  
  /**
   * Get metrics for all queues
   */
  getAllQueuesMetrics(): QueueMetrics[] {
    return Array.from(this.queues.values()).map(queue => queue.getMetrics());
  }
  
  /**
   * Stop all queues
   */
  async stopAllQueues(): Promise<Either<EventHubError, void>> {
    try {
      const queueNames = Array.from(this.queues.keys());
      const stopPromises = Array.from(this.queues.values()).map(queue => queue.stop());
      const results = await Promise.allSettled(stopPromises);
      
      const failures = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((
          result,
          index
        ) => ({ name: queueNames[index], error: result.reason }));
      
      if (failures.length > 0) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.CONTEXT_QUEUE_DELETION_FAILED,
          `Failed to stop ${ failures.length } queues`,
          'stopAllQueues',
          {
            additionalData: {
              failedQueues: failures.map(f => f.name),
              totalQueues: queueNames.length
            }
          }
        ));
      }
      
      this.info(`Stopped all ${ queueNames.length } queues successfully`);
      return Either.right(undefined as void);
    } catch (error) {
      const stopError = EventHubError.create(
        UnifiedErrorCode.CONTEXT_QUEUE_DELETION_FAILED,
        'Failed to stop all queues',
        'stopAllQueues',
        {},
        undefined,
        error instanceof Error ? error : undefined
      );
      this.error(stopError.message);
      return Either.left(stopError);
    }
  }
  
  /**
   * Get total message count across all queues
   */
  getTotalMessages(): { sent: number; received: number; inQueue: number; pending: number } {
    return Array.from(this.queues.values()).reduce(
      (
        totals,
        queue
      ) => {
        const metrics = queue.getMetrics();
        return {
          sent: totals.sent + metrics.messagesSent,
          received: totals.received + metrics.messagesReceived,
          inQueue: totals.inQueue + metrics.messagesInQueue,
          pending: totals.pending + metrics.pendingAcknowledgments
        };
      },
      { sent: 0, received: 0, inQueue: 0, pending: 0 }
    );
  }
  
  /**
   * Get queue by name (throws if not found) - utility method
   */
  getQueueOrThrow(name: string): Queue {
    const queueMaybe = this.getQueue(name);
    if (Maybe.isNothing(queueMaybe)) {
      throw EventHubError.create(
        UnifiedErrorCode.RESOURCE_NOT_FOUND,
        `Queue '${ name }' not found`,
        'getQueueOrThrow',
        { queueName: name }
      );
    }
    return queueMaybe.value;
  }
  
  /**
   * Check if queue exists
   */
  hasQueue(name: string): boolean {
    return this.queues.has(name);
  }
  
  /**
   * Get running queues count
   */
  getRunningQueuesCount(): number {
    return Array.from(this.queues.values()).filter(queue => queue.isRunning()).length;
  }
  
  doToInfo(): string {
    const queueNames = this.listQueues();
    const totals = this.getTotalMessages();
    
    return JSON.stringify({
      queuesCount: queueNames.length,
      runningQueues: this.getRunningQueuesCount(),
      queueNames,
      totalMessages: totals
    });
  }
  
  doToDebug(): string {
    const metrics = this.getAllQueuesMetrics();
    const totals = this.getTotalMessages();
    
    return JSON.stringify({
      queuesCount: this.queues.size,
      queues: Array.from(this.queues.entries()).map(([name, queue]) => ({
        name,
        running: queue.isRunning(),
        metrics: queue.getMetrics()
      })),
      totalMessages: totals,
      allMetrics: metrics
    });
  }
  
  private debug(
    message: string,
    ...args: any[]
  ): void {
    this._logger.debug(`[QueueManager] ${ message }`, ...args);
  }
  
  private info(
    message: string,
    ...args: any[]
  ): void {
    this._logger.info(`[QueueManager] ${ message }`, ...args);
  }
  
  private warn(
    message: string,
    ...args: any[]
  ): void {
    this._logger.warn(`[QueueManager] ${ message }`, ...args);
  }
  
  private error(
    message: string,
    ...args: any[]
  ): void {
    this._logger.error(`[QueueManager] ${ message }`, ...args);
  }
}
