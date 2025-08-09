/**
 * @fileoverview Topic (Publish-Subscribe) Messaging Example
 *
 * This example demonstrates how to use the EventHub's Topic system for
 * Publish-Subscribe messaging where messages are broadcast to multiple subscribers.
 *
 * Features demonstrated:
 * - Creating and configuring topics
 * - Publishing messages to topics
 * - Subscribing to topics with different filters
 * - Message routing and filtering
 * - Durable vs non-durable subscriptions
 * - Topic metrics monitoring
 * - Subscriber groups and partitioning
 * - Error handling and recovery
 *
 * @author
 * @version 1.0.0
 */

import { Either } from '@/either';
import { TopicConfig } from "@/eventhub";
import { ConsoleLogger } from '@/logger';
import { EventBuilder } from '../EventBuilder';
import { EventHub } from '../EventHub';
import { EventHubFactory } from '../EventHubFactory';
import {
  Event,
  EventPriority
} from '../types';

/**
 * Example message types for demonstration
 */
interface UserActivityMessage {
  userId: string;
  activityType: 'login' | 'logout' | 'purchase' | 'view' | 'search';
  details: Record<string, any>;
  timestamp: Date;
  sessionId?: string;
}

interface SystemAlertMessage {
  alertId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  service: string;
  message: string;
  metadata?: Record<string, any>;
  timestamp: Date;
}

interface ProductUpdateMessage {
  productId: string;
  updateType: 'price_change' | 'inventory_update' | 'description_change' | 'discontinued';
  oldValue?: any;
  newValue: any;
  timestamp: Date;
}

/**
 * Topic Example Class
 */
export class TopicExample {
  private eventHub: EventHub | null = null;
  private logger = ConsoleLogger;
  
  constructor() {
    // EventHub will be initialized in the run method using EventHubFactory
  }
  
  /**
   * Run the complete topic example
   */
  async run(): Promise<void> {
    this.logger.info('🚀 Starting Topic (Publish-Subscribe) Example');
    
    try {
      // Create EventHub using the factory
      const factory = EventHubFactory.create();
      const eventHubResult = factory.createEventHub('topic-example', this.logger, {
        enableMetrics: true,
        eventTimeoutMs: 30000
      });
      
      if (Either.isLeft(eventHubResult)) {
        const errorMaybe = Either.getLeft(eventHubResult);
        const errorMessage = errorMaybe.isJust() ?
          errorMaybe.getOrElse(null)!.getDetailedMessage() : 'Unknown error';
        this.logger.error('Failed to create EventHub:', errorMessage);
        return;
      }
      
      const eventHubMaybe = Either.getRight(eventHubResult);
      if (eventHubMaybe.isNothing()) {
        this.logger.error('Failed to get EventHub from result');
        return;
      }
      
      this.eventHub = eventHubMaybe.getOrElse(null)!;
      
      // Initialize the EventHub
      if (!this.eventHub) {
        this.logger.error('EventHub instance is null');
        return;
      }
      
      const initResult = await this.eventHub.initialize();
      if (Either.isLeft(initResult)) {
        const errorMaybe = Either.getLeft(initResult);
        const errorMessage = errorMaybe.isJust() ?
          errorMaybe.getOrElse(null)!.getDetailedMessage() : 'Unknown error';
        this.logger.error('Failed to initialize EventHub:', errorMessage);
        return;
      }
      
      // Start the EventHub
      const startResult = await this.eventHub.start();
      if (Either.isLeft(startResult)) {
        const errorMaybe = Either.getLeft(startResult);
        const errorMessage = errorMaybe.isJust() ?
          errorMaybe.getOrElse(null)!.getDetailedMessage() : 'Unknown error';
        this.logger.error('Failed to start EventHub:', errorMessage);
        return;
      }
      
      // Create topics before using them
      await this.createTopics();
      
      await this.basicTopicExample();
      await this.filteredSubscriptionExample();
      await this.durableSubscriptionExample();
      await this.topicMetricsExample();
      
      // Proper shutdown
      const stopResult = await this.eventHub.stop();
      if (Either.isLeft(stopResult)) {
        const errorMaybe = Either.getLeft(stopResult);
        const errorMessage = errorMaybe.isJust() ?
          errorMaybe.getOrElse(null)!.getDetailedMessage() : 'Unknown error';
        this.logger.warn('EventHub stop failed:', errorMessage);
      }
      
    } catch (error) {
      this.logger.error(`Topic example failed: ${ error }`);
    }
    
    this.logger.info('✅ Topic Example completed');
  }
  
