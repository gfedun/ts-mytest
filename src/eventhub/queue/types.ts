import { EventPriority } from "@/eventhub/types";

/**
 * Queue configuration interface
 */
export interface QueueConfig {
  /** Queue name */
  name: string;
  /** Maximum queue size */
  maxQueueSize?: number;
  /** Whether to persist messages */
  persistent?: boolean;
  /** Storage type for the queue */
  storageType?: 'array' | 'heap';
  /** Queue metadata */
  metadata?: Record<string, any>;
}

/**
 * Event Queue Configuration for legacy compatibility
 */
export interface EventQueueConfig {
  /** Queue name */
  name: string;
  /** Maximum queue size */
  maxSize: number;
  /** Whether to persist messages */
  persistent: boolean;
  /** Enable deduplication */
  enableDeduplication?: boolean;
}

/**
 * Queue metrics interface for tracking queue performance and usage
 */
export interface QueueMetrics {
  /** Queue name */
  queueName: string;
  /** Number of messages sent to the queue */
  messagesSent: number;
  /** Number of messages received from the queue */
  messagesReceived: number;
  /** Number of messages currently in the queue */
  messagesInQueue: number;
  /** Number of active consumers */
  activeConsumers: number;
  /** Number of failed messages */
  failedMessages: number;
  /** Average processing time in milliseconds */
  avgProcessingTimeMs: number;
  /** Last activity timestamp */
  lastActivity: Date;
  /** Number of pending acknowledgments */
  pendingAcknowledgments: number;
}

/**
 * Options for receiving messages from a queue
 */
export interface ReceiveOptions {
  /** Timeout in milliseconds for receive operation */
  timeout?: number;
  /** Maximum number of messages to receive */
  maxMessages?: number;
  /** Whether to acknowledge messages automatically */
  autoAck?: boolean;
}

/**
 * Represents a received message with metadata
 */
export interface ReceivedMessage<T> {
  /** Message ID */
  id: string;
  /** Message payload */
  data: T;
  /** Message priority */
  priority: EventPriority;
  /** Timestamp when message was received */
  receivedAt: Date;
  /** Whether the message requires explicit acknowledgment */
  requiresAck: boolean;
  /** Acknowledge the message as successfully processed */
  ack: () => void;
  /** Negative acknowledge - reject the message */
  nack: (reason?: string) => void;
  /** Message metadata */
  metadata?: Record<string, any>;
}

// export interface ReceivedMessage<T> {
//   /** Message ID */
//   id: string;
//   /** Message payload */
//   message: T;
//   /** Original event */
//   event: Event<T>;
//   /** Timestamp when message was received */
//   receivedAt: Date;
//   /** Number of delivery attempts */
//   deliveryCount: number;
//   /** Whether the message requires explicit acknowledgment */
//   requiresAck: boolean;
//   /** Acknowledge the message as successfully processed */
//   ack: () => void;
//   /** Negative acknowledge - reject the message */
//   nack: (reason?: string) => void;
// }

/**
 * Consumer options for queue message processing
 */
export interface ConsumeOptions {
  /** Maximum retry attempts for failed messages */
  maxRetries?: number;
  /** Delay between retries in milliseconds */
  retryDelay?: number;
  /** Whether to maintain message ordering */
  maintainOrder?: boolean;
  /** Consumer priority */
  priority?: EventPriority;
  /** Auto-acknowledge messages after successful processing */
  autoAck?: boolean;
}

/**
 * Message handler function type
 */
export type MessageHandler<T> = (message: ReceivedMessage<T>) => void | Promise<void>;

/**
 * Consumer information stored for each registered consumer
 */
export interface ConsumerInfo<T> {
  /** Unique consumer identifier */
  readonly id: string;
  /** Message handler function */
  readonly handler: MessageHandler<T>;
  /** Consumer options */
  readonly options: ConsumeOptions;
  /** Registration timestamp */
  readonly registeredAt: Date;
  /** Whether the consumer is currently active */
  active: boolean;
  /** Number of messages processed by this consumer */
  messagesProcessed: number;
  /** Number of failed messages for this consumer */
  messagesFailed: number;
}
