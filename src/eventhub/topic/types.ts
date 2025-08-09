import {
  Event,
  EventListener
} from "@/eventhub";
import { EventPriority } from "@/eventhub/types";

/**
 * Subscription options for event listeners
 */
export interface SubscriptionOptions {
  /** Filter predicate for events */
  filter?: (event: Event) => boolean;
  /** Maximum retry attempts */
  maxRetries?: number;
  /** Retry delay in milliseconds */
  retryDelay?: number;
  /** Priority for subscription processing */
  priority?: EventPriority;
}

/**
 * Topic configuration interface
 */
export interface TopicConfig {
  /** Topic name */
  name: string;
  /** Maximum message queue size */
  maxSize?: number;
  /** Whether to persist messages */
  persistent?: boolean;
  /** Enable priority queue ordering */
  priorityQueue?: boolean;
  /** Topic metadata */
  metadata?: Record<string, any>;
}

/**
 * Topic metrics interface
 */
export interface TopicMetrics {
  /** Topic name */
  topicName: string;
  /** Number of messages published */
  messagesPublished: number;
  /** Number of messages consumed/delivered */
  messagesConsumed: number;
  /** Number of messages currently in the queue */
  messagesInQueue: number;
  /** Number of active subscribers */
  subscribersCount: number;
  /** Number of failed messages */
  failedMessages: number;
  /** Average processing time in milliseconds */
  avgProcessingTimeMs: number;
  /** Last activity timestamp */
  lastActivity: Date;
}

/**
 * Event subscription interface
 */
export interface EventSubscription {
  /** Unique subscription identifier */
  readonly id: string;
  /** Topic name this subscription is bound to */
  readonly topicName: string;
  /** Event listener function */
  readonly listener: EventListener;
  /** Subscription options */
  readonly options?: SubscriptionOptions;
  /** Subscription creation timestamp */
  readonly createdAt: Date;
  /** Whether subscription is active */
  readonly active: boolean;
}

/**
 * Subscriber information stored for each registered subscriber
 */
export interface SubscriberInfo {
  /** Unique subscriber identifier */
  readonly id: string;
  /** Event listener function */
  readonly listener: EventListener;
  /** Subscription options */
  readonly options: SubscriptionOptions;
  /** Registration timestamp */
  readonly registeredAt: Date;
  /** Whether the subscriber is currently active */
  active: boolean;
  /** Number of messages processed by this subscriber */
  messagesProcessed: number;
  /** Number of failed messages for this subscriber */
  messagesFailed: number;
  /** Retry count for failed messages */
  retryCount: number;
}
