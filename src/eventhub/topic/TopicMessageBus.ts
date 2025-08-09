/**
 * @fileoverview Topic MessageBus Interface
 *
 * This module defines the interface for pure topic storage operations,
 * separating storage concerns from business logic in the EventHub architecture.
 *
 * @author
 * @version 1.0.0
 */
import { Either } from '@/either';
import { TopicError } from "@/eventhub";
import { EventQueueConfig } from "@/eventhub/queue/types";
import { Maybe } from '@/maybe';
import { Event } from '../types';

/**
 * Pure topic message bus interface for storage operations only.
 *
 * This interface defines the contract for topic storage implementations
 * that handle pure message routing and storage without business logic
 * such as subscriber management, metrics tracking, or acknowledgments.
 *
 * Implementations should focus solely on:
 * - Message storage and retrieval (enqueue/dequeue/peek)
 * - Topic state management (size/isEmpty/clear)
 * - Configuration access
 * - Message retention and cleanup
 *
 * Business logic such as subscriber management, metrics, and message delivery
 * should be handled by higher-level components (e.g., TopicImpl).
 */
export abstract class TopicMessageBus {
  /**
   * Add a message to the topic queue
   * @param message The message to enqueue
   * @returns Either Error or void on success
   */
  abstract enqueue(message: Event): Promise<Either<TopicError, void>>;
  
  /**
   * Remove and return the next message from the topic queue
   * @returns Maybe containing the next message, or nothing if queue is empty
   */
  abstract dequeue(): Promise<Maybe<Event>>;
  
  /**
   * Look at the next message without removing it from the topic queue
   * @returns Maybe containing the next message, or nothing if queue is empty
   */
  abstract peek(): Promise<Maybe<Event>>;
  
  /**
   * Get the current number of messages in the topic queue
   * @returns Current queue size
   */
  abstract size(): number;
  
  /**
   * Check if the topic queue is empty
   * @returns True if queue has no messages
   */
  abstract isEmpty(): boolean;
  
  /**
   * Clear all messages from the topic queue
   * @returns Promise that resolves when clearing is complete
   */
  abstract clear(): Promise<void>;
  
  /**
   * Get all messages (for debugging/inspection)
   * @returns Read-only array of all messages
   */
  abstract getAllMessages(): readonly Event[];
  
  /**
   * Clean up resources and stop any background processes
   */
  abstract destroy(): void;
  
  /**
   * Topic name
   */
  abstract readonly name: string;
  
  /**
   * Topic configuration
   */
  abstract readonly config: EventQueueConfig;
}
