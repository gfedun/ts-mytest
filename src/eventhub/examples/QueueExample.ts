/**
 * @fileoverview Queue (Point-to-Point) Messaging Example
 *
 * This example demonstrates how to use the EventHub's Queue system for
 * Point-to-Point messaging where each message is consumed by exactly one consumer.
 *
 * Features demonstrated:
 * - Creating and configuring queues
 * - Sending messages to queues
 * - Consuming messages with handlers
 * - FIFO vs Priority queue processing
 * - Error handling and retry logic
 * - Queue metrics monitoring
 * - Dead letter queue handling
 * - Graceful shutdown
 *
 * @author
 * @version 1.0.0
 */

import { Either } from '@/either';
import { QueueConfig } from "@/eventhub";
import { ConsoleLogger } from '@/logger';
import { EventHub } from '../EventHub';
import { EventHubFactory } from '../EventHubFactory';
import { EventPriority } from '../types';

/**
 * Example message types for demonstration
 */
interface OrderProcessingMessage {
  orderId: string;
  customerId: string;
  items: Array<{
    productId: string;
    quantity: number;
    price: number;
  }>;
  totalAmount: number;
  timestamp: Date;
}

interface PaymentProcessingMessage {
  paymentId: string;
  orderId: string;
  amount: number;
  paymentMethod: 'credit_card' | 'paypal' | 'bank_transfer';
  timestamp: Date;
}

interface NotificationMessage {
  type: 'email' | 'sms' | 'push';
  recipient: string;
  subject: string;
  message: string;
  timestamp: Date;
}

/**
 * Queue Example Class
 */
export class QueueExample {
  private eventHub: EventHub | null = null;
  private logger = ConsoleLogger
  
  constructor() {
    // EventHub will be initialized in the run method using EventHubFactory
  }
  
