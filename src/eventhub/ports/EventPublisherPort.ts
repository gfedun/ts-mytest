/**
 * @fileoverview Event Publisher Port Interface
 *
 * This module defines the port interface for publishing events to external systems.
 * This is part of the hexagonal architecture where ports define what the core
 * application expects from external integrations.
 *
 * @author
 * @version 1.0.0
 */

import { Either } from '@/either';
import { EventHubError } from '@/eventhub/EventHubError';
import { Event } from '../types';

/**
 * Port for publishing events to external systems
 */
export interface EventPublisherPort {
  /** Port name for identification */
  readonly name: string;
  
  /** Port type identifier */
  readonly type: string;
  
  /**
   * Publish an event to the external system
   * @param event The event to publish
   * @returns Either EventHubError or void on success
   */
  publish<T>(event: Event<T>): Promise<Either<EventHubError, void>>;
  
  /**
   * Publish a batch of events to the external system
   * @param events The events to publish
   * @returns Either EventHubError or void on success
   */
  publishBatch<T>(events: Event<T>[]): Promise<Either<EventHubError, void>>;
  
  /**
   * Check if the port is ready to publish events
   * @returns Either EventHubError or boolean indicating readiness
   */
  isReady(): Promise<Either<EventHubError, boolean>>;
}
