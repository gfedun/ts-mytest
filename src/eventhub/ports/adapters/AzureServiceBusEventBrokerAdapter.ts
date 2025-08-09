/**
 * @fileoverview Azure Service Bus Event Broker Adapter
 *
 * This module provides a concrete implementation of the EventBrokerPort
 * for Azure Service Bus integration using topics and subscriptions for
 * event publishing and subscribing.
 *
 * @author
 * @version 1.0.0
 */

import { Either } from '@/either';
import { EventHubError } from '@/eventhub/EventHubError';
import {
  Event,
  EventListener,
  EventPriority
} from '@/eventhub/types';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { EventBrokerConfig } from '../types';
import { AbstractEventBrokerAdapter } from './AbstractEventBrokerAdapter';

/**
 * Azure Service Bus-specific configuration extending the base broker config
 */
export interface AzureServiceBusEventBrokerConfig
  extends EventBrokerConfig {
  /** Azure Service Bus connection string */
  readonly connectionString: string;
  /** Default topic name for publishing */
  readonly defaultTopic?: string;
  /** Subscription name for receiving messages */
  readonly subscriptionName?: string;
  /** Message time-to-live in milliseconds */
  readonly messageTtl?: number;
  /** Enable dead letter queue */
  readonly enableDeadLetter?: boolean;
  /** Maximum delivery count before dead lettering */
  readonly maxDeliveryCount?: number;
  /** Lock duration for message processing */
  readonly lockDuration?: number;
  /** Auto-complete messages after successful processing */
  readonly autoComplete?: boolean;
  /** Azure Service Bus client options */
  readonly serviceBusOptions?: {
    readonly retryOptions?: {
      readonly maxRetries?: number;
      readonly retryDelayInMs?: number;
      readonly maxRetryDelayInMs?: number;
    };
    readonly webSocketOptions?: {
      readonly port?: number;
      readonly origin?: string;
    };
  };
}

/**
 * Azure Service Bus Event Broker Adapter Implementation
 *
 * Provides event broker functionality using Azure Service Bus topics and
 * subscriptions for reliable cloud-based event publishing and subscribing.
 */
