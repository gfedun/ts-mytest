/**
 * @fileoverview Logger Namespace Example
 *
 * This example demonstrates how to use the namespace functionality
 * with both Pino and Console loggers. The namespace will be displayed
 * surrounded by brackets in the log output.
 *
 * @author
 * @version 1.0.0
 */

import { ConsoleLoggerFactory } from "@/logger";
import { PinoLoggerFactoryImpl } from '../PinoLoggerFactory';
import { LogLevel } from '../types';

/**
 * Example demonstrating namespace functionality
 */
export class NamespaceExample {
  
  /**
   * Demonstrate Console Logger with namespace
   */
  static demonstrateConsoleLogger() {
    console.log('\n=== Console Logger with Namespace ===');
    
    // Create a console logger with namespace
    const logger = ConsoleLoggerFactory.createLogger({
      level: LogLevel.INFO,
      namespace: 'XMicrokernel',
      prettyPrint: true
    });
    
    logger.info('Starting microkernel initialization');
    logger.warn('Configuration file not found, using defaults');
    logger.error('Failed to load plugin', { plugin: 'auth-service' });
    logger.debug('Debug message (should not appear due to log level)');
    
    // Create a child logger with additional context
    const childLogger = logger.child({ component: 'ServiceRegistry' });
    childLogger.info('Service registry initialized');
    childLogger.error('Service registration failed', { serviceName: 'user-service' });
  }
  
  /**
   * Demonstrate Pino Logger with namespace
   */
  static demonstratePinoLogger() {
    console.log('\n=== Pino Logger with Namespace ===');
    
    // Create a Pino logger with namespace
    const pinoFactory = new PinoLoggerFactoryImpl();
    const logger = pinoFactory.createLogger({
      level: LogLevel.INFO,
      namespace: 'DataProcessor',
      prettyPrint: true
    });
    
    logger.info('Data processing pipeline started');
    logger.warn('Low memory warning', { availableMemory: '128MB' });
    logger.error('Processing failed for batch', { batchId: 'batch-001', reason: 'timeout' });
    
    // Create a child logger
    const childLogger = logger.child({ module: 'ValidationEngine' });
    childLogger.info('Validation engine ready');
    childLogger.error('Validation failed', { field: 'email', value: 'invalid-email' });
  }
  
  /**
   * Demonstrate multiple loggers with different namespaces
   */
  static demonstrateMultipleNamespaces() {
    console.log('\n=== Multiple Loggers with Different Namespaces ===');
    
    // Create loggers for different components
    const apiLogger = ConsoleLoggerFactory.createLogger({
      level: LogLevel.INFO,
      namespace: 'API',
      prettyPrint: true
    });
    
    const dbLogger = ConsoleLoggerFactory.createLogger({
      level: LogLevel.INFO,
      namespace: 'Database',
      prettyPrint: true
    });
    
    const authLogger = ConsoleLoggerFactory.createLogger({
      level: LogLevel.INFO,
      namespace: 'Auth',
      prettyPrint: true
    });
    
    // Simulate application flow
    apiLogger.info('Received HTTP request', { method: 'POST', path: '/api/users' });
    authLogger.info('Authenticating user', { userId: 'user-123' });
    authLogger.warn('Invalid token provided');
    dbLogger.info('Executing query', { table: 'users', operation: 'INSERT' });
    dbLogger.error('Database connection timeout');
    apiLogger.error('Request failed', { statusCode: 500, error: 'Internal Server Error' });
  }
  
  /**
   * Run all examples
   */
  static runAll() {
    console.log('Logger Namespace Examples');
    console.log('========================');
    
    this.demonstrateConsoleLogger();
    this.demonstratePinoLogger();
    this.demonstrateMultipleNamespaces();
    
    console.log('\nExamples completed!');
    console.log('\nNotice how the namespace appears in brackets [NameSpace] before each log message.');
  }
}

// Export for use in other modules
export default NamespaceExample;
