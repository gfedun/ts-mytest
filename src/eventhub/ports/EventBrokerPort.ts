/**
 * @fileoverview Event Broker Port Interface
 *
 * This module defines the port interface for external message brokers.
 * This is part of the hexagonal architecture where ports define what the core
 * application expects from external integrations.
 *
 * @author
 * @version 1.0.0
 */

import { Either } from '@/either';
import { EventHubError } from '@/eventhub/EventHubError';
import {
  Event,
  EventListener
} from '../types';

/**
 * Port for connecting to external message brokers
 */
export interface EventBrokerPort {
  /** Port name for identification */
  readonly name: string;
  
  /** Port type identifier */
  readonly type: string;
  
  /**
   * Connect to the external broker
   * @returns Either EventHubError or void on success
   */
  connect(): Promise<Either<EventHubError, void>>;
  
  /**
   * Disconnect from the external broker
   * @returns Either EventHubError or void on success
   */
  disconnect(): Promise<Either<EventHubError, void>>;
  
  /**
   * Publish an event to the broker
   * @param event The event to publish
   * @returns Either EventHubError or void on success
   */
  publish<T>(event: Event<T>): Promise<Either<EventHubError, void>>;
  
  /**
   * Subscribe to events from the broker
   * @param handler The event handler function
   * @returns Either EventHubError or void on success
   */
  subscribe<T>(handler: EventListener<T>): Promise<Either<EventHubError, void>>;
  
  /**
   * Check if the port is connected and ready
   * @returns Either EventHubError or boolean indicating readiness
   */
  isReady(): Promise<Either<EventHubError, boolean>>;
}
