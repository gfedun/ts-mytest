/**
 * @fileoverview EventHub Examples Index
 *
 * This module exports all the EventHub examples for easy access and usage.
 * It includes comprehensive examples for Queue (Point-to-Point), Topic (Publish-Subscribe),
 * and Port (External Integration) messaging patterns.
 *
 * @author
 * @version 1.0.0
 */

import { ConsoleLogger } from '@/logger';

// Import all example classes and runners
export {
  QueueExample,
  runQueueExample
} from './QueueExample';
export {
  TopicExample,
  runTopicExample
} from './TopicExample';
export {
  PortExample,
  runPortExample
} from './PortExample';

/**
 * Run all examples in sequence
 */
export async function runAllExamples(): Promise<void> {
  const logger = ConsoleLogger;
  
  logger.info('🚀 Starting EventHub Examples Suite');
  logger.info('=====================================');
  
  try {
    // Import the example runners
    const { runQueueExample } = await import('./QueueExample');
    const { runTopicExample } = await import('./TopicExample');
    const { runPortExample } = await import('./PortExample');
    
    // Run Queue example
    logger.info('\n📦 Running Queue Example...');
    await runQueueExample();
    
    // Small delay between examples
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Run Topic example
    logger.info('\n📢 Running Topic Example...');
    await runTopicExample();
    
    // Small delay between examples
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Run Port example
    logger.info('\n🔌 Running Port Example...');
    await runPortExample();
    
    logger.info('\n✅ All EventHub Examples completed successfully!');
    logger.info('=====================================');
    
  } catch (error) {
    logger.error(`❌ Examples suite failed:${ error }`);
    throw error;
  }
}

/**
 * Example menu for interactive selection
 */
export async function runExampleMenu(): Promise<void> {
  const logger = ConsoleLogger;
  
  logger.info('EventHub Examples Menu');
  logger.info('======================');
  logger.info('1. Queue Example (Point-to-Point Messaging)');
  logger.info('2. Topic Example (Publish-Subscribe Messaging)');
  logger.info('3. Port Example (External System Integration)');
  logger.info('4. Run All Examples');
  logger.info('');
  
  // In a real application, you would get user input here
  // For now, we'll run all examples
  await runAllExamples();
}

// Run if called directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}
