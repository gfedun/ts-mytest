/**
 * @fileoverview Heap-based Queue MessageBus Implementation
 *
 * This module provides a pure heap-based storage implementation for queue operations,
 * focusing solely on priority-ordered message storage and retrieval without business logic concerns.
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
import { QueueMessageBus } from '@/eventhub/queue/QueueMessageBus';
import { EventQueueConfig } from "@/eventhub/queue/types";
import { Event } from '@/eventhub/types';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Maybe } from '@/maybe';

/**
 * Heap-based implementation of QueueMessageBus with priority ordering
 *
 * This class provides pure storage operations using a heap-based priority queue
 * with FIFO ordering within the same priority level and event deduplication support.
 * It focuses solely on storage concerns and does not handle business logic such as
 * consumer management, metrics tracking, or acknowledgments.
 *
 * Features:
 * - Priority-based ordering using min-heap with custom comparator
 * - FIFO ordering within same priority level (timestamp-based)
 * - Event deduplication based on event ID
 * - Size limits and basic error handling
 * - Pure storage operations without side effects
 */
export class HeapQueueMessageBus
  extends QueueMessageBus {
  private _eventHeap: Heap<Event>;
  private _eventIds = new Set<string>();
  
  public readonly name: string;
  public readonly config: EventQueueConfig;
  
  constructor(config: EventQueueConfig) {
    super()
    this.config = config;
    this.name = config.name;
    
    // Configure heap with custom comparator for priority + timestamp ordering
    // Higher priority values come first, then older timestamps within same priority
    this._eventHeap = new Heap<Event>({
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
  }
  
  async enqueue(event: Event): Promise<Either<EventHubError, void>> {
    try {
      // Check queue size limit
      if (this.config.maxSize && this._eventHeap.size() >= this.config.maxSize) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.RESOURCE_UNAVAILABLE,
          `Queue '${ this.name }' is full (max size: ${ this.config.maxSize })`,
          'enqueue',
          {
            queueName: this.name,
            additionalData: {
              queueSize: this._eventHeap.size(),
              maxSize: this.config.maxSize
            }
          }
        ));
      }
      
      // Check for duplicates if deduplication is enabled
      if (this.config.enableDeduplication && this._eventIds.has(event.id)) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.RESOURCE_ALREADY_EXISTS,
          `Event '${ event.id }' already exists in queue '${ this.name }'`,
          'enqueue',
          { queueName: this.name, eventId: event.id }
        ));
      }
      
      // Add event to heap (will be ordered by priority + timestamp)
      this._eventHeap.add(event);
      
      if (this.config.enableDeduplication) {
        this._eventIds.add(event.id);
      }
      
      return Either.right(undefined as void);
    } catch (error) {
      return Either.left(EventHubError.create(
        UnifiedErrorCode.EVENT_PROCESSING_FAILED,
        'Failed to enqueue event',
        'enqueue',
        { queueName: this.name, eventId: event.id },
        undefined,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  async dequeue(): Promise<Maybe<Event>> {
    try {
      const eventMaybe = this._eventHeap.remove();
      
      if (Maybe.isJust(eventMaybe)) {
        const event = eventMaybe.value;
        
        if (this.config.enableDeduplication) {
          this._eventIds.delete(event.id);
        }
        
        return Maybe.just(event);
      }
      
      return Maybe.nothing();
    } catch (error) {
      console.error(`Failed to dequeue event from queue '${ this.name }':`, error);
      return Maybe.nothing();
    }
  }
  
  async peek(): Promise<Maybe<Event>> {
    return this._eventHeap.peek();
  }
  
  size(): number {
    return this._eventHeap.size();
  }
  
  isEmpty(): boolean {
    return this._eventHeap.isEmpty();
  }
  
  async clear(): Promise<void> {
    this._eventHeap.clear();
    this._eventIds.clear();
  }
}
