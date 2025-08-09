/**
 * @fileoverview Abstract Event Broker Adapter
 *
 * This module provides a base implementation for EventBrokerPort adapters,
 * containing common functionality and patterns that can be reused across
 * different broker implementations.
 *
 * @author
 * @version 1.0.0
 */

import { Either } from '@/either';
import { EventHubError } from '@/eventhub/EventHubError';
import {
  EventBrokerConfig,
  EventBrokerMetrics
} from "@/eventhub/ports/types";
import {
  Event,
  EventListener
} from "@/eventhub/types";
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { EventBrokerPort } from '../EventBrokerPort';

/**
 * Abstract base class for Event Broker Adapters
 *
 * Provides common functionality and patterns that can be reused across
 * different broker implementations like Redis, Azure Service Bus, etc.
 */
export abstract class AbstractEventBrokerAdapter
  implements EventBrokerPort {
  protected connected = false;
  protected subscribed = false;
  protected eventHandler?: EventListener | undefined;
  protected metrics: EventBrokerMetrics;
  
  protected constructor(
    public readonly name: string,
    public readonly type: string,
    public readonly config: EventBrokerConfig
  ) {
    this.metrics = this.initializeMetrics();
  }
  
  // EventBrokerPort implementation
  async connect(): Promise<Either<EventHubError, void>> {
    if (this.connected) {
      return Either.right(undefined as void);
    }
    
    try {
      const result = await this.doConnect();
      if (Either.isLeft(result)) {
        return result;
      }
      
      this.connected = true;
      this.metrics = {
        ...this.metrics,
        connected: true,
        lastActivity: new Date()
      };
      
      return Either.right(undefined as void);
    } catch (error) {
      return Either.left(EventHubError.create(
        UnifiedErrorCode.ADAPTER_CONNECTION_FAILED,
        `Failed to connect to broker '${ this.name }': ${ error instanceof Error ? error.message : String(error) }`,
        'connect',
        {
          timestamp: new Date(),
          module: 'EVENTHUB_ADAPTER',
          adapterId: this.name,
          brokerType: this.type
        },
        undefined,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  async disconnect(): Promise<Either<EventHubError, void>> {
    if (!this.connected) {
      return Either.right(undefined as void);
    }
    
    try {
      const result = await this.doDisconnect();
      if (Either.isLeft(result)) {
        return result;
      }
      
      this.connected = false;
      this.subscribed = false;
      this.eventHandler = undefined;
      this.metrics = {
        ...this.metrics,
        connected: false,
        lastActivity: new Date()
      };
      
      return Either.right(undefined as void);
    } catch (error) {
      return Either.left(EventHubError.create(
        UnifiedErrorCode.ADAPTER_CONNECTION_FAILED,
        `Failed to disconnect from broker '${ this.name }': ${ error instanceof Error ? error.message : String(
          error) }`,
        'disconnect',
        {
          timestamp: new Date(),
          module: 'EVENTHUB_ADAPTER',
          adapterId: this.name,
          brokerType: this.type
        },
        undefined,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  async publish<T>(event: Event<T>): Promise<Either<EventHubError, void>> {
    if (!this.connected) {
      return Either.left(EventHubError.create(
        UnifiedErrorCode.ADAPTER_CONNECTION_FAILED,
        `Cannot publish - broker '${ this.name }' is not connected`,
        'publish',
        {
          timestamp: new Date(),
          module: 'EVENTHUB_ADAPTER',
          adapterId: this.name,
          brokerType: this.type,
          eventId: event.id,
          eventType: event.type
        }
      ));
    }
    
    try {
      const result = await this.doPublish(event);
      if (Either.isLeft(result)) {
        this.metrics = {
          ...this.metrics,
          totalFailed: this.metrics.totalFailed + 1,
          lastActivity: new Date()
        };
        return result;
      }
      
      this.metrics = {
        ...this.metrics,
        totalPublished: this.metrics.totalPublished + 1,
        lastActivity: new Date()
      };
      
      return Either.right(undefined as void);
    } catch (error) {
      this.metrics = {
        ...this.metrics,
        totalFailed: this.metrics.totalFailed + 1,
        lastActivity: new Date()
      };
      
      return Either.left(EventHubError.create(
        UnifiedErrorCode.ADAPTER_SEND_FAILED,
        `Failed to publish event to broker '${ this.name }': ${ error instanceof Error ? error.message : String(
          error) }`,
        'publish',
        {
          timestamp: new Date(),
          module: 'EVENTHUB_ADAPTER',
          adapterId: this.name,
          brokerType: this.type,
          eventId: event.id,
          eventType: event.type
        },
        undefined,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  async subscribe<T>(handler: EventListener<T>): Promise<Either<EventHubError, void>> {
    if (!this.connected) {
      return Either.left(EventHubError.create(
        UnifiedErrorCode.ADAPTER_CONNECTION_FAILED,
        `Cannot subscribe - broker '${ this.name }' is not connected`,
        'subscribe',
        {
          timestamp: new Date(),
          module: 'EVENTHUB_ADAPTER',
          adapterId: this.name,
          brokerType: this.type
        }
      ));
    }
    
    try {
      this.eventHandler = handler as EventListener;
      const result = await this.doSubscribe(handler);
      if (Either.isLeft(result)) {
        return result;
      }
      
      this.subscribed = true;
      this.metrics = {
        ...this.metrics,
        lastActivity: new Date()
      };
      
      return Either.right(undefined as void);
    } catch (error) {
      return Either.left(EventHubError.create(
        UnifiedErrorCode.ADAPTER_RECEIVE_FAILED,
        `Failed to subscribe to broker '${ this.name }': ${ error instanceof Error ? error.message : String(error) }`,
        'subscribe',
        {
          timestamp: new Date(),
          module: 'EVENTHUB_ADAPTER',
          adapterId: this.name,
          brokerType: this.type
        },
        undefined,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  async isReady(): Promise<Either<EventHubError, boolean>> {
    try {
      return Either.right(this.connected);
    } catch (error) {
      return Either.left(EventHubError.create(
        UnifiedErrorCode.ADAPTER_CONNECTION_FAILED,
        `Failed to check readiness of broker '${ this.name }': ${ error instanceof Error ? error.message : String(
          error) }`,
        'isReady',
        {
          timestamp: new Date(),
          module: 'EVENTHUB_ADAPTER',
          adapterId: this.name,
          brokerType: this.type
        },
        undefined,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  // Abstract methods to be implemented by concrete adapters
  protected abstract doConnect(): Promise<Either<EventHubError, void>>;
  protected abstract doDisconnect(): Promise<Either<EventHubError, void>>;
  protected abstract doPublish<T>(event: Event<T>): Promise<Either<EventHubError, void>>;
  protected abstract doSubscribe<T>(handler: EventListener<T>): Promise<Either<EventHubError, void>>;
  
  // Metrics and utility methods
  protected initializeMetrics(): EventBrokerMetrics {
    return {
      brokerName: this.name,
      type: this.type,
      connected: false,
      totalPublished: 0,
      totalReceived: 0,
      totalFailed: 0,
      averageLatency: 0,
      lastActivity: new Date(),
      uptime: 0
    };
  }
  
  getMetrics(): EventBrokerMetrics {
    return { ...this.metrics };
  }
  
  protected handleIncomingEvent<T>(event: Event<T>): void {
    if (this.eventHandler) {
      try {
        this.eventHandler(event);
        this.metrics = {
          ...this.metrics,
          totalReceived: this.metrics.totalReceived + 1,
          lastActivity: new Date()
        };
      } catch (error) {
        this.metrics = {
          ...this.metrics,
          totalFailed: this.metrics.totalFailed + 1,
          lastActivity: new Date()
        };
        // Log error but don't throw - let the handler deal with errors internally
        console.error(`Error handling incoming event in ${ this.name }:`, error);
      }
    }
  }
}
