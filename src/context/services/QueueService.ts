/**
 * @fileoverview Queue Service - Dedicated Queue Management
 * Enhanced with ServiceHooks integration for queue monitoring.
 */

import { Either } from '@/either';
import { EventHub } from '@/eventhub';
import { Queue } from '@/eventhub/queue/Queue';
import { QueueConfig } from '@/eventhub/queue/types';
import { MessageSender } from '@/eventhub/queue/MessageSender';
import { MessageReceiver } from '@/eventhub/queue/MessageReceiver';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Logger } from '@/logger';
import { Maybe } from '@/maybe';
import { ApplicationContextError } from '../ApplicationContextError';

import { IPluginEngine } from '@/plugin/core/IPluginEngine';

const LOGGER_NAMESPACE = "[QueueService]" as const;

export class QueueService {
  private readonly eventHub: EventHub;
  private readonly logger: Logger;
  private readonly createdQueues = new Set<string>();

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

  async createQueue(config: QueueConfig): Promise<Either<ApplicationContextError, Queue>> {
    if (!this.eventHub.isRunning()) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_QUEUE_CREATION_FAILED,
          `Cannot create queue '${config.name}' - EventHub is not running`,
          'createQueue',
          { queueName: config.name }
        )
      );
    }

    try {
      const queue = await this.eventHub.createQueue(config);
      if (Either.isLeft(queue)) {
        return Either.left(
          ApplicationContextError.create(
            UnifiedErrorCode.CONTEXT_QUEUE_CREATION_FAILED,
            `Failed to create queue '${config.name}': ${queue.left.message}`,
            'createQueue',
            { queueName: config.name }
          )
        );
      }

      this.createdQueues.add(config.name);
      this.logger.info(`${LOGGER_NAMESPACE} Queue created successfully`, {
        queueName: config.name
      });

      return Either.right(queue.right);

    } catch (error) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_QUEUE_CREATION_FAILED,
          `Queue creation failed: ${error instanceof Error ? error.message : String(error)}`,
          'createQueue',
          { queueName: config.name }
        )
      );
    }
  }

  async deleteQueue(name: string): Promise<Either<ApplicationContextError, void>> {
    const result = await this.eventHub.deleteQueue(name);
    if (Either.isLeft(result)) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_QUEUE_DELETION_FAILED,
          `Failed to delete queue '${name}': ${result.left.message}`,
          'deleteQueue',
          undefined,
          undefined,
          result.left
        )
      );
    }

    this.createdQueues.delete(name);
    this.logger.info(`Queue deleted: ${name}`);
    
    return Either.right(undefined as void);
  }

  getQueue(name: string): Maybe<Queue> {
    return this.eventHub.getQueue(name);
  }

  getMessageSender(): MessageSender {
    return this.eventHub.getMessageSender();
  }

  getMessageReceiver(): MessageReceiver {
    return this.eventHub.getMessageReceiver();
  }

  async sendMessage<T>(queueName: string, message: T): Promise<Either<ApplicationContextError, void>> {
    if (!this.eventHub.isRunning()) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_QUEUE_MESSAGE_SEND_FAILED,
          `Cannot send message to queue '${queueName}' - EventHub is not running`,
          'sendMessage'
        )
      );
    }

    const queue = this.getQueue(queueName);
    if (Maybe.isNothing(queue)) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_QUEUE_MESSAGE_SEND_FAILED,
          `Queue '${queueName}' does not exist`,
          'sendMessage'
        )
      );
    }

    const messageSender = this.getMessageSender();
    const result = await messageSender.send(queueName, message);
    
    if (Either.isLeft(result)) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_QUEUE_MESSAGE_SEND_FAILED,
          `Failed to send message to queue '${queueName}': ${result.left.message}`,
          'sendMessage',
          undefined,
          undefined,
          result.left
        )
      );
    }

    return Either.right(undefined as void);
  }

  async receiveMessage<T>(queueName: string): Promise<Either<ApplicationContextError, Maybe<T>>> {
    if (!this.eventHub.isRunning()) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_QUEUE_MESSAGE_RECEIVE_FAILED,
          `Cannot receive message from queue '${queueName}' - EventHub is not running`,
          'receiveMessage'
        )
      );
    }

    const queue = this.getQueue(queueName);
    if (Maybe.isNothing(queue)) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_QUEUE_MESSAGE_RECEIVE_FAILED,
          `Queue '${queueName}' does not exist`,
          'receiveMessage'
        )
      );
    }

    const messageReceiver = this.getMessageReceiver();
    const result = await messageReceiver.receive<T>(queueName);
    
    if (Either.isLeft(result)) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_QUEUE_MESSAGE_RECEIVE_FAILED,
          `Failed to receive message from queue '${queueName}': ${result.left.message}`,
          'receiveMessage',
          undefined,
          undefined,
          result.left
        )
      );
    }

    return Either.right(result.right);
  }

  async cleanup(): Promise<Either<ApplicationContextError, void>> {
    const errors: string[] = [];
    
    for (const queueName of Array.from(this.createdQueues)) {
      const result = await this.deleteQueue(queueName);
      if (Either.isLeft(result)) {
        errors.push(`Failed to cleanup queue '${queueName}': ${result.left.message}`);
      }
    }

    if (errors.length > 0) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_INITIALIZATION_FAILED,
          `Queue cleanup failed: ${errors.join(', ')}`,
          'cleanup'
        )
      );
    }

    return Either.right(undefined as void);
  }

  getCreatedQueues(): ReadonlySet<string> {
    return this.createdQueues;
  }

  dispose(): void {
    this.createdQueues.clear();
    this.logger.debug(`${LOGGER_NAMESPACE} Service disposed`);
  }
}