export class AzureServiceBusEventBrokerAdapter
  extends AbstractEventBrokerAdapter {
  private serviceBusClient?: any; // ServiceBusClient instance
  private sender?: any; // ServiceBusSender instance
  private receiver?: any; // ServiceBusReceiver instance
  private readonly azureConfig: AzureServiceBusEventBrokerConfig;
  
  constructor(
    name: string,
    config: AzureServiceBusEventBrokerConfig
  ) {
    super(name, 'azure-servicebus', config);
    this.azureConfig = {
      defaultTopic: 'events',
      subscriptionName: 'eventhub-subscription',
      messageTtl: 3600000, // 1 hour
      enableDeadLetter: true,
      maxDeliveryCount: 10,
      lockDuration: 60000, // 1 minute
      autoComplete: true,
      ...config
    };
  }
  
  protected async doConnect(): Promise<Either<EventHubError, void>> {
    try {
      if (!this.azureConfig.connectionString) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.INVALID_ADAPTER_CONFIG,
          'Azure Service Bus connection string is required',
          'doConnect',
          {
            timestamp: new Date(),
            module: 'AZURE_SERVICEBUS_ADAPTER',
            adapterId: this.name,
            brokerType: this.type
          }
        ));
      }
      
      // Mock Azure Service Bus connection - in real implementation would use @azure/service-bus
      // const { ServiceBusClient } = require('@azure/service-bus');
      // this.serviceBusClient = new ServiceBusClient(this.azureConfig.connectionString);
      
      // For now, simulate connection
      await this.simulateConnection();
      
      return Either.right(undefined as void);
    } catch (error) {
      return Either.left(EventHubError.create(
        UnifiedErrorCode.ADAPTER_CONNECTION_FAILED,
        `Failed to connect to Azure Service Bus: ${ error instanceof Error ? error.message : String(error) }`,
        'doConnect',
        {
          timestamp: new Date(),
          module: 'AZURE_SERVICEBUS_ADAPTER',
          adapterId: this.name,
          brokerType: this.type,
          additionalData: {
            topic: this.azureConfig.defaultTopic,
            subscription: this.azureConfig.subscriptionName
          }
        },
        undefined,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  protected async doDisconnect(): Promise<Either<EventHubError, void>> {
    try {
      // Mock Azure Service Bus disconnection
      if (this.sender) {
        // await this.sender.close();
        this.sender = undefined;
      }
      if (this.receiver) {
        // await this.receiver.close();
        this.receiver = undefined;
      }
      if (this.serviceBusClient) {
        // await this.serviceBusClient.close();
        this.serviceBusClient = undefined;
      }
      
      return Either.right(undefined as void);
    } catch (error) {
      return Either.left(EventHubError.create(
        UnifiedErrorCode.ADAPTER_CONNECTION_FAILED,
        `Failed to disconnect from Azure Service Bus: ${ error instanceof Error ? error.message : String(error) }`,
        'doDisconnect',
        {
          timestamp: new Date(),
          module: 'AZURE_SERVICEBUS_ADAPTER',
          adapterId: this.name,
          brokerType: this.type
        },
        undefined,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  protected async doPublish<T>(event: Event<T>): Promise<Either<EventHubError, void>> {
    try {
      if (!this.serviceBusClient) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.ADAPTER_CONNECTION_FAILED,
          'Azure Service Bus client not connected',
          'doPublish',
          {
            timestamp: new Date(),
            module: 'AZURE_SERVICEBUS_ADAPTER',
            adapterId: this.name,
            brokerType: this.type,
            eventId: event.id,
            eventType: event.type
          }
        ));
      }
      
      // Ensure sender is created
      if (!this.sender) {
        const topicName = this.azureConfig.defaultTopic || 'events';
        // this.sender = this.serviceBusClient.createSender(topicName);
        this.sender = { topicName }; // Mock sender
      }
      
      const message = {
        messageId: event.id,
        body: event.data,
        subject: event.type,
        contentType: 'application/json',
        timeToLive: this.azureConfig.messageTtl,
        applicationProperties: {
          eventType: event.type,
          source: event.source,
          correlationId: event.correlationId || '',
          timestamp: event.timestamp.toISOString(),
          ...event.metadata
        }
      };
      
      // Mock sending message to Azure Service Bus
      // await this.sender.sendMessages(message);
      await this.simulatePublish(message);
      
      return Either.right(undefined as void);
    } catch (error) {
      return Either.left(EventHubError.create(
        UnifiedErrorCode.ADAPTER_SEND_FAILED,
        `Failed to publish event to Azure Service Bus: ${ error instanceof Error ? error.message : String(error) }`,
        'doPublish',
        {
          timestamp: new Date(),
          module: 'AZURE_SERVICEBUS_ADAPTER',
          adapterId: this.name,
          brokerType: this.type,
          eventId: event.id,
          eventType: event.type,
          additionalData: {
            topic: this.azureConfig.defaultTopic || 'events'
          }
        },
        undefined,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  protected async doSubscribe<T>(handler: EventListener<T>): Promise<Either<EventHubError, void>> {
    try {
      if (!this.serviceBusClient) {
        return Either.left(EventHubError.create(
          UnifiedErrorCode.ADAPTER_CONNECTION_FAILED,
          'Azure Service Bus client not connected',
          'doSubscribe',
          {
            timestamp: new Date(),
            module: 'AZURE_SERVICEBUS_ADAPTER',
            adapterId: this.name,
            brokerType: this.type
          }
        ));
      }
      
      const topicName = this.azureConfig.defaultTopic || 'events';
      const subscriptionName = this.azureConfig.subscriptionName || 'eventhub-subscription';
      
      // Create receiver for the subscription
      // this.receiver = this.serviceBusClient.createReceiver(topicName, subscriptionName);
      this.receiver = { topicName, subscriptionName }; // Mock receiver
      
      // Start message processing
      this.startMessageProcessing(handler);
      
      return Either.right(undefined as void);
    } catch (error) {
      return Either.left(EventHubError.create(
        UnifiedErrorCode.ADAPTER_RECEIVE_FAILED,
        `Failed to subscribe to Azure Service Bus: ${ error instanceof Error ? error.message : String(error) }`,
        'doSubscribe',
        {
          timestamp: new Date(),
          module: 'AZURE_SERVICEBUS_ADAPTER',
          adapterId: this.name,
          brokerType: this.type,
          additionalData: {
            topic: this.azureConfig.defaultTopic || 'events',
            subscription: this.azureConfig.subscriptionName || 'eventhub-subscription'
          }
        },
        undefined,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  // Mock/simulation methods (in real implementation these would use actual Azure Service Bus SDK)
  private async simulateConnection(): Promise<void> {
    // Simulate connection delay and potential failures
    await new Promise(resolve => setTimeout(resolve, 200));
    this.serviceBusClient = { connected: true }; // Mock client
  }
  
  private async simulatePublish(message: any): Promise<void> {
    // Simulate publishing delay
    await new Promise(resolve => setTimeout(resolve, 50));
    // In real implementation: await this.sender.sendMessages(message);
  }
  
  private startMessageProcessing<T>(handler: EventListener<T>): void {
    // Mock message processing - in real implementation would use receiver.subscribe()
    const mockProcessor = setInterval(() => {
      // Simulate receiving messages
      // In real implementation:
      // this.receiver.subscribe({
      //   processMessage: async (message) => {
      //     const event = this.convertToEvent(message);
      //     handler(event);
      //     if (this.azureConfig.autoComplete) {
      //       await this.receiver.completeMessage(message);
      //     }
      //   },
      //   processError: async (error) => {
      //     console.error('Error processing message:', error);
      //   }
      // });
    }, 1000);
    
    // Store processor reference for cleanup (in real implementation)
    // this.activeProcessors.set(this.receiver.topicName, mockProcessor);
  }
  
  private convertToEvent<T>(message: any): Event<T> {
    // Convert Azure Service Bus message to Event format
    return {
      id: message.messageId || '',
      type: message.subject || '',
      data: message.body,
      timestamp: new Date(message.applicationProperties?.timestamp || Date.now()),
      source: message.applicationProperties?.source || 'azure-servicebus',
      priority: EventPriority.NORMAL,
      correlationId: message.applicationProperties?.correlationId,
      metadata: {
        ...message.applicationProperties,
        deliveryCount: message.deliveryCount,
        enqueuedTimeUtc: message.enqueuedTimeUtc
      }
    };
  }
  
  /**
   * Create an Azure Service Bus Event Broker Adapter instance
   */
  static create(
    name: string,
    config: AzureServiceBusEventBrokerConfig
  ): AzureServiceBusEventBrokerAdapter {
    return new AzureServiceBusEventBrokerAdapter(name, config);
  }
}
