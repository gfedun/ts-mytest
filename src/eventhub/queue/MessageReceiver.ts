/**
 * @fileoverview MessageReceiver Implementation for Queue Operations
 *
 * This module provides the implementation for receiving messages from queues
 * in the EventHub Point-to-Point messaging pattern.
 *
 * @author
 * @version 1.0.0
 */
import { Either } from '@/either';
import { EventHubError } from "@/eventhub";
import { QueueManager } from "@/eventhub/queue/QueueManager";
import { ReceiveOptions } from "@/eventhub/queue/types";
import { UnifiedErrorCode } from "@/exception/ErrorCodes";
import { Maybe } from '@/maybe';

/**
 * Message Receiver interface for receiving messages from queues
 */
export abstract class MessageReceiver {
  
  static create(queueManager: QueueManager): MessageReceiver {
    return new MessageReceiverImpl(queueManager);
  }
  /** Receive a message from a queue */
  abstract receive<T>(queueName: string): Promise<Either<EventHubError, Maybe<T>>>;
  /** Receive multiple messages in batch */
  abstract receiveBatch<T>(
    queueName: string,
    maxMessages: number
  ): Promise<Either<EventHubError, T[]>>;
}

/**
 * MessageReceiver implementation for receiving messages from Queues
 */
class MessageReceiverImpl
  extends MessageReceiver {
  private _connected = true;
  
  constructor(private queueManager: QueueManager) {
    super()
  }
  
  async receive<T>(
    queueName: string,
    options?: ReceiveOptions
  ): Promise<Either<EventHubError, Maybe<T>>> {
    try {
      if (!this._connected) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.EVENTHUB_NOT_INITIALIZED,
          'MessageReceiver is not connected',
          'receive',
          { queueName }
        ));
      }
      
      const queue = this.queueManager.getQueue(queueName);
      if (Maybe.isNothing(queue)) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.RESOURCE_NOT_FOUND,
          `Queue '${ queueName }' not found`,
          'receive',
          { queueName }
        ));
      }
      
      const receiveResult = await queue.value.receive<T>();
      if (Either.isLeft(receiveResult)) {
        return Either.left(receiveResult.left);
      }
      
      return Either.right(receiveResult.right);
    } catch (error) {
      const receiveError = EventHubError.create(
        UnifiedErrorCode.EVENT_PROCESSING_FAILED,
        'Failed to receive message from queue',
        'receive',
        { queueName },
        undefined,
        error instanceof Error ? error : undefined
      );
      return Either.left(receiveError);
    }
  }
  
  async receiveBatch<T>(
    queueName: string,
    maxMessages: number,
    options?: ReceiveOptions
  ): Promise<Either<EventHubError, T[]>> {
    try {
      if (!this._connected) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.EVENTHUB_NOT_INITIALIZED,
          'MessageReceiver is not connected',
          'receiveBatch',
          {
            queueName,
            additionalData: { maxMessages }
          }
        ));
      }
      
      const queue = this.queueManager.getQueue(queueName);
      if (Maybe.isNothing(queue)) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.RESOURCE_NOT_FOUND,
          `Queue '${ queueName }' not found`,
          'receiveBatch',
          {
            queueName,
            additionalData: { maxMessages }
          }
        ));
      }
      
      const messages: T[] = [];
      for (let i = 0; i < maxMessages; i++) {
        const receiveResult = await queue.value.receive<T>();
        if (Either.isLeft(receiveResult)) {
          // If we can't receive more messages, return what we have
          if (messages.length > 0) {
            break;
          }
          return Either.left(receiveResult.left);
        }
        
        if (Maybe.isJust(receiveResult.right)) {
          messages.push(receiveResult.right.value);
        } else {
          // No more messages available
          break;
        }
      }
      
      return Either.right(messages);
    } catch (error) {
      const batchError = EventHubError.create(
        UnifiedErrorCode.EVENT_PROCESSING_FAILED,
        'Failed to receive batch messages from queue',
        'receiveBatch',
        {
          queueName,
          additionalData: { maxMessages }
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
        'Failed to connect MessageReceiver',
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
        'Failed to disconnect MessageReceiver',
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
