/**
 * @fileoverview Event Builder for EventHub
 *
 * This module provides a convenient builder pattern for creating Event objects
 * with sensible defaults and type safety. It eliminates the need to manually
 * construct event objects and handles default value assignment.
 *
 * @author
 * @version 1.0.0
 */

import {
  Event,
  EventPriority
} from './types';

/**
 * Configuration options for EventBuilder defaults
 */
export interface EventBuilderConfig {
  /** Default source for events */
  defaultSource?: string;
  /** Default priority for events */
  defaultPriority?: EventPriority;
  /** ID generation strategy */
  idGenerator?: () => string;
}

/**
 * Builder for creating Event objects with convenient defaults
 *
 * Usage Examples:
 * ```typescript
 * // Simple event
 * const event = EventBuilder
 *   .ofType('user.created')
 *   .withPayload({ userId: 123, name: 'John' })
 *   .build();
 *
 * // Event with custom priority and source
 * const urgentEvent = EventBuilder
 *   .ofType('system.alert')
 *   .withPayload({ message: 'System overload!' })
 *   .withPriority(EventPriority.HIGH)
 *   .fromSource('monitoring-service')
 *   .build();
 * ```
 */
export class EventBuilder<T = any> {
  private _id?: string;
  private _type?: string;
  private _timestamp?: Date;
  private _source?: string;
  private _priority?: EventPriority;
  private _payload?: T;
  private _correlationId?: string;
  private _metadata?: Record<string, any>;
  
  private static _config: EventBuilderConfig = {
    defaultSource: 'application',
    defaultPriority: EventPriority.NORMAL,
    idGenerator: () => `evt-${ Date.now() }-${ Math.random().toString(36).substring(2, 9) }`
  };
  
  private constructor() {}
  
  /**
   * Configure global defaults for EventBuilder
   */
  static configure(config: Partial<EventBuilderConfig>): void {
    EventBuilder._config = { ...EventBuilder._config, ...config };
  }
  
  /**
   * Start building an event of the specified type
   */
  static ofType<T = any>(type: string): EventBuilder<T> {
    const builder = new EventBuilder<T>();
    builder._type = type;
    return builder;
  }
  
  /**
   * Create a full Event object (for when you need the complete event structure)
   */
  static create<T>(
    type: string,
    payload: T,
    options?: {
      id?: string;
      source?: string;
      priority?: EventPriority;
      correlationId?: string;
      metadata?: Record<string, any>;
    }
  ): Event<T> {
    const builder = EventBuilder.ofType<T>(type).withPayload(payload);
    if (options?.id) {
      builder.withId(options.id);
    }
    if (options?.source) {
      builder.fromSource(options.source);
    }
    if (options?.priority) {
      builder.withPriority(options.priority);
    }
    if (options?.correlationId) {
      builder.withCorrelationId(options.correlationId);
    }
    if (options?.metadata) {
      builder.withMetadata(options.metadata);
    }
    
    return builder.build();
  }
  
  /**
   * Create payload for direct publishing (prevents double-wrapping)
   * Use this when publishing to EventHub topics/queues that handle event wrapping internally
   */
  static createPayload<T>(
    type: string,
    payload: T,
    options?: {
      id?: string;
      source?: string;
      priority?: EventPriority;
      correlationId?: string;
      metadata?: Record<string, any>;
    }
  ): T {
    // For direct publishing, just return the payload
    // The EventHub system will handle the event wrapping
    return payload;
  }
  
  /**
   * Set custom event ID
   */
  withId(id: string): EventBuilder<T> {
    this._id = id;
    return this;
  }
  
  /**
   * Set event payload
   */
  withPayload<U>(payload: U): EventBuilder<U> {
    const newBuilder = this as any as EventBuilder<U>;
    newBuilder._payload = payload;
    return newBuilder;
  }
  
  /**
   * Set event timestamp
   */
  withTimestamp(timestamp: Date): EventBuilder<T> {
    this._timestamp = timestamp;
    return this;
  }
  
