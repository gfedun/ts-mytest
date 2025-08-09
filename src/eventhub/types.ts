/**
 * @fileoverview EventHub Core Types
 *
 * This module contains the foundational types and interfaces for the EventHub
 * system that manages centralized event routing, distribution, and external
 * message broker integration through outlets and adapters.
 *
 * @author
 * @version 1.0.0
 */

import { Either } from '@/either';
import { EventHubError } from './EventHubError';

/**
 * Event priority levels for queue ordering
 */
export enum EventPriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2
}

/**
 * Base event interface that all events must implement
 */
export interface BaseEvent {
  /** Unique event identifier */
  readonly id: string;
  /** Event type/name */
  readonly type: string;
  /** Event priority for queue ordering */
  readonly priority: EventPriority;
  /** Event creation timestamp */
  readonly timestamp: Date;
  /** Event metadata */
  readonly metadata?: Record<string, any>;
  /** Correlation ID for request/response patterns */
  readonly correlationId?: string;
  /** Source system or component that created the event */
  readonly source?: string;
  /** Event version for schema evolution */
  readonly version?: string;
}

/**
 * Generic event interface that extends BaseEvent with payload
 */
export interface Event<T = any>
  extends BaseEvent {
  /** Event payload data */
  readonly data: T;
}

/**
 * Event listener function type
 */
export type EventListener<T = any> = (event: Event<T>) => void | Promise<void>;

/**
 * Event Adapter interface for external system integration
 */
export interface EventAdapter {
  /** Adapter name */
  readonly name: string;
  /** Connect to external system */
  connect(): Promise<Either<EventHubError, void>>;
  /** Disconnect from external system */
  disconnect(): Promise<Either<EventHubError, void>>;
  /** Check connection status */
  isConnected(): boolean;
  /** Send event to external system */
  send<T>(event: Event<T>): Promise<Either<EventHubError, void>>;
  /** Receive events from external system */
  receive<T>(): Promise<Either<EventHubError, Event<T>[]>>;
}

/**
 * EventHub Configuration interface
 */
export interface EventHubConfig {
  /** Enable metrics collection */
  enableMetrics: boolean;
  /** Event timeout in milliseconds */
  eventTimeoutMs: number;
}

/**
 * EventHub Metrics interface
 */
export interface EventHubMetrics {
  /** Number of active subscriptions */
  activeSubscriptions: number;
  /** Number of active topics */
  activeTopics: number;
  /** Average processing time in milliseconds */
  avgProcessingTimeMs: number;
  /** EventHub uptime in milliseconds */
  uptimeMs: number;
}

