import { Either } from '@/either';
import {
  EventListener,
  EventSubscription,
  SubscriptionOptions
} from "@/eventhub";
import { EventHubError } from '@/eventhub/EventHubError';
import { TopicManager } from "@/eventhub/topic/TopicManager";
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Maybe } from '@/maybe';

/**
 * Subscriber interface for subscribing to topics
 */
export abstract class Subscriber {
  static create(topicManager: TopicManager) {
    return new SubscriberImpl(topicManager);
  }
  /** Subscribe to a topic */
  abstract subscribe<T>(
    topicName: string,
    listener: EventListener<T>,
    options?: SubscriptionOptions
  ): Promise<Either<EventHubError, EventSubscription>>;
  /** Unsubscribe from a topic */
  abstract unsubscribe(subscriptionId: string): Promise<Either<EventHubError, void>>;
  /** Unsubscribe all from a topic */
  abstract unsubscribeAll(topicName: string): Promise<Either<EventHubError, void>>;
  /** Connect the subscriber */
  abstract connect(): Either<EventHubError, void>;
  /** Disconnect the subscriber */
  abstract disconnect(): Either<EventHubError, void>;
  /** Check if subscriber is connected */
  abstract isConnected(): boolean;
  /** Get subscriptions */
  abstract getSubscriptions(topicName?: string): EventSubscription[];
}

/**
 * Subscriber implementation for subscribing to topics and receiving messages
 */
class SubscriberImpl
  extends Subscriber {
  private _connected = true;
  
  constructor(private topicManager: TopicManager) {
    super();
  }
  
  async subscribe<T>(
    topicName: string,
    listener: EventListener<T>,
    options?: SubscriptionOptions
  ): Promise<Either<EventHubError, EventSubscription>> {
    try {
      if (!this._connected) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.EVENTHUB_NOT_INITIALIZED,
          'Subscriber is not connected',
          'subscribe',
          { topicName }
        ));
      }
      
      const topic = this.topicManager.getTopic(topicName);
      if (Maybe.isNothing(topic)) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.RESOURCE_NOT_FOUND,
          `Topic '${ topicName }' not found`,
          'subscribe',
          { topicName }
        ));
      }
      
      return await topic.value.subscribe(listener, options);
    } catch (error) {
      const subscribeError = EventHubError.create(
        UnifiedErrorCode.EVENT_PROCESSING_FAILED,
        'Failed to subscribe to topic',
        'subscribe',
        { topicName },
        undefined,
        error instanceof Error ? error : undefined
      );
      return Either.left(subscribeError);
    }
  }
  
  async unsubscribe(subscriptionId: string): Promise<Either<EventHubError, void>> {
    try {
      if (!this._connected) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.EVENTHUB_NOT_INITIALIZED,
          'Subscriber is not connected',
          'unsubscribe',
          { subscriptionId }
        ));
      }
      
      // Find the topic that contains this subscription
      const topics = this.topicManager.listTopics();
      
      for (const topicName of topics) {
        const topic = this.topicManager.getTopic(topicName);
        if (Maybe.isJust(topic)) {
          const result = await topic.value.unsubscribe(subscriptionId);
          if (Either.isRight(result)) {
            return result;
          }
        }
      }
      
      return Either.left(EventHubError.create(
        UnifiedErrorCode.RESOURCE_NOT_FOUND,
        `Subscription '${ subscriptionId }' not found`,
        'unsubscribe',
        { subscriptionId }
      ));
    } catch (error) {
      const unsubscribeError = EventHubError.create(
        UnifiedErrorCode.EVENT_PROCESSING_FAILED,
        'Failed to unsubscribe from topic',
        'unsubscribe',
        { subscriptionId },
        undefined,
        error instanceof Error ? error : undefined
      );
      return Either.left(unsubscribeError);
    }
  }
  
  async unsubscribeAll(topicName: string): Promise<Either<EventHubError, void>> {
    try {
      if (!this._connected) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.EVENTHUB_NOT_INITIALIZED,
          'Subscriber is not connected',
          'unsubscribeAll',
          { topicName }
        ));
      }
      
      const topic = this.topicManager.getTopic(topicName);
      if (Maybe.isNothing(topic)) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.RESOURCE_NOT_FOUND,
          `Topic '${ topicName }' not found`,
          'unsubscribeAll',
          { topicName }
        ));
      }
      
      // Get all subscriptions for this topic and unsubscribe them
      const subscriptions = topic.value.getSubscriptions();
      for (const subscription of subscriptions) {
        await topic.value.unsubscribe(subscription.id);
      }
      
      return Either.right(undefined as void);
    } catch (error) {
      const unsubscribeAllError = EventHubError.create(
        UnifiedErrorCode.EVENT_PROCESSING_FAILED,
        'Failed to unsubscribe all from topic',
        'unsubscribeAll',
        { topicName },
        undefined,
        error instanceof Error ? error : undefined
      );
      return Either.left(unsubscribeAllError);
    }
  }
  
  connect(): Either<EventHubError, void> {
    try {
      this._connected = true;
      return Either.right(undefined as void);
    } catch (error) {
      const connectError = EventHubError.create(
        UnifiedErrorCode.ADAPTER_CONNECTION_FAILED,
        'Failed to connect subscriber',
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
        'Failed to disconnect subscriber',
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
  
  getSubscriptions(topicName?: string): EventSubscription[] {
    try {
      if (topicName) {
        const topic = this.topicManager.getTopic(topicName);
        if (Maybe.isJust(topic)) {
          return topic.value.getSubscriptions();
        }
        return [];
      }
      
      // Get all subscriptions from all topics
      const allSubscriptions: EventSubscription[] = [];
      const topics = this.topicManager.listTopics();
      
      for (const topicName of topics) {
        const topic = this.topicManager.getTopic(topicName);
        if (Maybe.isJust(topic)) {
          allSubscriptions.push(...topic.value.getSubscriptions());
        }
      }
      
      return allSubscriptions;
    } catch (error) {
      // Return empty array on error instead of throwing
      return [];
    }
  }
}
