/**
 * @fileoverview NoOp Logger Factory Implementation
 *
 * This module provides a factory for creating NoOpLogger instances.
 * The factory implements the MyLoggerFactory interface to create loggers that do nothing.
 *
 * @author
 * @version 1.0.0
 */

import {
  Logger,
  LoggerBackendFactory,
} from "@/logger/Logger";
import {
  LoggerConfig,
  LoggerFeature
} from "@/logger/types";
import { NoOpLogger } from './NoOpLogger';

/**
 * NoOp logger factory implementation
 *
 * This factory creates NoOpLogger instances that perform no logging operations.
 * Useful for testing environments or when you want to completely disable logging.
 */
export class NoOpLoggerFactoryImpl
  implements LoggerBackendFactory {
  readonly name = 'noop';
  
  /**
   * Creates a new NoOpLogger instance
   * @param config Logger configuration (will be stored but not used for actual logging)
   * @returns A new NoOpLogger instance
   */
  createLogger(config: LoggerConfig = {}): Logger {
    return new NoOpLogger(config);
  }
  
  /**
   * Check if the NoOp factory supports a specific feature
   * @param feature The feature to check
   * @returns false for all features since NoOp doesn't actually log anything
   */
  supportsFeature(feature: LoggerFeature): boolean {
    // NoOp doesn't support any features since it does nothing
    return false;
  }
  
  /**
   * Get the configuration schema for NoOp logger
   * @returns Configuration schema (minimal since NoOp ignores most config)
   */
  getConfigSchema(): Record<string, any> {
    return {
      name: { type: 'string', description: 'Logger name (ignored by NoOp)' },
      level: { type: 'string|number', description: 'Log level (ignored by NoOp)' }
    };
  }
  
  /**
   * Optional initialization method
   * @param globalConfig Global configuration (ignored by NoOp)
   */
  async initialize?(globalConfig?: Record<string, any>): Promise<void> {
    // NoOp - no initialization needed
    return Promise.resolve();
  }
  
  /**
   * Optional shutdown method
   */
  async shutdown?(): Promise<void> {
    // NoOp - no cleanup needed
    return Promise.resolve();
  }
}
