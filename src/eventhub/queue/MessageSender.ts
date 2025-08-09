/**
 * @fileoverview Message Sender Implementation for Point-to-Point Pattern
 *
 * This module provides the concrete implementation of the MessageSender interface
 * for sending messages to queues in the Point-to-Point messaging pattern.
 *
 * @author
 * @version 1.0.0
 */

import { Either } from '@/either';
import { EventHubError } from "@/eventhub";
import { QueueManager } from "@/eventhub/queue/QueueManager";
import { EventPriority } from '@/eventhub/types';
import { UnifiedErrorCode } from "@/exception/ErrorCodes";
import { Maybe } from '@/maybe';

/**
 * Message Sender interface for sending messages to queues
 */
export abstract class MessageSender {
  
  static create(queueManager: QueueManager): MessageSender {
    return new MessageSenderImpl(queueManager);
  }
  
  /** Send a message to a queue */
  abstract send<T>(
    queueName: string,
    message: T,
    priority?: EventPriority
  ): Promise<Either<EventHubError, void>>;
  /** Send multiple messages in batch */
  abstract sendBatch<T>(
    queueName: string,
    messages: T[],
    priority?: EventPriority
  ): Promise<Either<EventHubError, void>>;
}

/**
 * MessageSender implementation for sending messages to Queues
 */
class MessageSenderImpl
  extends MessageSender {
  private _connected = true;
  
  constructor(private queueManager: QueueManager) {
    super()
  }
  
  async send<T>(
    queueName: string,
    message: T,
    priority?: EventPriority
  ): Promise<Either<EventHubError, void>> {
    try {
      if (!this._connected) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.EVENTHUB_NOT_INITIALIZED,
          'MessageSender is not connected',
          'send',
          { queueName }
        ));
      }
      
      const queue = this.queueManager.getQueue(queueName);
      if (Maybe.isNothing(queue)) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.RESOURCE_NOT_FOUND,
          `Queue '${ queueName }' not found`,
          'send',
          { queueName }
        ));
      }
      
      const sendResult = await queue.value.send(message, priority);
      if (Either.isLeft(sendResult)) {
        return Either.left(sendResult.left);
      }
      
      return Either.right(undefined as void);
    } catch (error) {
      const sendError = EventHubError.create(
        UnifiedErrorCode.EVENT_PROCESSING_FAILED,
        'Failed to send message to queue',
        'send',
        { queueName },
        undefined,
        error instanceof Error ? error : undefined
      );
      return Either.left(sendError);
    }
  }
  
  async sendBatch<T>(
    queueName: string,
    messages: T[],
    priority?: EventPriority
  ): Promise<Either<EventHubError, void>> {
    try {
      if (!this._connected) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.EVENTHUB_NOT_INITIALIZED,
          'MessageSender is not connected',
          'sendBatch',
          {
            queueName,
            additionalData: { messageCount: messages.length }
          }
        ));
      }
      
      const queue = this.queueManager.getQueue(queueName);
      if (Maybe.isNothing(queue)) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.RESOURCE_NOT_FOUND,
          `Queue '${ queueName }' not found`,
          'sendBatch',
          {
            queueName,
            additionalData: { messageCount: messages.length }
          }
        ));
      }
      
      for (const message of messages) {
        const sendResult = await queue.value.send(message, priority);
        if (Either.isLeft(sendResult)) {
          return Either.left(sendResult.left);
        }
      }
      
      return Either.right(undefined as void);
    } catch (error) {
      const batchError = EventHubError.create(
        UnifiedErrorCode.EVENT_PROCESSING_FAILED,
        'Failed to send batch of messages to queue',
        'sendBatch',
        {
          queueName,
          additionalData: { messageCount: messages.length }
        },
        undefined,
        error instanceof Error ? error : undefined
      );
      return Either.left(batchError);
    }
  }
  
  connect(): Either<EventHubError, void> {
    try {
      this._connected = true;
      return Either.right(undefined as void);
    } catch (error) {
      const connectError = EventHubError.create(
        UnifiedErrorCode.ADAPTER_CONNECTION_FAILED,
        'Failed to connect MessageSender',
        'connect',
        {},
        undefined,
        error instanceof Error ? error : undefined
      );
      return Either.left(connectError);
    }
  }
  
  disconnect(): Either<EventHubError, void> {
    try {
      this._connected = false;
      return Either.right(undefined as void);
    } catch (error) {
      const disconnectError = EventHubError.create(
        UnifiedErrorCode.ADAPTER_DISCONNECTION_FAILED,
        'Failed to disconnect MessageSender',
        'disconnect',
        {},
        undefined,
        error instanceof Error ? error : undefined
      );
      return Either.left(disconnectError);
    }
  }
  
  isConnected(): boolean {
    return this._connected;
  }
}
