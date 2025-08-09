/**
 * @fileoverview Port Integration Example
 *
 * This example demonstrates how to use the EventHub's adapter system for
 * integrating with external systems and services through various patterns.
 *
 * Features demonstrated:
 * - Creating and configuring adapters
 * - Using different integration patterns (HTTP, Database, Email, Cache)
 * - Event transformation and routing
 * - External system integration through events
 * - Error handling and retry mechanisms
 * - Lifecycle management
 *
 * @author
 * @version 1.0.0
 */

import { Either } from '@/either';
import { ConsoleLogger } from '@/logger';
import { EventHub } from '../EventHub';
import { EventHubFactory } from '../EventHubFactory';
import { Event } from '../types';

/**
 * Example message types for demonstration
 */
interface HttpWebhookMessage {
  webhookId: string;
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers: Record<string, string>;
  payload: any;
  retryCount?: number;
  timestamp: Date;
}

interface DatabaseSyncMessage {
  operation: 'INSERT' | 'UPDATE' | 'DELETE';
  table: string;
  primaryKey: string | number;
  data: Record<string, any>;
  schema?: string;
  timestamp: Date;
}

interface EmailNotificationMessage {
  emailId: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  body: string;
  attachments?: Array<{
    filename: string;
    content: string;
    contentType: string;
  }>;
  priority: 'low' | 'normal' | 'high';
  timestamp: Date;
}

interface CacheUpdateMessage {
  cacheKey: string;
  operation: 'SET' | 'DELETE' | 'EXPIRE';
  value?: any;
  ttl?: number;
  timestamp: Date;
}

/**
 * Port Example Class
 *
 * Note: This example demonstrates integration patterns using the EventHub's
 * event-driven architecture. In a real implementation, you would create
 * specific adapters that handle the integration with external systems.
 */
export class PortExample {
  private eventHub: EventHub | null = null;
  private logger = ConsoleLogger
  
  constructor() {
    // EventHub will be initialized in the run method using EventHubFactory
  }
  
