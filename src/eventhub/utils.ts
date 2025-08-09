/**
 * @fileoverview EventHub Utility Functions
 *
 * This module provides utility functions for creating events, generating IDs,
 * and other common EventHub operations.
 *
 * @author
 * @version 1.0.0
 */

import {
  BaseEvent,
  Event,
  EventPriority,
} from './types';

/**
 * Create a new event with generated ID and timestamp
 * Use this when you need a complete Event object
 */
export function createEvent<T = any>(
  type: string,
  payload: T,
  source: string,
  priority: EventPriority = EventPriority.NORMAL,
  options: {
    id?: string;
    correlationId?: string;
    metadata?: Record<string, any>;
    timestamp?: Date;
  } = {}
): Event<T> {
  const event: Event<T> = {
    id: options.id || generateEventId(),
    type,
    data: payload,
    priority,
    source,
    timestamp: options.timestamp || new Date()
  };
  
  if (options.correlationId) {
    (event as any).correlationId = options.correlationId;
  }
  
  if (options.metadata) {
    (event as any).metadata = options.metadata;
  }
  
  return event;
}

/**
 * Create event payload directly without wrapping
 * Use this when the EventHub will handle event wrapping internally
 */
export function createEventPayload<T = any>(
  type: string,
  payload: T,
  source?: string,
  priority?: EventPriority,
  options?: {
    id?: string;
    correlationId?: string;
    metadata?: Record<string, any>;
    timestamp?: Date;
  }
): T {
  // For direct payload creation, just return the payload
  // The consuming system (EventHub, Topic, Queue) will handle event wrapping
  return payload;
}

/**
 * Create a base event without payload
 */
export function createBaseEvent(
  type: string,
  source: string,
  priority: EventPriority,
  options: {
    id?: string;
    correlationId?: string;
    metadata?: Record<string, any>;
    timestamp?: Date;
  } = {}
): BaseEvent {
  const event: BaseEvent = {
    id: options.id || generateEventId(),
    type,
    source,
    priority,
    timestamp: options.timestamp || new Date()
  };
  
  if (options.correlationId) {
    (event as any).correlationId = options.correlationId;
  }
  
  if (options.metadata) {
    (event as any).metadata = options.metadata;
  }
  
  return event;
}

/**
 * Generate a unique event ID
 */
export function generateEventId(): string {
  return `evt_${ Date.now() }_${ Math.random().toString(36).substring(2, 9) }`;
}

/**
 * Generate a correlation ID for event tracing
 */
export function generateCorrelationId(): string {
  return `corr_${ Date.now() }_${ Math.random().toString(36).substring(2, 9) }`;
}

/**
 * Check if an object is a valid event
 */
export function isValidEvent(obj: any): obj is Event {
  return obj &&
    typeof obj === 'object' &&
    typeof obj.id === 'string' &&
    typeof obj.type === 'string' &&
    obj.timestamp instanceof Date &&
    typeof obj.source === 'string' &&
    obj.data !== undefined;
}

/**
 * Clone an event with optional modifications
 */
export function cloneEvent<T = any>(
  event: Event<T>,
  modifications: Partial<Event<T>> = {}
): Event<T> {
  return {
    ...event,
    ...modifications,
    metadata: {
      ...event.metadata,
      ...modifications.metadata
    }
  };
}

/**
 * Create a reply event from an original event
 */
export function createReplyEvent<T = any>(
  originalEvent: Event,
  replyPayload: T,
  source: string,
  priority: EventPriority
): Event<T> {
  return createEvent(
    `${ originalEvent.type }.reply`,
    replyPayload,
    source,
    priority,
    {
      correlationId: originalEvent.correlationId || originalEvent.id,
      metadata: {
        originalEventId: originalEvent.id,
        originalEventType: originalEvent.type,
        replyTo: originalEvent.source
      }
    }
  );
}

/**
 * Create an error event from a failed event
 */
export function createErrorEvent(
  originalEvent: Event,
  error: Error | string,
  source: string,
  priority: EventPriority
): Event<{ error: string; originalEvent: Event }> {
  const errorMessage = error instanceof Error ? error.message : error;
  
  return createEvent(
    `${ originalEvent.type }.error`,
    {
      error: errorMessage,
      originalEvent: originalEvent
    },
    source,
    priority,
    {
      correlationId: originalEvent.correlationId || originalEvent.id,
      metadata: {
        originalEventId: originalEvent.id,
        originalEventType: originalEvent.type,
        errorSource: source,
        errorTimestamp: new Date().toISOString()
      }
    }
  );
}

/**
 * Extract event metadata safely
 */
export function getEventMetadata(
  event: Event,
  key: string,
  defaultValue?: any
): any {
  return event.metadata?.[key] ?? defaultValue;
}

/**
 * Check if event matches a filter
 */
export function matchesEventFilter(
  event: Event,
  filter: {
    type?: string | RegExp;
    source?: string | RegExp;
    metadata?: Record<string, any>;
  }
): boolean {
  // Check type filter
  if (filter.type) {
    if (filter.type instanceof RegExp) {
      if (!filter.type.test(event.type)) return false;
    } else {
      if (event.type !== filter.type) return false;
    }
  }
  
  // Check source filter
  if (filter.source) {
    if (filter.source instanceof RegExp) {
      if (!event.source || !filter.source.test(event.source)) {
        return false;
      }
    } else {
      if (event.source !== filter.source) {
        return false;
      }
    }
  }
  
  // Check metadata filters
  if (filter.metadata) {
    for (const [key, value] of Object.entries(filter.metadata)) {
      if (getEventMetadata(event, key) !== value) return false;
    }
  }
  
  return true;
}

/**
 * Event type constants for common events
 */
export const EventTypes = {
  // System events
  SYSTEM_STARTUP: 'system.startup',
  SYSTEM_SHUTDOWN: 'system.shutdown',
  SYSTEM_ERROR: 'system.error',
  
  // User events
  USER_CREATED: 'user.created',
  USER_UPDATED: 'user.updated',
  USER_DELETED: 'user.deleted',
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  
  // Application events
  APP_INITIALIZED: 'app.initialized',
  APP_READY: 'app.ready',
  APP_ERROR: 'app.error',
  
  // Data events
  DATA_CREATED: 'data.created',
  DATA_UPDATED: 'data.updated',
  DATA_DELETED: 'data.deleted',
  
  // Message events
  MESSAGE_SENT: 'message.sent',
  MESSAGE_RECEIVED: 'message.received',
  MESSAGE_FAILED: 'message.failed'
} as const;

// /**
//  * Event priority levels
//  */
// export const EventPriority = {
//   CRITICAL: 1000,
//   HIGH: 800,
//   NORMAL: 500,
//   LOW: 200,
//   BACKGROUND: 100
// } as const;
