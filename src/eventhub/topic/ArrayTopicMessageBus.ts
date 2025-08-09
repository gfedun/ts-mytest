/**
 * @fileoverview Array-based Topic MessageBus Implementation
 *
 * This module provides a pure array-based storage implementation for topic operations,
 * focusing solely on message storage and retrieval without business logic concerns.
 *
 * @author
 * @version 1.0.0
 */
import { Either } from '@/either';
import { EventHubError } from '@/eventhub/EventHubError';
import { EventQueueConfig } from "@/eventhub/queue/types";
import { TopicMessageBus } from '@/eventhub/topic/TopicMessageBus';
import { Event } from '@/eventhub/types';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Maybe } from '@/maybe';

/**
 * Array-based implementation of TopicMessageBus
 *
 * This class provides pure storage operations using an array-based FIFO queue
 * with priority ordering support and message retention. It focuses solely on
 * storage concerns and does not handle business logic such as subscriber management,
 * metrics tracking, or message delivery.
 *
 * Features:
 * - Priority-based insertion with FIFO ordering within same priority
 * - Message retention with automatic cleanup
 * - Size limits and basic error handling
 * - Pure storage operations without side effects
 */
export class ArrayTopicMessageBus
  extends TopicMessageBus {
  private messages: Event[] = [];
  private retentionTimer: NodeJS.Timeout | undefined;
  
  public readonly name: string;
  public readonly config: EventQueueConfig;
  
  constructor(config: EventQueueConfig) {
    super();
    this.config = config;
    this.name = config.name;
    this.startRetentionCleaner();
  }
  
  async enqueue(message: Event): Promise<Either<EventHubError, void>> {
    try {
      // Check queue size limit
      if (this.config.maxSize && this.messages.length >= this.config.maxSize) {
        return Either.left(
          EventHubError.create(
            UnifiedErrorCode.RESOURCE_UNAVAILABLE,
            `Queue for topic '${ this.name }' has reached maximum size of ${ this.config.maxSize }`,
            'enqueue',
            {
              topicName: this.name,
              additionalData: {
                queueSize: this.messages.length,
                maxSize: this.config.maxSize
              }
            }
          )
        );
      }
      
      // Insert message in priority order (High -> Medium -> Low, then by timestamp)
      this.insertInPriorityOrder(message);
      
      return Either.right(undefined as void);
    } catch (error) {
      return Either.left(
        EventHubError.create(
          UnifiedErrorCode.EVENT_PROCESSING_FAILED,
          `Failed to enqueue message: ${ error instanceof Error ? error.message : String(error) }`,
          'enqueue',
          { topicName: this.name },
          undefined,
          error instanceof Error ? error : undefined
        )
      );
    }
  }
  
  async dequeue(): Promise<Maybe<Event>> {
    if (this.messages.length === 0) {
      return Maybe.nothing();
    }
    
    const message = this.messages.shift();
    return message ? Maybe.just(message) : Maybe.nothing();
  }
  
  async peek(): Promise<Maybe<Event>> {
    if (this.messages.length === 0) {
      return Maybe.nothing();
    }
    
    return Maybe.just(this.messages[0]);
  }
  
  size(): number {
    return this.messages.length;
  }
  
  isEmpty(): boolean {
    return this.messages.length === 0;
  }
  
  async clear(): Promise<void> {
    this.messages = [];
  }
  
  getAllMessages(): readonly Event[] {
    return [...this.messages];
  }
  
  destroy(): void {
    if (this.retentionTimer) {
      clearInterval(this.retentionTimer);
      this.retentionTimer = undefined;
    }
    this.messages = [];
  }
  
  /**
   * Insert message in the correct position based on priority and timestamp
   * Priority: HIGH (2) -> MEDIUM (1) -> LOW (0)
   * Within same priority: Earlier timestamp first (FIFO)
   */
  private insertInPriorityOrder(message: Event): void {
    let insertIndex = 0;
    
    // Find the correct insertion position
    for (let i = 0; i < this.messages.length; i++) {
      const current = this.messages[i];
      
      // If current message has lower priority, insert before it
      if (current.priority < message.priority) {
        insertIndex = i;
        break;
      }
      
      // If same priority, check timestamp (FIFO within same priority)
      if (current.priority === message.priority) {
        if (current.timestamp > message.timestamp) {
          insertIndex = i;
          break;
        }
      }
      
      // If we reach here, current message has higher or equal priority
      // and earlier/equal timestamp, so continue searching
      insertIndex = i + 1;
    }
    
    // Insert at the found position
    this.messages.splice(insertIndex, 0, message);
  }
  
  /**
   * Start the retention cleaner that removes old messages
   */
  private startRetentionCleaner(): void {
    // Default retention is 24 hours
    const retentionMs = 24 * 60 * 60 * 1000;
    
    // Clean up expired messages every hour
    this.retentionTimer = setInterval(() => {
      this.cleanupExpiredMessages(retentionMs);
    }, 60 * 60 * 1000); // 1 hour
  }
  
  /**
   * Remove messages older than the retention period
   */
  private cleanupExpiredMessages(retentionMs: number): void {
    const now = Date.now();
    const cutoffTime = now - retentionMs;
    
    // Remove messages older than cutoff time
    this.messages = this.messages.filter(message =>
      message.timestamp.getTime() > cutoffTime
    );
  }
}