  /**
   * Run the complete port example
   */
  async run(): Promise<void> {
    this.logger.info('🚀 Starting Port Integration Example');
    
    try {
      // Create EventHub using the factory
      const factory = EventHubFactory.create();
      const eventHubResult = factory.createEventHub('port-example', this.logger, {
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
      
      // Set up integration topics
      await this.setupIntegrationTopics();
      
      await this.httpIntegrationExample();
      await this.databaseIntegrationExample();
      await this.emailIntegrationExample();
      await this.cacheIntegrationExample();
      await this.integrationMetricsExample();
      
      // Proper shutdown
      const stopResult = await this.eventHub.stop();
      if (Either.isLeft(stopResult)) {
        const errorMaybe = Either.getLeft(stopResult);
        const errorMessage = errorMaybe.isJust() ?
          errorMaybe.getOrElse(null)!.getDetailedMessage() : 'Unknown error';
        this.logger.warn('EventHub stop failed:', errorMessage);
      }
      
    } catch (error) {
      this.logger.error(`Port example failed: ${ error }`);
    }
    
    this.logger.info('✅ Port Example completed');
  }
  
  /**
   * Set up integration topics for external system communication
   */
  private async setupIntegrationTopics(): Promise<void> {
    if (!this.eventHub) {
      this.logger.error('EventHub not initialized');
      return;
    }
    
    const topics = [
      { name: 'webhook-integration', persistent: true },
      { name: 'database-sync', persistent: true },
      { name: 'email-notifications', persistent: true },
      { name: 'cache-updates', persistent: false }
    ];
    
    for (const topicConfig of topics) {
      try {
        const createResult = await this.eventHub.createTopic(topicConfig);
        if (Either.isLeft(createResult)) {
          const errorMaybe = Either.getLeft(createResult);
          const errorMessage = errorMaybe.isJust() ? 'Topic creation failed' : 'Unknown error';
          this.logger.warn(`Failed to create topic ${ topicConfig.name }:`, errorMessage);
        } else {
          this.logger.info(`✅ Created integration topic: ${ topicConfig.name }`);
        }
      } catch (error) {
        this.logger.warn(`Error creating topic ${ topicConfig.name }: ${ error }`);
      }
    }
  }
  
  /**
   * HTTP integration example for webhook simulation
   */
  private async httpIntegrationExample(): Promise<void> {
    this.logger.info('\n🌐 HTTP Integration Example');
    
    if (!this.eventHub) return;
    
    const publisher = this.eventHub.getPublisher();
    const subscriber = this.eventHub.getSubscriber();
    
    // Set up webhook processor
    await subscriber.subscribe<HttpWebhookMessage>(
      'webhook-integration',
      async (event: Event<HttpWebhookMessage>) => {
        const webhook = event.data;
        this.logger.info('🔄 Processing webhook:', JSON.stringify({
          webhookId: webhook.webhookId,
          endpoint: webhook.endpoint,
          method: webhook.method
        }));
        
        // Simulate HTTP request processing
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Simulate success/failure
        const success = Math.random() > 0.2; // 80% success rate
        
        if (success) {
          this.logger.info(`✅ Webhook ${ webhook.webhookId } sent successfully to ${ webhook.endpoint }`);
        } else {
          this.logger.error(`❌ Webhook ${ webhook.webhookId } failed - simulated network error`);
        }
      }
    );
    
    // Create webhook messages
    const webhooks: HttpWebhookMessage[] = [
      {
        webhookId: 'WH-001',
        endpoint: '/webhooks/order-created',
        method: 'POST',
        headers: {
          'X-Event-Type': 'order.created',
          'X-Source': 'order-service'
        },
        payload: {
          orderId: 'ORD-123',
          customerId: 'CUST-456',
          amount: 99.99,
          items: [{ productId: 'PROD-001', quantity: 2 }]
        },
        timestamp: new Date()
      },
      {
        webhookId: 'WH-002',
        endpoint: '/webhooks/payment-processed',
        method: 'POST',
        headers: {
          'X-Event-Type': 'payment.processed',
          'X-Source': 'payment-service'
        },
        payload: {
          paymentId: 'PAY-789',
          orderId: 'ORD-123',
          status: 'completed',
          amount: 99.99
        },
        timestamp: new Date()
      }
    ];
    
    // Publish webhook events
    for (const webhook of webhooks) {
      const publishResult = await publisher.publish('webhook-integration', webhook);
      if (Either.isLeft(publishResult)) {
        const errorMaybe = Either.getLeft(publishResult);
        const errorMessage = errorMaybe.isJust() ? 'Publish failed' : 'Unknown error';
        this.logger.error(`Failed to publish webhook ${ webhook.webhookId }:`, errorMessage);
      } else {
        this.logger.info(`📤 Published webhook: ${ webhook.webhookId } to ${ webhook.endpoint }`);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  /**
   * Database integration example for data synchronization
   */
  private async databaseIntegrationExample(): Promise<void> {
    this.logger.info('\n🗄️ Database Integration Example');
    
    if (!this.eventHub) return;
    
    const publisher = this.eventHub.getPublisher();
    const subscriber = this.eventHub.getSubscriber();
    
    // Set up database sync processor
    await subscriber.subscribe<DatabaseSyncMessage>(
      'database-sync',
      async (event: Event<DatabaseSyncMessage>) => {
        const dbOp = event.data;
        this.logger.info('🔄 Processing database operation:', JSON.stringify({
          operation: dbOp.operation,
          table: dbOp.table,
          primaryKey: dbOp.primaryKey
        }));
        
        // Simulate database operation
        await new Promise(resolve => setTimeout(resolve, 150));
        
        // Simulate success/failure
        const success = Math.random() > 0.1; // 90% success rate
        
        if (success) {
          this.logger.info(`✅ Database ${ dbOp.operation } successful on ${ dbOp.table }:${ dbOp.primaryKey }`);
        } else {
          this.logger.error(`❌ Database ${ dbOp.operation } failed - simulated connection error`);
        }
      }
    );
    
    // Create database sync messages
    const dbOperations: DatabaseSyncMessage[] = [
      {
        operation: 'INSERT',
        table: 'users',
        primaryKey: 'user-001',
        data: {
          id: 'user-001',
          email: 'john.doe@example.com',
          firstName: 'John',
          lastName: 'Doe',
          createdAt: new Date()
        },
        timestamp: new Date()
      },
      {
        operation: 'UPDATE',
        table: 'users',
        primaryKey: 'user-001',
        data: {
          lastName: 'Smith',
          updatedAt: new Date()
        },
        timestamp: new Date()
      },
      {
        operation: 'INSERT',
        table: 'orders',
        primaryKey: 'order-001',
        data: {
          id: 'order-001',
          userId: 'user-001',
          amount: 149.99,
          status: 'pending',
          createdAt: new Date()
        },
        timestamp: new Date()
      }
    ];
    
    // Publish database sync events
    for (const operation of dbOperations) {
      const publishResult = await publisher.publish('database-sync', operation);
      if (Either.isLeft(publishResult)) {
        const errorMaybe = Either.getLeft(publishResult);
        const errorMessage = errorMaybe.isJust() ? 'Publish failed' : 'Unknown error';
        this.logger.error(`Failed to publish ${ operation.operation }:`, errorMessage);
      } else {
        this.logger.info(`📤 Published ${ operation.operation } for ${ operation.table }:${ operation.primaryKey }`);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  /**
   * Email integration example for notification sending
   */
  private async emailIntegrationExample(): Promise<void> {
    this.logger.info('\n📧 Email Integration Example');
    
    if (!this.eventHub) return;
    
    const publisher = this.eventHub.getPublisher();
    const subscriber = this.eventHub.getSubscriber();
    
    // Set up email processor
    await subscriber.subscribe<EmailNotificationMessage>(
      'email-notifications',
      async (event: Event<EmailNotificationMessage>) => {
        const email = event.data;
        this.logger.info('🔄 Processing email:', JSON.stringify({
          emailId: email.emailId,
          to: email.to,
          subject: email.subject,
          priority: email.priority
        }));
        
        // Simulate email sending
        await new Promise(resolve => setTimeout(resolve, 300));
        
        // Simulate success/failure based on priority
        const successRate = email.priority === 'high' ? 0.95 : 0.85;
        const success = Math.random() < successRate;
        
        if (success) {
          this.logger.info(`✅ Email ${ email.emailId } sent successfully to ${ email.to.join(', ') }`);
        } else {
          this.logger.error(`❌ Email ${ email.emailId } failed - simulated SMTP error`);
        }
      }
    );
    
    // Create email notification messages
    const emails: EmailNotificationMessage[] = [
      {
        emailId: 'EMAIL-001',
        to: ['customer@example.com'],
        subject: 'Order Confirmation',
        body: 'Thank you for your order! Order ID: ORD-123, Amount: $99.99',
        priority: 'high',
        timestamp: new Date()
      },
      {
        emailId: 'EMAIL-002',
        to: ['customer@example.com'],
        cc: ['support@example.com'],
        subject: 'Payment Processed',
        body: 'Your payment has been successfully processed. Payment ID: PAY-789',
        priority: 'normal',
        timestamp: new Date()
      },
      {
        emailId: 'EMAIL-003',
        to: ['admin@example.com'],
        subject: 'Daily Report',
        body: 'Daily sales report is ready for review.',
        priority: 'low',
        timestamp: new Date()
      }
    ];
    
    // Publish email events
    for (const email of emails) {
      const publishResult = await publisher.publish('email-notifications', email);
      if (Either.isLeft(publishResult)) {
        const errorMaybe = Either.getLeft(publishResult);
        const errorMessage = errorMaybe.isJust() ? 'Publish failed' : 'Unknown error';
        this.logger.error(`Failed to publish email ${ email.emailId }:`, errorMessage);
      } else {
        this.logger.info(`📤 Published email: ${ email.subject } to ${ email.to.join(', ') }`);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  /**
   * Cache integration example for Redis-like operations
   */
  private async cacheIntegrationExample(): Promise<void> {
    this.logger.info('\n🗃️ Cache Integration Example');
    
    if (!this.eventHub) return;
    
    const publisher = this.eventHub.getPublisher();
    const subscriber = this.eventHub.getSubscriber();
    
    // Set up cache processor
    await subscriber.subscribe<CacheUpdateMessage>(
      'cache-updates',
      async (event: Event<CacheUpdateMessage>) => {
        const cacheOp = event.data;
        this.logger.info('🔄 Processing cache operation:', JSON.stringify({
          operation: cacheOp.operation,
          key: cacheOp.cacheKey,
          ttl: cacheOp.ttl
        }));
        
        // Simulate cache operation
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // Simulate success (cache operations are usually very reliable)
        const success = Math.random() > 0.05; // 95% success rate
        
        if (success) {
          this.logger.info(`✅ Cache ${ cacheOp.operation } successful: ${ cacheOp.cacheKey }`);
        } else {
          this.logger.error(`❌ Cache ${ cacheOp.operation } failed - simulated Redis connection error`);
        }
      }
    );
    
    // Create cache update messages
    const cacheOperations: CacheUpdateMessage[] = [
      {
        cacheKey: 'user:user-001',
        operation: 'SET',
        value: {
          id: 'user-001',
          email: 'john.doe@example.com',
          firstName: 'John',
          lastName: 'Doe'
        },
        ttl: 3600, // 1 hour
        timestamp: new Date()
      },
      {
        cacheKey: 'session:sess-001',
        operation: 'SET',
        value: {
          userId: 'user-001',
          loginTime: new Date(),
          permissions: ['read', 'write']
        },
        ttl: 1800, // 30 minutes
        timestamp: new Date()
      },
      {
        cacheKey: 'temp:calculation-123',
        operation: 'DELETE',
        timestamp: new Date()
      },
      {
        cacheKey: 'user:user-001',
        operation: 'EXPIRE',
        ttl: 7200, // 2 hours
        timestamp: new Date()
      }
    ];
    
    // Publish cache events
    for (const operation of cacheOperations) {
      const publishResult = await publisher.publish('cache-updates', operation);
      if (Either.isLeft(publishResult)) {
        const errorMaybe = Either.getLeft(publishResult);
        const errorMessage = errorMaybe.isJust() ? 'Publish failed' : 'Unknown error';
        this.logger.error(`Failed to publish cache ${ operation.operation }:`, errorMessage);
      } else {
        this.logger.info(`📤 Published cache ${ operation.operation }: ${ operation.cacheKey }`);
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  /**
   * Integration metrics example
   */
  private async integrationMetricsExample(): Promise<void> {
    this.logger.info('\n📊 Integration Metrics Example');
    
    if (!this.eventHub) return;
    
    try {
      // Overall EventHub metrics
      const hubMetrics = this.eventHub.getMetrics();
      this.logger.info('🎯 EventHub integration metrics:', JSON.stringify({
        eventsProcessed: (hubMetrics as any).eventsProcessed || 0,
        failedEvents: (hubMetrics as any).failedEvents || 0,
        activeSubscriptions: (hubMetrics as any).activeSubscriptions || 0,
        uptimeMs: hubMetrics.uptimeMs || 0
      }));
      
      this.logger.info('📈 Integration patterns demonstrated:');
      this.logger.info('   • HTTP Webhooks: Event-driven external API calls');
      this.logger.info('   • Database Sync: Reliable data synchronization');
      this.logger.info('   • Email Notifications: Priority-based messaging');
      this.logger.info('   • Cache Updates: Fast data access patterns');
      
    } catch (error) {
      this.logger.info('📈 Metrics not available in current implementation');
    }
  }
}

// Export for use in other examples
export const runPortExample = async (): Promise<void> => {
  const example = new PortExample();
  await example.run();
};

runPortExample().catch(console.error);
// // Run example if called directly
// if (require.main === module) {
//   runPortExample().catch(console.error);
// }