  /**
   * Create topics with proper configuration
   */
  private async createTopics(): Promise<void> {
    if (!this.eventHub) {
      this.logger.error('EventHub not initialized');
      return;
    }
    
    const topicConfigs: TopicConfig[] = [
      {
        name: 'user-activity',
        persistent: true
      },
      {
        name: 'system-alerts',
        persistent: true
      },
      {
        name: 'product-updates',
        persistent: false
      }
    ];
    
    for (const config of topicConfigs) {
      try {
        const createResult = await this.eventHub.createTopic(config);
        if (Either.isLeft(createResult)) {
          const errorMaybe = Either.getLeft(createResult);
          const errorMessage = errorMaybe.isJust() ?
            errorMaybe.getOrElse(null)!.getDetailedMessage() : 'Unknown error';
          this.logger.warn(`Failed to create topic ${ config.name }:`, errorMessage);
        } else {
          this.logger.info(`✅ Created topic: ${ config.name }`);
        }
      } catch (error) {
        this.logger.warn(`Error creating topic ${ config.name }: ${ error }`);
      }
    }
  }
  
  /**
   * Basic topic publish-subscribe example
   */
  private async basicTopicExample(): Promise<void> {
    this.logger.info('\n📢 Basic Topic Example');
    
    if (!this.eventHub) return;
    
    // Get the subscriber to set up subscriptions
    const subscriber = this.eventHub.getSubscriber();
    const publisher = this.eventHub.getPublisher();
    
    // Set up subscribers for user activity
    await subscriber.subscribe<UserActivityMessage>(
      'user-activity',
      async (event: Event<UserActivityMessage>) => {
        const activity = event.data;
        this.logger.info('📊 Analytics received user activity:', JSON.stringify({
          userId: activity.userId,
          type: activity.activityType,
          timestamp: activity.timestamp
        }));
      }
    );
    
    await subscriber.subscribe<UserActivityMessage>(
      'user-activity',
      async (event: Event<UserActivityMessage>) => {
        const activity = event.data;
        this.logger.info('📝 Audit logged user activity:', JSON.stringify({
          userId: activity.userId,
          type: activity.activityType,
          sessionId: activity.sessionId
        }));
      }
    );
    
    // Publish user activities
    const activities = [
      {
        userId: 'user-123',
        activityType: 'login' as const,
        details: { ipAddress: '192.168.1.100', userAgent: 'Chrome/96.0' },
        timestamp: new Date(),
        sessionId: 'sess-abc123'
      },
      {
        userId: 'user-456',
        activityType: 'purchase' as const,
        details: { orderId: 'ORD-789', amount: 99.99 },
        timestamp: new Date(),
        sessionId: 'sess-def456'
      },
      {
        userId: 'user-123',
        activityType: 'logout' as const,
        details: { sessionDuration: 1800 },
        timestamp: new Date(),
        sessionId: 'sess-abc123'
      }
    ];
    
    for (const activity of activities) {
      const event = EventBuilder.create<UserActivityMessage>(
        'user.activity',
        activity,
        {
          priority: EventPriority.NORMAL,
          source: 'user-service'
        }
      );
      
      const publishResult = await publisher.publish('user-activity', event);
      if (Either.isLeft(publishResult)) {
        const errorMaybe = Either.getLeft(publishResult);
        const errorMessage = errorMaybe.isJust() ?
          errorMaybe.getOrElse(null)!.getDetailedMessage() : 'Unknown error';
        this.logger.error('Failed to publish to topic:', errorMessage);
      } else {
        this.logger.info(`📤 Published ${ activity.activityType } activity for user ${ activity.userId }`);
      }
    }
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  /**
   * Filtered subscription example
   */
  private async filteredSubscriptionExample(): Promise<void> {
    this.logger.info('\n🔍 Filtered Subscription Example');
    
    if (!this.eventHub) return;
    
    const subscriber = this.eventHub.getSubscriber();
    const publisher = this.eventHub.getPublisher();
    
    // Subscribe to only critical system alerts
    await subscriber.subscribe<SystemAlertMessage>(
      'system-alerts',
      async (event: Event<SystemAlertMessage>) => {
        try {
          const alert = event.data;
          if (!alert || !alert.severity || !alert.service) {
            this.logger.warn('Invalid alert data received:', JSON.stringify(alert));
            return;
          }
          this.logger.info('🚨 CRITICAL ALERT - Paging on-call engineer:', JSON.stringify({
            alertId: alert.alertId,
            service: alert.service,
            message: alert.message
          }));
        } catch (error) {
          this.logger.error(`Error processing critical alert: ${ error }`);
        }
      },
      {
        filter: (event: Event<SystemAlertMessage>) => {
          try {
            const alert = event.data;
            return alert && alert.severity === 'critical';
          } catch (error) {
            this.logger.error(`Error in critical alert filter: ${ error }`);
            return false;
          }
        }
      }
    );
    
    // Subscribe to all alerts for logging
    await subscriber.subscribe<SystemAlertMessage>(
      'system-alerts',
      async (event: Event<SystemAlertMessage>) => {
        try {
          const alert = event.data;
          if (!alert || !alert.severity || !alert.service) {
            this.logger.warn('Invalid alert data received for logging:', JSON.stringify(alert));
            return;
          }
          this.logger.info(`📋 Logged ${ alert.severity.toUpperCase() } alert from ${ alert.service }`);
        } catch (error) {
          this.logger.error(`Error logging alert: ${ error }`);
        }
      }
    );
    
    // Publish alerts with different severities
    const alerts = [
      {
        alertId: 'ALERT-001',
        severity: 'low' as const,
        service: 'web-server',
        message: 'High CPU usage detected',
        timestamp: new Date()
      },
      {
        alertId: 'ALERT-002',
        severity: 'critical' as const,
        service: 'database',
        message: 'Database connection pool exhausted',
        timestamp: new Date()
      },
      {
        alertId: 'ALERT-003',
        severity: 'medium' as const,
        service: 'cache-server',
        message: 'Cache hit ratio below threshold',
        timestamp: new Date()
      }
    ];
    
    for (const alert of alerts) {
      // Use createPayload to prevent double-wrapping - EventHub will handle event structure
      const alertPayload = EventBuilder.createPayload<SystemAlertMessage>(
        'system.alert',
        alert,
        {
          priority: alert.severity === 'critical' ? EventPriority.HIGH : EventPriority.NORMAL,
          source: 'monitoring-service'
        }
      );
      
      await publisher.publish('system-alerts', alertPayload);
      this.logger.info(`📤 Published ${ alert.severity } alert: ${ alert.alertId }`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  /**
   * Durable subscription example
   */
  private async durableSubscriptionExample(): Promise<void> {
    this.logger.info('\n💾 Durable Subscription Example');
    
    if (!this.eventHub) return;
    
    const subscriber = this.eventHub.getSubscriber();
    const publisher = this.eventHub.getPublisher();
    
    // Create a durable subscription for product updates
    await subscriber.subscribe<ProductUpdateMessage>(
      'product-updates',
      async (event: Event<ProductUpdateMessage>) => {
        const update = event.data;
        this.logger.info('📦 Inventory system processing product update:', JSON.stringify({
          productId: update.productId,
          updateType: update.updateType,
          newValue: update.newValue
        }));
      }
    );
    
    // Publish product updates
    const productUpdates = [
      {
        productId: 'PROD-001',
        updateType: 'price_change' as const,
        oldValue: 29.99,
        newValue: 27.99,
        timestamp: new Date()
      },
      {
        productId: 'PROD-002',
        updateType: 'inventory_update' as const,
        oldValue: 50,
        newValue: 25,
        timestamp: new Date()
      },
      {
        productId: 'PROD-003',
        updateType: 'discontinued' as const,
        oldValue: true,
        newValue: false,
        timestamp: new Date()
      }
    ];
    
    for (const update of productUpdates) {
      const event = EventBuilder.create<ProductUpdateMessage>(
        'product.updated',
        update,
        {
          priority: EventPriority.NORMAL,
          source: 'product-service'
        }
      );
      
      await publisher.publish('product-updates', event);
      this.logger.info(`📤 Published product update: ${ update.productId } - ${ update.updateType }`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  /**
   * Topic metrics and monitoring example
   */
  private async topicMetricsExample(): Promise<void> {
    this.logger.info('\n📈 Topic Metrics Example');
    
    if (!this.eventHub) return;
    
    try {
      // Overall EventHub metrics
      const hubMetrics = this.eventHub.getMetrics();
      this.logger.info('🎯 EventHub overall metrics:', JSON.stringify({
        eventsProcessed: (hubMetrics as any).eventsProcessed || 0,
        failedEvents: (hubMetrics as any).failedEvents || 0,
        activeSubscriptions: (hubMetrics as any).activeSubscriptions || 0,
        uptimeMs: hubMetrics.uptimeMs || 0
      }));
      
    } catch (error) {
      this.logger.info('📈 Metrics not available in current implementation');
    }
  }
}

// Export for use in other examples
export const runTopicExample = async (): Promise<void> => {
  const example = new TopicExample();
  await example.run();
};

runTopicExample().catch(console.error);

// // Run example if called directly
// if (require.main === module) {
//   runTopicExample().catch(console.error);
// }