  /**
   * Set event source
   */
  fromSource(source: string): EventBuilder<T> {
    this._source = source;
    return this;
  }
  
  /**
   * Set event priority
   */
  withPriority(priority: EventPriority): EventBuilder<T> {
    this._priority = priority;
    return this;
  }
  
  /**
   * Set correlation ID for tracing
   */
  withCorrelationId(correlationId: string): EventBuilder<T> {
    this._correlationId = correlationId;
    return this;
  }
  
  /**
   * Set event metadata
   */
  withMetadata(metadata: Record<string, any>): EventBuilder<T> {
    this._metadata = { ...this._metadata, ...metadata };
    return this;
  }
  
  /**
   * Add a single metadata entry
   */
  addMetadata(
    key: string,
    value: any
  ): EventBuilder<T> {
    if (!this._metadata) {
      this._metadata = {};
    }
    this._metadata[key] = value;
    return this;
  }
  
  /**
   * Set event as high priority (convenience method)
   */
  asHighPriority(): EventBuilder<T> {
    return this.withPriority(EventPriority.HIGH);
  }
  
  /**
   * Set event as medium priority (convenience method)
   */
  asMediumPriority(): EventBuilder<T> {
    return this.withPriority(EventPriority.NORMAL);
  }
  
  /**
   * Set event as low priority (convenience method)
   */
  asLowPriority(): EventBuilder<T> {
    return this.withPriority(EventPriority.LOW);
  }
  
  /**
   * Build the final Event object with defaults applied
   */
  build(): Event<T> {
    if (!this._type) {
      throw new Error('Event type is required. Use ofType() to set the event type.');
    }
    
    if (this._payload === undefined) {
      throw new Error('Event payload is required. Use withPayload() to set the payload.');
    }
    
    const event: Event<T> = {
      id: this._id ?? EventBuilder._config.idGenerator!(),
      type: this._type,
      timestamp: this._timestamp ?? new Date(),
      source: this._source ?? EventBuilder._config.defaultSource!,
      priority: this._priority ?? EventBuilder._config.defaultPriority!,
      data: this._payload,
      metadata: this._metadata ?? {}
    };
    
    // Only add correlationId if it was explicitly set
    if (this._correlationId !== undefined) {
      (event as any).correlationId = this._correlationId;
    }
    
    return event;
  }
  
  /**
   * Build and return a copy with different payload (convenience method)
   */
  buildWithPayload<U>(payload: U): Event<U> {
    return this.withPayload(payload).build();
  }
}

/**
 * Convenience functions for common event creation patterns
 */
export class EventFactory {
  
  /**
   * Create a simple event with type and payload
   */
  static create<T>(
    type: string,
    payload: T
  ): Event<T> {
    return EventBuilder.ofType<T>(type).withPayload(payload).build();
  }
  
  /**
   * Create a high priority event
   */
  static createHighPriority<T>(
    type: string,
    payload: T,
    source?: string
  ): Event<T> {
    const builder = EventBuilder.ofType<T>(type)
      .withPayload(payload)
      .asHighPriority();
    
    if (source) {
      builder.fromSource(source);
    }
    
    return builder.build();
  }
  
  /**
   * Create a low priority event
   */
  static createLowPriority<T>(
    type: string,
    payload: T,
    source?: string
  ): Event<T> {
    const builder = EventBuilder.ofType<T>(type)
      .withPayload(payload)
      .asLowPriority();
    
    if (source) {
      builder.fromSource(source);
    }
    
    return builder.build();
  }
  
  /**
   * Create an event with correlation ID for tracing
   */
  static createWithCorrelation<T>(
    type: string,
    payload: T,
    correlationId: string,
    source?: string
  ): Event<T> {
    const builder = EventBuilder.ofType<T>(type)
      .withPayload(payload)
      .withCorrelationId(correlationId);
    
    if (source) {
      builder.fromSource(source);
    }
    
    return builder.build();
  }
  
  /**
   * Configure default settings for all events
   */
  static configure(config: Partial<EventBuilderConfig>): void {
    EventBuilder.configure(config);
  }
}