  /**
   * Run the complete queue example
   */
  async run(): Promise<void> {
    this.logger.info('🚀 Starting Queue (Point-to-Point) Example');
    
    try {
      // Create EventHub using the factory
      const factory = EventHubFactory.create();
      const eventHubResult = factory.createEventHub('queue-example', this.logger, {
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
      
      // Create queues before using them
      await this.createQueues();
      
      await this.basicQueueExample();
      await this.priorityQueueExample();
      await this.batchProcessingExample();
      await this.queueMetricsExample();
      
      // Proper shutdown
      const stopResult = await this.eventHub.stop();
      if (Either.isLeft(stopResult)) {
        const errorMaybe = Either.getLeft(stopResult);
        const errorMessage = errorMaybe.isJust() ?
          errorMaybe.getOrElse(null)!.getDetailedMessage() : 'Unknown error';
        this.logger.warn('EventHub stop failed:', errorMessage);
      }
      
    } catch (error) {
      this.logger.error(`Queue example failed: ${ error }`);
    }
    
    this.logger.info('✅ Queue Example completed');
  }
  
  /**
   * Create queues with proper configuration
   */
  private async createQueues(): Promise<void> {
    if (!this.eventHub) {
      this.logger.error('EventHub not initialized');
      return;
    }
    
    // Cast to any to access implementation methods not in abstract interface
    const eventHubImpl = this.eventHub as any;
    const queueManager = eventHubImpl.getQueueManager();
    
    const queueConfigs: QueueConfig[] = [
      {
        name: 'order-processing',
        persistent: true,
        maxQueueSize: 1000
      },
      {
        name: 'payment-processing',
        persistent: true,
        maxQueueSize: 500
      },
      {
        name: 'notifications',
        persistent: false,
        maxQueueSize: 100
      }
    ];
    
    for (const config of queueConfigs) {
      try {
        const createResult = await queueManager.createQueue(config);
        if (Either.isLeft(createResult)) {
          const errorMaybe = Either.getLeft(createResult);
          const errorMessage = errorMaybe.isJust() ? 'Queue creation failed' : 'Unknown error';
          this.logger.warn(`Failed to create queue ${ config.name }:`, errorMessage);
        } else {
          this.logger.info(`✅ Created queue: ${ config.name }`);
        }
      } catch (error) {
        this.logger.warn(`Error creating queue ${ config.name }: ${ error }`);
      }
    }
  }
  
  /**
   * Basic queue message sending and processing
   */
  private async basicQueueExample(): Promise<void> {
    this.logger.info('\n📦 Basic Queue Example');
    
    if (!this.eventHub) return;
    
    // Cast to any to access implementation methods not in abstract interface
    const eventHubImpl = this.eventHub as any;
    const messageSender = eventHubImpl.getMessageSender();
    const messageReceiver = eventHubImpl.getMessageReceiver();
    
    // Set up order processing consumer - simulate consuming messages
    this.logger.info('🛒 Setting up order processing consumer...');
    
    // Create and send order messages
    const orders: OrderProcessingMessage[] = [
      {
        orderId: 'ORD-001',
        customerId: 'CUST-123',
        items: [
          { productId: 'PROD-A', quantity: 2, price: 29.99 },
          { productId: 'PROD-B', quantity: 1, price: 49.99 }
        ],
        totalAmount: 109.97,
        timestamp: new Date()
      },
      {
        orderId: 'ORD-002',
        customerId: 'CUST-456',
        items: [
          { productId: 'PROD-C', quantity: 1, price: 199.99 }
        ],
        totalAmount: 199.99,
        timestamp: new Date()
      }
    ];
    
    for (const orderData of orders) {
      const sendResult = await messageSender.send('order-processing', orderData, EventPriority.NORMAL);
      if (Either.isLeft(sendResult)) {
        const errorMaybe = Either.getLeft(sendResult);
        const errorMessage = errorMaybe.isJust() ? 'Message send failed' : 'Unknown error';
        this.logger.error('Failed to send to queue:', errorMessage);
      } else {
        this.logger.info(`📤 Sent order ${ orderData.orderId } to queue`);
      }
    }
    
    // Simulate processing messages from queue
    this.logger.info('🔄 Processing messages from order-processing queue...');
    for (let i = 0; i < orders.length; i++) {
      const receiveResult = await messageReceiver.receive('order-processing');
      if (Either.isRight(receiveResult)) {
        const messageMaybe = receiveResult.right
        if (messageMaybe.isJust()) {
          const orderData = messageMaybe.value as OrderProcessingMessage
          if (orderData) {
            this.logger.info('🛒 Processing order:', JSON.stringify({
              orderId: orderData.orderId,
              customerId: orderData.customerId,
              totalAmount: orderData.totalAmount,
              itemCount: orderData.items.length
            }));
            
            // Simulate order processing time
            await new Promise(resolve => setTimeout(resolve, 100));
            
            this.logger.info(`✅ Order ${ orderData.orderId } processed successfully`);
          }
        }
      }
    }
    
    // Wait for processing
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  /**
   * Priority queue processing example
   */
  private async priorityQueueExample(): Promise<void> {
    this.logger.info('\n⭐ Priority Queue Example');
    
    if (!this.eventHub) return;
    
    // Cast to any to access implementation methods not in abstract interface
    const eventHubImpl = this.eventHub as any;
    const messageSender = eventHubImpl.getMessageSender();
    const messageReceiver = eventHubImpl.getMessageReceiver();
    
    // Send payments with different priorities
    const payments: PaymentProcessingMessage[] = [
      {
        paymentId: 'PAY-001',
        orderId: 'ORD-001',
        amount: 109.97,
        paymentMethod: 'credit_card',
        timestamp: new Date()
      },
      {
        paymentId: 'PAY-002',
        orderId: 'ORD-002',
        amount: 1999.99,
        paymentMethod: 'bank_transfer',
        timestamp: new Date()
      },
      {
        paymentId: 'PAY-003',
        orderId: 'ORD-003',
        amount: 49.99,
        paymentMethod: 'paypal',
        timestamp: new Date()
      }
    ];
    
    const priorities = [EventPriority.NORMAL, EventPriority.HIGH, EventPriority.NORMAL];
    
    // Send in mixed order - high priority should be processed first
    for (let i = 0; i < payments.length; i++) {
      await messageSender.send('payment-processing', payments[i], priorities[i]);
      this.logger.info(
        `📤 Sent ${ priorities[i] === EventPriority.HIGH ? 'HIGH' : 'NORMAL' } priority payment ${ payments[i].paymentId }`);
    }
    
    // Process payments (high priority should come first)
    this.logger.info('🔄 Processing payments in priority order...');
    for (let i = 0; i < payments.length; i++) {
      const receiveResult = await messageReceiver.receive('payment-processing');
      if (Either.isRight(receiveResult)) {
        const messageMaybe = receiveResult.right
        if (messageMaybe.isJust()) {
          const paymentData = messageMaybe.value as PaymentProcessingMessage;
          if (paymentData) {
            this.logger.info(`💳 Processing payment:`, JSON.stringify({
              paymentId: paymentData.paymentId,
              orderId: paymentData.orderId,
              amount: paymentData.amount,
              method: paymentData.paymentMethod
            }));
            
            // Simulate payment processing
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  /**
   * Batch processing example
   */
  private async batchProcessingExample(): Promise<void> {
    this.logger.info('\n📊 Batch Processing Example');
    
    if (!this.eventHub) return;
    
    // Cast to any to access implementation methods not in abstract interface
    const eventHubImpl = this.eventHub as any;
    const messageSender = eventHubImpl.getMessageSender();
    const messageReceiver = eventHubImpl.getMessageReceiver();
    
    // Create batch of notifications
    const notifications = Array.from({ length: 5 }, (
      _,
      i
    ) => ({
      type: (i % 3 === 0 ? 'email' : i % 3 === 1 ? 'sms' : 'push') as 'email' | 'sms' | 'push',
      recipient: `user${ i }@example.com`,
      subject: `Notification ${ i + 1 }`,
      message: `This is notification message ${ i + 1 }`,
      timestamp: new Date()
    }));
    
    // Send batch
    this.logger.info(`📤 Sending batch of ${ notifications.length } notifications`);
    for (const notification of notifications) {
      await messageSender.send('notifications', notification, EventPriority.LOW);
    }
    
    // Process batch
    this.logger.info('🔄 Processing notification batch...');
    for (let i = 0; i < notifications.length; i++) {
      const receiveResult = await messageReceiver.receive('notifications');
      if (Either.isRight(receiveResult)) {
        const messageMaybe = receiveResult.right;
        if (messageMaybe.isJust()) {
          const notificationData = messageMaybe.value as NotificationMessage;
          if (notificationData) {
            this.logger.info(`📧 Sending ${ notificationData.type } notification to ${ notificationData.recipient }:`,
              JSON.stringify({
                subject: notificationData.subject,
                messageLength: notificationData.message.length
              })
            );
          }
        }
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  /**
   * Queue metrics and monitoring example
   */
  private async queueMetricsExample(): Promise<void> {
    this.logger.info('\n📈 Queue Metrics Example');
    
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
export const runQueueExample = async (): Promise<void> => {
  const example = new QueueExample();
  await example.run();
};

runQueueExample().catch(console.error);

// // Run example if called directly
// if (require.main === module) {
//   runQueueExample().catch(console.error);
// }
