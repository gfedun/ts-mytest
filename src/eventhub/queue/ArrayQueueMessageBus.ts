/**
 * @fileoverview Array-based Queue MessageBus Implementation
 *
 * This module provides a pure array-based storage implementation for queue operations,
 * focusing solely on message storage and retrieval without business logic concerns.
 *
 * @author
 * @version 1.0.0
 */
import { Either } from '@/either';
import { EventHubError } from '@/eventhub/EventHubError';
import { QueueMessageBus } from '@/eventhub/queue/QueueMessageBus';
import { EventQueueConfig } from "@/eventhub/queue/types";
import { Event } from '@/eventhub/types';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Maybe } from '@/maybe';

/**
 * Array-based implementation of QueueMessageBus
 *
 * This class provides pure storage operations using an array-based FIFO queue
 * with priority ordering support and event deduplication. It focuses solely on
 * storage concerns and does not handle business logic such as consumer management,
 * metrics tracking, or acknowledgments.
 *
 * Features:
 * - Priority-based insertion with FIFO ordering within same priority
 * - Event deduplication based on event ID
 * - Size limits and basic error handling
 * - Pure storage operations without side effects
 */
export class ArrayQueueMessageBus
  extends QueueMessageBus {
  private _events: Event[] = [];
  private _eventIds = new Set<string>();
  
  public readonly name: string;
  public readonly config: EventQueueConfig;
  
  constructor(config: EventQueueConfig) {
    super()
    this.config = config;
    this.name = config.name;
  }
  
  async enqueue(event: Event): Promise<Either<EventHubError, void>> {
    try {
      // Check queue size limit
      if (this.config.maxSize && this._events.length >= this.config.maxSize) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.RESOURCE_UNAVAILABLE,
          `Queue '${ this.name }' is full (max size: ${ this.config.maxSize })`,
          'enqueue',
          {
            queueName: this.name,
            additionalData: {
              queueSize: this._events.length,
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
      
      // Insert event in priority order (High -> Medium -> Low, then by timestamp)
      this.insertInPriorityOrder(event);
      
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
  
  /**
   * Insert event in the correct position based on priority and timestamp
   * Priority: HIGH (2) -> MEDIUM (1) -> LOW (0)
   * Within same priority: Earlier timestamp first (FIFO)
   */
  private insertInPriorityOrder(event: Event): void {
    let insertIndex = 0;
    
    // Find the correct insertion position
    for (let i = 0; i < this._events.length; i++) {
      const current = this._events[i];
      
      // If current event has lower priority, insert before it
      if (current.priority < event.priority) {
        insertIndex = i;
        break;
      }
      
      // If same priority, check timestamp (FIFO within same priority)
      if (current.priority === event.priority) {
        if (current.timestamp > event.timestamp) {
          insertIndex = i;
          break;
        }
      }
      
      // If we reach here, current event has higher or equal priority
      // and earlier/equal timestamp, so continue searching
      insertIndex = i + 1;
    }
    
    // Insert at the found position
    this._events.splice(insertIndex, 0, event);
  }
  
  async dequeue(): Promise<Maybe<Event>> {
    try {
      if (this._events.length === 0) {
        return Maybe.nothing();
      }
      
      const event = this._events.shift()!;
      
      if (this.config.enableDeduplication) {
        this._eventIds.delete(event.id);
      }
      
      return Maybe.just(event);
    } catch (error) {
      console.error(`Failed to dequeue event from queue '${ this.name }':`, error);
      return Maybe.nothing();
    }
  }
  
  async peek(): Promise<Maybe<Event>> {
    if (this._events.length === 0) {
      return Maybe.nothing();
    }
    return Maybe.just(this._events[0]);
  }
  
  size(): number {
    return this._events.length;
  }
  
  isEmpty(): boolean {
    return this._events.length === 0;
  }
  
  async clear(): Promise<void> {
    this._events = [];
    this._eventIds.clear();
  }
}
