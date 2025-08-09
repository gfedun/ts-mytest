/**
 * @fileoverview Queue MessageBus Interface
 *
 * This module defines the interface for pure queue storage operations,
 * separating storage concerns from business logic in the EventHub architecture.
 *
 * @author
 * @version 1.0.0
 */
import { Either } from '@/either';
import { QueueError } from "@/eventhub";
import { EventQueueConfig } from "@/eventhub/queue/types";
import { Maybe } from '@/maybe';
import { Event } from '../types';

/**
 * Pure queue message bus interface for storage operations only.
 *
 * This interface defines the contract for queue storage implementations
 * that handle pure message routing and storage without business logic
 * such as consumer management, metrics tracking, or acknowledgments.
 *
 * Implementations should focus solely on:
 * - Message storage and retrieval (enqueue/dequeue/peek)
 * - Queue state management (size/isEmpty/clear)
 * - Configuration access
 *
 * Business logic such as consumer management, metrics, and acknowledgments
 * should be handled by higher-level components (e.g., QueueImpl).
 */
export abstract class QueueMessageBus {
  /**
   * Add an event to the queue
   * @param event The event to enqueue
   * @returns Either Error or void on success
   */
  abstract enqueue(event: Event): Promise<Either<QueueError, void>>;
  
  /**
   * Remove and return the next event from the queue
   * @returns Maybe containing the next event, or nothing if queue is empty
   */
  abstract dequeue(): Promise<Maybe<Event>>;
  
  /**
   * Look at the next event without removing it from the queue
   * @returns Maybe containing the next event, or nothing if queue is empty
   */
  abstract peek(): Promise<Maybe<Event>>;
  
  /**
   * Get the current number of events in the queue
   * @returns Current queue size
   */
  abstract size(): number;
  
  /**
   * Check if the queue contains no events
   * @returns True if queue is empty, false otherwise
   */
  abstract isEmpty(): boolean;
  
  /**
   * Remove all events from the queue
   * @returns Promise that resolves when queue is cleared
   */
  abstract clear(): Promise<void>;
  
  /**
   * Queue configuration
   */
  abstract readonly config: EventQueueConfig;
  
  /**
   * Queue name identifier
   */
  abstract readonly name: string;
}

