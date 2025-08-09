/**
 * @fileoverview Topic Manager Implementation
 *
 * This module provides centralized management of topics including creation,
 * deletion, lifecycle management, and metrics collection for the
 * Publisher-Subscriber pattern.
 *
 * @author
 * @version 1.0.0
 */

import { Either } from '@/either';
import { EventHubError } from '@/eventhub/EventHubError';
import { Topic, } from "@/eventhub/topic/Topic";
import { TopicMetrics } from "@/eventhub/topic/types";
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import {
  ConsoleLogger,
  Logger
} from '@/logger';
import { Maybe } from '@/maybe';
import { TopicConfig, } from "./types";

/**
 * Topic Manager interface for managing topics
 */
export abstract class TopicManager {
  
  static create(): TopicManager {
    return new TopicManagerImpl()
  }
  /** Create a new topic */
  abstract createTopic(config: TopicConfig): Promise<Either<EventHubError, Topic>>;
  /** Get an existing topic */
  abstract getTopic(name: string): Maybe<Topic>;
  /** Delete a topic */
  abstract deleteTopic(name: string): Promise<Either<EventHubError, void>>;
  /** List all topics */
  abstract listTopics(): string[];
  /** Get topic metrics */
  abstract getTopicMetrics(name: string): Maybe<TopicMetrics>;
}

/**
 * Centralized topic manager for Publisher-Subscriber pattern
 */
