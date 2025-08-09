/**
 * @fileoverview Console Logger Factory Implementation
 *
 * This module provides a factory for creating ConsoleLogger instances.
 * The factory implements the LoggerBackendFactory interface to create console-based loggers.
 *
 * @author
 * @version 1.0.0
 */

import {
  Logger,
  LoggerBackendFactory,
} from "@/logger/Logger";
import { LoggerConfig } from "@/logger/types";
import { ConsoleLogger } from './ConsoleLogger';

/**
 * Console logger factory implementation
 *
 * This factory creates ConsoleLogger instances that output to the console.
 * Useful for development environments and simple logging scenarios where
 * you want immediate console output without additional dependencies.
 */
export class ConsoleLoggerFactoryImpl
  implements LoggerBackendFactory {
  readonly name = 'console';
  
  /**
   * Creates a new ConsoleLogger instance
   * @param config Logger configuration for customizing output format and behavior
   * @returns A new ConsoleLogger instance
   */
  createLogger(config: LoggerConfig = {}): Logger {
    return new ConsoleLogger(config);
  }
  
  /**
   * Get the feature set supported by this logger backend
   * @returns Array of supported features
   */
  getSupportedFeatures(): string[] {
    return [
      'structured-logging',
      'context-binding',
      'child-loggers',
      'timing',
      'metrics',
      'colored-output'
    ];
  }
  
  /**
   * Check if a specific feature is supported
   * @param feature The feature to check
   * @returns True if the feature is supported
   */
  supportsFeature(feature: string): boolean {
    return this.getSupportedFeatures().includes(feature);
  }
}
