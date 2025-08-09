/**
 * @fileoverview Heap-based Topic MessageBus Implementation
 *
 * This module provides a pure heap-based storage implementation for topic operations,
 * focusing solely on message storage and retrieval without business logic concerns.
 *
 * @author
 * @version 1.0.0
 */
import {
  Heap,
  HeapOrder
} from '@/collections/Heap';
import { Either } from '@/either';
import { EventHubError } from '@/eventhub/EventHubError';
import { EventQueueConfig } from "@/eventhub/queue/types";
import { TopicMessageBus } from '@/eventhub/topic/TopicMessageBus';
import { Event } from '@/eventhub/types';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Maybe } from '@/maybe';

/**
 * Heap-based implementation of TopicMessageBus
 *
 * This class provides pure storage operations using a heap-based priority queue
 * with FIFO ordering support and message retention. It focuses solely on
 * storage concerns and does not handle business logic such as subscriber management,
 * metrics tracking, or message delivery.
 *
 * Features:
 * - Priority-based ordering with FIFO within same priority using min-heap
 * - Message retention with automatic cleanup
 * - Size limits and basic error handling
 * - Pure storage operations without side effects
 */
export class HeapTopicMessageBus
  extends TopicMessageBus {
  private messageHeap: Heap<Event>;
  private retentionTimer: NodeJS.Timeout | undefined;
  
  public readonly name: string;
  public readonly config: EventQueueConfig;
  
  constructor(config: EventQueueConfig) {
    super()
    this.config = config;
    this.name = config.name;
    
    // Configure heap with custom comparator for priority + timestamp ordering
    // Higher priority values come first, then older timestamps within same priority
    this.messageHeap = new Heap<Event>({
      order: HeapOrder.MIN,
      compareFn: (
        a: Event,
        b: Event
      ) => {
        // Primary sort: Higher priority first (HIGH=2, MEDIUM=1, LOW=0)
        // Negate to get higher priority first in min-heap
        const priorityDiff = b.priority - a.priority;
        if (priorityDiff !== 0) {
          return priorityDiff;
        }
        
        // Secondary sort: Earlier timestamp first (FIFO within same priority)
        return a.timestamp.getTime() - b.timestamp.getTime();
      }
    });
    
    this.startRetentionCleaner();
  }
  
  async enqueue(message: Event): Promise<Either<EventHubError, void>> {
    try {
      // Check queue size limit
      if (this.config.maxSize && this.messageHeap.size() >= this.config.maxSize) {
        return Either.left(
          EventHubError.create(
            UnifiedErrorCode.RESOURCE_UNAVAILABLE,
            `Queue for topic '${ this.name }' has reached maximum size of ${ this.config.maxSize }`,
            'enqueue',
            {
              topicName: this.name,
              additionalData: {
                queueSize: this.messageHeap.size(),
                maxSize: this.config.maxSize
              }
            }
          )
        );
      }
      
      // Add message to the heap (will be ordered by priority and timestamp)
      this.messageHeap.add(message);
      
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
    if (this.messageHeap.isEmpty()) {
      return Maybe.nothing();
    }
    
    return this.messageHeap.remove();
  }
  
  async peek(): Promise<Maybe<Event>> {
    if (this.messageHeap.isEmpty()) {
      return Maybe.nothing();
    }
    
    return this.messageHeap.peek();
  }
  
  size(): number {
    return this.messageHeap.size();
  }
  
  isEmpty(): boolean {
    return this.messageHeap.isEmpty();
  }
  
  async clear(): Promise<void> {
    this.messageHeap.clear();
  }
  
  getAllMessages(): readonly Event[] {
    return this.messageHeap.toArray();
  }
  
  destroy(): void {
    if (this.retentionTimer) {
      clearInterval(this.retentionTimer);
      this.retentionTimer = undefined;
    }
    this.messageHeap.clear();
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
    
    // Extract all messages, filter expired ones, and re-add valid ones
    const allMessages = this.messageHeap.toArray();
    this.messageHeap.clear();
    
    // Re-add non-expired messages back to the heap
    allMessages
      .filter(message => message.timestamp.getTime() > cutoffTime)
      .forEach(message => this.messageHeap.add(message));
  }
}
