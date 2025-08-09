/**
 * @fileoverview Topic Service - Dedicated Topic Management
 * Enhanced with ServiceHooks integration for topic monitoring.
 */

import { Either } from '@/either';
import { EventHub, EventListener, EventSubscription } from '@/eventhub';
import { Topic } from '@/eventhub/topic/Topic';
import { TopicConfig } from '@/eventhub/topic/types';
import { Publisher } from '@/eventhub/topic/Publisher';
import { Subscriber } from '@/eventhub/topic/Subscriber';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Logger } from '@/logger';
import { Maybe } from '@/maybe';
import { ApplicationContextError } from '../ApplicationContextError';

// Import plugin integration types
import { IPluginEngine } from '@/plugin/core/IPluginEngine';

const LOGGER_NAMESPACE = "[TopicService]" as const;

export class TopicService {
  private readonly eventHub: EventHub;
  private readonly logger: Logger;
  private readonly createdTopics = new Set<string>();

  // ServiceHooks integration
  private pluginEngine: IPluginEngine | null = null;

  constructor(eventHub: EventHub, logger: Logger) {
    this.eventHub = eventHub;
    this.logger = logger;
  }

  /**
   * Set the plugin engine for ServiceHooks integration
   */
  setPluginEngine(engine: IPluginEngine): void {
    this.pluginEngine = engine;
    
    this.logger.debug(`${LOGGER_NAMESPACE} Plugin engine set for ServiceHooks integration`);
  }

  async createTopic(config: TopicConfig): Promise<Either<ApplicationContextError, Topic>> {
    if (!this.eventHub.isRunning()) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_TOPIC_CREATION_FAILED,
          `Cannot create topic '${config.name}' - EventHub is not running`,
          'createTopic'
        )
      );
    }

    const result = await this.eventHub.createTopic(config);
    if (Either.isLeft(result)) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_TOPIC_CREATION_FAILED,
          `Failed to create topic '${config.name}': ${result.left.message}`,
          'createTopic',
          undefined,
          undefined,
          result.left
        )
      );
    }

    this.createdTopics.add(config.name);
    this.logger.info(`Topic created: ${config.name}`);
    
    return Either.right(result.right);
  }

  async deleteTopic(name: string): Promise<Either<ApplicationContextError, void>> {
    const result = await this.eventHub.deleteTopic(name);
    if (Either.isLeft(result)) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_TOPIC_DELETION_FAILED,
          `Failed to delete topic '${name}': ${result.left.message}`,
          'deleteTopic',
          undefined,
          undefined,
          result.left
        )
      );
    }

    this.createdTopics.delete(name);
    this.logger.info(`Topic deleted: ${name}`);
    
    return Either.right(undefined as void);
  }

  getTopic(name: string): Maybe<Topic> {
    return this.eventHub.getTopic(name);
  }

  getPublisher(): Publisher {
    return this.eventHub.getPublisher();
  }

  getSubscriber(): Subscriber {
    return this.eventHub.getSubscriber();
  }

  async publishToTopic<T>(topicName: string, message: T): Promise<Either<ApplicationContextError, void>> {
    if (!this.eventHub.isRunning()) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_TOPIC_PUBLISH_FAILED,
          `Cannot publish message to topic '${topicName}' - EventHub is not running`,
          'publishToTopic'
        )
      );
    }

    const topic = this.getTopic(topicName);
    if (Maybe.isNothing(topic)) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_TOPIC_PUBLISH_FAILED,
          `Topic '${topicName}' does not exist`,
          'publishToTopic'
        )
      );
    }

    const publisher = this.getPublisher();
    const result = await publisher.publish(topicName, message);
    
    if (Either.isLeft(result)) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_TOPIC_PUBLISH_FAILED,
          `Failed to publish message to topic '${topicName}': ${result.left.message}`,
          'publishToTopic',
          undefined,
          undefined,
          result.left
        )
      );
    }

    return Either.right(undefined as void);
  }

  async subscribeToTopic<T>(
    topicName: string,
    listener: EventListener<T>
  ): Promise<Either<ApplicationContextError, EventSubscription>> {
    if (!this.eventHub.isRunning()) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_TOPIC_SUBSCRIBE_FAILED,
          `Cannot subscribe to topic '${topicName}' - EventHub is not running`,
          'subscribeToTopic'
        )
      );
    }

    const topic = this.getTopic(topicName);
    if (Maybe.isNothing(topic)) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_TOPIC_SUBSCRIBE_FAILED,
          `Topic '${topicName}' does not exist`,
          'subscribeToTopic'
        )
      );
    }

    const subscriber = this.getSubscriber();
    const result = await subscriber.subscribe(topicName, listener);
    
    if (Either.isLeft(result)) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_TOPIC_SUBSCRIBE_FAILED,
          `Failed to subscribe to topic '${topicName}': ${result.left.message}`,
          'subscribeToTopic',
          undefined,
          undefined,
          result.left
        )
      );
    }

    return Either.right(result.right);
  }

  async unsubscribeFromTopic(subscriptionId: string): Promise<Either<ApplicationContextError, void>> {
    const subscriber = this.getSubscriber();
    const result = await subscriber.unsubscribe(subscriptionId);
    
    if (Either.isLeft(result)) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_TOPIC_UNSUBSCRIBE_FAILED,
          `Failed to unsubscribe from topic: ${result.left.message}`,
          'unsubscribeFromTopic',
          undefined,
          undefined,
          result.left
        )
      );
    }

    return Either.right(undefined as void);
  }

  async cleanup(): Promise<Either<ApplicationContextError, void>> {
    const errors: string[] = [];
    
    for (const topicName of Array.from(this.createdTopics)) {
      const result = await this.deleteTopic(topicName);
      if (Either.isLeft(result)) {
        errors.push(`Failed to cleanup topic '${topicName}': ${result.left.message}`);
      }
    }

    if (errors.length > 0) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_INITIALIZATION_FAILED,
          `Topic cleanup failed: ${errors.join(', ')}`,
          'cleanup'
        )
      );
    }

    return Either.right(undefined as void);
  }

  getCreatedTopics(): ReadonlySet<string> {
    return this.createdTopics;
  }
}