class TopicManagerImpl
  extends TopicManager {
  
  private topics = new Map<string, Topic>();
  private readonly _logger: Logger;
  
  constructor() {
    super();
    // TODO:
    this._logger = ConsoleLogger;
  }
  
  /**
   * Create a new topic with the given configuration
   */
  async createTopic(config: TopicConfig): Promise<Either<EventHubError, Topic>> {
    try {
      // Validate configuration
      if (!config.name || config.name.trim() === '') {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.INVALID_CONFIGURATION,
          'Topic name is required',
          'createTopic',
          {
            timestamp: new Date(),
            module: 'EVENTHUB',
            topicName: config.name
          }
        ));
      }
      
      if (this.topics.has(config.name)) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.CONTEXT_TOPIC_CREATION_FAILED,
          `Topic '${ config.name }' already exists`,
          'createTopic',
          {
            timestamp: new Date(),
            module: 'EVENTHUB',
            topicName: config.name
          }
        ));
      }
      
      const topic: Topic = Topic.create(config.name, config);
      
      // Start the topic immediately
      const startResult = await topic.start();
      if (Either.isLeft(startResult)) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.CONTEXT_TOPIC_CREATION_FAILED,
          `Failed to start topic '${ config.name }'`,
          'createTopic',
          {
            timestamp: new Date(),
            module: 'EVENTHUB',
            topicName: config.name
          },
          undefined,
          startResult.left
        ));
      }
      
      this.topics.set(config.name, topic);
      this.info(`Created topic '${ config.name }' successfully`);
      return Either.right(topic as Topic);
    } catch (error) {
      const creationError = EventHubError.create(
        UnifiedErrorCode.CONTEXT_TOPIC_CREATION_FAILED,
        `Failed to create topic '${ config.name }'`,
        'createTopic',
        {
          timestamp: new Date(),
          module: 'EVENTHUB',
          topicName: config.name
        },
        undefined,
        error instanceof Error ? error : undefined
      );
      this.error(creationError.getDetailedMessage());
      return Either.left(creationError);
    }
  }
  
  /**
   * Get an existing topic by name
   */
  getTopic(name: string): Maybe<Topic> {
    const topic = this.topics.get(name);
    return topic ? Maybe.just(topic) : Maybe.nothing();
  }
  
  /**
   * Delete a topic and clean up resources
   */
  async deleteTopic(name: string): Promise<Either<EventHubError, void>> {
    try {
      const topic = this.topics.get(name);
      if (!topic) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.RESOURCE_NOT_FOUND,
          `Topic '${ name }' not found`,
          'deleteTopic',
          {
            timestamp: new Date(),
            module: 'EVENTHUB',
            topicName: name
          }
        ));
      }
      
      // Stop the topic
      const stopResult = await topic.stop();
      if (Either.isLeft(stopResult)) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.CONTEXT_TOPIC_DELETION_FAILED,
          `Failed to stop topic '${ name }'`,
          'deleteTopic',
          {
            timestamp: new Date(),
            module: 'EVENTHUB',
            topicName: name
          },
          undefined,
          stopResult.left
        ));
      }
      
      // Clean up queue
      try {
        await topic.clear();
      } catch (error) {
        this.warn(`Failed to clear topic queue for '${ name }':`, error);
      }
      
      // Remove from registry
      this.topics.delete(name);
      this.info(`Deleted topic '${ name }' successfully`);
      
      return Either.right(undefined as void);
    } catch (error) {
      const deletionError = EventHubError.create(
        UnifiedErrorCode.CONTEXT_TOPIC_DELETION_FAILED,
        `Failed to delete topic '${ name }'`,
        'deleteTopic',
        {
          timestamp: new Date(),
          module: 'EVENTHUB',
          topicName: name
        },
        undefined,
        error instanceof Error ? error : undefined
      );
      this.error(deletionError.getDetailedMessage());
      return Either.left(deletionError);
    }
  }
  
  /**
   * List all topic names
   */
  listTopics(): string[] {
    return Array.from(this.topics.keys());
  }
  
  /**
   * Get metrics for a specific topic
   */
  getTopicMetrics(name: string): Maybe<TopicMetrics> {
    const topic = this.topics.get(name);
    return topic ? Maybe.just(topic.getMetrics()) : Maybe.nothing();
  }
  
  /**
   * Get metrics for all topics
   */
  getAllTopicsMetrics(): TopicMetrics[] {
    return Array.from(this.topics.values()).map(topic => topic.getMetrics());
  }
  
  /**
   * Stop all topics
   */
  async stopAllTopics(): Promise<Either<EventHubError, void>> {
    try {
      const topicNames = Array.from(this.topics.keys());
      const stopPromises = Array.from(this.topics.values()).map(topic => topic.stop());
      const results = await Promise.allSettled(stopPromises);
      
      const failures = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((
          result,
          index
        ) => ({ name: topicNames[index], error: result.reason }));
      
      if (failures.length > 0) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.CONTEXT_TOPIC_DELETION_FAILED,
          `Failed to stop ${ failures.length } topics`,
          'stopAllTopics',
          {
            timestamp: new Date(),
            module: 'EVENTHUB',
            additionalData: {
              failedTopics: failures.map(f => f.name),
              totalTopics: topicNames.length
            }
          }
        ));
      }
      
      this.info(`Stopped all ${ topicNames.length } topics successfully`);
      return Either.right(undefined as void);
    } catch (error) {
      const stopError = EventHubError.create(
        UnifiedErrorCode.CONTEXT_TOPIC_DELETION_FAILED,
        'Failed to stop all topics',
        'stopAllTopics',
        {
          timestamp: new Date(),
          module: 'EVENTHUB'
        },
        undefined,
        error instanceof Error ? error : undefined
      );
      this.error(stopError.getDetailedMessage());
      return Either.left(stopError);
    }
  }
  
  /**
   * Get total message count across all topics
   */
  getTotalMessages(): { published: number; consumed: number; inQueue: number } {
    return Array.from(this.topics.values()).reduce(
      (
        totals,
        topic
      ) => {
        const metrics = topic.getMetrics();
        return {
          published: totals.published + metrics.messagesPublished,
          consumed: totals.consumed + metrics.messagesConsumed,
          inQueue: totals.inQueue + metrics.messagesInQueue
        };
      },
      { published: 0, consumed: 0, inQueue: 0 }
    );
  }
  
  doToInfo(): string {
    const topicNames = this.listTopics();
    const totals = this.getTotalMessages();
    
    return JSON.stringify({
      topicsCount: topicNames.length,
      topicNames,
      totalMessages: totals
    });
  }
  
  doToDebug(): string {
    const metrics = this.getAllTopicsMetrics();
    const totals = this.getTotalMessages();
    
    return JSON.stringify({
      topicsCount: this.topics.size,
      topics: Array.from(this.topics.entries()).map(([name, topic]) => ({
        name,
        running: topic.isRunning(),
        subscribersCount: topic.getSubscriptions().length,
        queueSize: topic.getMessageCount()
      })),
      totalMessages: totals,
      allMetrics: metrics
    });
  }
  
  private debug(
    message: string,
    ...args: any[]
  ): void {
    this._logger.debug(`[Microkernel] ${ message }`, ...args);
  }
  
  private info(
    message: string,
    ...args: any[]
  ): void {
    this._logger.info(`[Microkernel] ${ message }`, ...args);
  }
  
  private warn(
    message: string,
    ...args: any[]
  ): void {
    this._logger.warn(`[Microkernel] ${ message }`, ...args);
  }
  
  private error(
    message: string,
    ...args: any[]
  ): void {
    this._logger.error(`[Microkernel] ${ message }`, ...args);
  }
}
