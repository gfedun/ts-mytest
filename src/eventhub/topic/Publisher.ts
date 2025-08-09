import { Either } from '@/either';
import { EventHubError } from '@/eventhub/EventHubError';
import { TopicManager } from "@/eventhub/topic/TopicManager";
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Maybe } from '@/maybe';

/**
 * Publisher interface for publishing messages to topics
 */
export abstract class Publisher {
  static create(topicManager: TopicManager) {
    return new PublisherImpl(topicManager);
  }
  /** Publish a message to a topic */
  abstract publish<T>(
    topicName: string,
    message: T,
    metadata?: Record<string, any>
  ): Promise<Either<EventHubError, string>>;
  /** Publish multiple messages in batch */
  abstract publishBatch<T>(
    topicName: string,
    messages: T[],
    metadata?: Record<string, any>
  ): Promise<Either<EventHubError, string[]>>;
  /** Connect the publisher */
  abstract connect(): Either<EventHubError, void>;
  /** Disconnect the publisher */
  abstract disconnect(): Either<EventHubError, void>;
  /** Check if publisher is connected */
  abstract isConnected(): boolean;
}

/**
 * Publisher implementation for publishing messages to topics
 */
class PublisherImpl
  extends Publisher {
  private _connected = true;
  
  constructor(private topicManager: TopicManager) {
    super()
  }
  
  async publish<T>(
    topicName: string,
    message: T,
    metadata?: Record<string, any>
  ): Promise<Either<EventHubError, string>> {
    try {
      if (!this._connected) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.EVENTHUB_NOT_INITIALIZED,
          'Publisher is not connected',
          'publish',
          { topicName }
        ));
      }
      
      const topic = this.topicManager.getTopic(topicName);
      if (Maybe.isNothing(topic)) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.RESOURCE_NOT_FOUND,
          `Topic '${ topicName }' not found`,
          'publish',
          { topicName }
        ));
      }
      
      const publishResult = await topic.value.publish(message, metadata);
      if (Either.isLeft(publishResult)) {
        return Either.left(publishResult.left);
      }
      
      // Generate message ID
      const messageId = `msg_${ Date.now() }_${ Math.random().toString(36).substring(2) }`;
      return Either.right(messageId);
    } catch (error) {
      const publishError = EventHubError.create(
        UnifiedErrorCode.EVENT_PROCESSING_FAILED,
        'Failed to publish message',
        'publish',
        { topicName },
        undefined,
        error instanceof Error ? error : undefined
      );
      return Either.left(publishError);
    }
  }
  
  async publishBatch<T>(
    topicName: string,
    messages: T[],
    metadata?: Record<string, any>
  ): Promise<Either<EventHubError, string[]>> {
    try {
      if (!this._connected) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.EVENTHUB_NOT_INITIALIZED,
          'Publisher is not connected',
          'publishBatch',
          {
            topicName,
            additionalData: { messageCount: messages.length }
          }
        ));
      }
      
      const topic = this.topicManager.getTopic(topicName);
      if (Maybe.isNothing(topic)) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.RESOURCE_NOT_FOUND,
          `Topic '${ topicName }' not found`,
          'publishBatch',
          {
            topicName,
            additionalData: { messageCount: messages.length }
          }
        ));
      }
      
      const messageIds: string[] = [];
      for (const message of messages) {
        const publishResult = await topic.value.publish(message, metadata);
        if (Either.isLeft(publishResult)) {
          return Either.left(publishResult.left);
        }
        
        const messageId = `msg_${ Date.now() }_${ Math.random().toString(36).substring(2) }`;
        messageIds.push(messageId);
      }
      
      return Either.right(messageIds);
    } catch (error) {
      const batchError = EventHubError.create(
        UnifiedErrorCode.EVENT_PROCESSING_FAILED,
        'Failed to publish batch messages',
        'publishBatch',
        {
          topicName,
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
        'Failed to connect publisher',
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
        'Failed to disconnect publisher',
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
