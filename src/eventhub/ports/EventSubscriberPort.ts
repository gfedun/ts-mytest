/**
 * @fileoverview Event Subscriber Port Interface
 *
 * This module defines the port interface for subscribing to events from external systems.
 * This is part of the hexagonal architecture where ports define what the core
 * application expects from external integrations.
 *
 * @author
 * @version 1.0.0
 */

import { Either } from '@/either';
import { EventHubError } from '@/eventhub/EventHubError';
import { EventListener } from '../types';

/**
 * Port for subscribing to events from external systems
 */
export interface EventSubscriberPort {
  /** Port name for identification */
  readonly name: string;
  
  /** Port type identifier */
  readonly type: string;
  
  /**
   * Subscribe to events from the external system
   * @param handler The event handler function
   * @returns Either EventHubError or void on success
   */
  subscribe<T>(handler: EventListener<T>): Promise<Either<EventHubError, void>>;
  
  /**
   * Unsubscribe from events
   * @returns Either EventHubError or void on success
   */
  unsubscribe(): Promise<Either<EventHubError, void>>;
  
  /**
   * Check if the port is currently subscribed to events
   * @returns Either EventHubError or boolean indicating subscription status
   */
  isSubscribed(): Promise<Either<EventHubError, boolean>>;
  
  /**
   * Check if the port is ready to receive events
   * @returns Either EventHubError or boolean indicating readiness
   */
  isReady(): Promise<Either<EventHubError, boolean>>;
}
