/**
 * @fileoverview EventHub Factory Implementation
 *
 * This module provides the factory for creating EventHub instances
 * with various configurations and validation.
 *
 * @author
 * @version 1.0.0
 */

import { Either } from '@/either';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Logger } from '@/logger';
import {
  EventHub,
  EventHubImpl
} from './EventHub';
import { EventHubError } from './EventHubError';
import { EventHubConfig } from './types';

/**
 * Configuration error for EventHub factory validation
 */
export class EventHubConfigurationError
  extends EventHubError {
  constructor(
    message: string,
    context: any = {},
    cause?: Error
  ) {
    super(
      UnifiedErrorCode.CONFIGURATION_VALIDATION_FAILED,
      message,
      {
        ...context,
        module: 'EVENTHUB',
        timestamp: new Date()
      },
      {
        canRetry: false,
        suggestions: [
          'Check configuration parameters',
          'Verify required fields are provided',
          'Ensure values are within valid ranges'
        ]
      },
      cause
    );
  }
}

/**
 * Factory creation error for EventHub instances
 */
export class EventHubCreationError
  extends EventHubError {
  constructor(
    message: string,
    context: any = {},
    cause?: Error
  ) {
    super(
      UnifiedErrorCode.EVENTHUB_NOT_INITIALIZED,
      message,
      {
        ...context,
        module: 'EVENTHUB',
        timestamp: new Date()
      },
      {
        canRetry: true,
        retryDelayMs: 1000,
        maxRetries: 3,
        suggestions: [
          'Check logger instance is valid',
          'Verify configuration parameters',
          'Ensure dependencies are available'
        ]
      },
      cause
    );
  }
}

/**
 * Configuration for the EventHub factory
 */
export interface EventHubFactoryConfig {
  readonly defaultRetention?: number;
  readonly defaultQueueSize?: number;
  readonly defaultConcurrency?: number;
}

/**
 * Abstract base class for EventHub factory
 */
export abstract class EventHubFactory {
  
  /**
   * Create a new EventHub factory instance
   */
  static create(factoryConfig: EventHubFactoryConfig = {}): EventHubFactory {
    return new EventHubFactoryImpl(factoryConfig);
  }
  
  /**
   * Create an EventHub instance with custom configuration
   */
  abstract createEventHub(
    name: string,
    logger: Logger,
    config?: Partial<EventHubConfig>
  ): Either<EventHubError, EventHub>;
  
  /**
   * Create an EventHub instance with default configuration
   */
  abstract createDefault(
    name: string,
    logger: Logger
  ): Either<EventHubError, EventHub>;
  
  /**
   * Validate EventHub configuration
   */
  abstract validateConfig(
    name: string,
    config: Partial<EventHubConfig>
  ): Either<EventHubError[], void>;
}

/**
 * Implementation of EventHub factory
 */
export class EventHubFactoryImpl
  extends EventHubFactory {
  
  private readonly factoryConfig: EventHubFactoryConfig;
  
  constructor(factoryConfig: EventHubFactoryConfig = {}) {
    super();
    this.factoryConfig = {
      defaultRetention: 3600000, // 1 hour
      defaultQueueSize: 1000,
      defaultConcurrency: 10,
      ...factoryConfig
    };
  }
  
  /**
   * Create an EventHub instance with the specified configuration
   */
  createEventHub(
    name: string,
    logger: Logger,
    config: Partial<EventHubConfig> = {}
  ): Either<EventHubError, EventHub> {
    try {
      // Validate configuration first
      const validationResult = this.validateConfig(name, config);
      if (Either.isLeft(validationResult)) {
        const errors = Either.getLeft(validationResult);
        if (errors.isJust()) {
          const errorArray = errors.getOrElse([]);
          if (Array.isArray(errorArray) && errorArray.length > 0) {
            return Either.left(errorArray[0]); // Return the first error
          }
        }
        return Either.left(new EventHubConfigurationError('Unknown validation error'));
      }
      
      // Create base configuration with factory defaults
      const finalConfig: EventHubConfig = {
        enableMetrics: config.enableMetrics ?? true,
        eventTimeoutMs: config.eventTimeoutMs ?? 30000,
        ...config
      };
      
      // Create EventHub instance
      const eventHub = new EventHubImpl(name, logger, finalConfig);
      return Either.right(eventHub as EventHub);
      
    } catch (error) {
      return Either.left(new EventHubCreationError(
        `Failed to create EventHub: ${ error instanceof Error ? error.message : String(error) }`,
        { eventHubName: name },
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  /**
   * Create an EventHub instance with default configuration
   */
  createDefault(
    name: string,
    logger: Logger
  ): Either<EventHubError, EventHub> {
    const defaultConfig: Partial<EventHubConfig> = {
      enableMetrics: true,
      eventTimeoutMs: 30000
    };
    
    return this.createEventHub(name, logger, defaultConfig);
  }
  
  /**
   * Validate EventHub configuration parameters
   */
  validateConfig(
    name: string,
    config: Partial<EventHubConfig>
  ): Either<EventHubError[], void> {
    const errors: EventHubError[] = [];
    
    // Validate name
    if (!name || name.trim().length === 0) {
      errors.push(new EventHubConfigurationError(
        'EventHub name is required',
        { providedName: name }
      ));
    }
    
    // Validate event timeout
    if (config.eventTimeoutMs !== undefined && config.eventTimeoutMs <= 0) {
      errors.push(new EventHubConfigurationError(
        'Event timeout must be positive',
        {
          providedTimeout: config.eventTimeoutMs,
          minimumTimeout: 1
        }
      ));
    }
    
    // Validate name format (alphanumeric, hyphens, underscores only)
    if (name && !/^[a-zA-Z0-9_-]+$/.test(name)) {
      errors.push(new EventHubConfigurationError(
        'EventHub name must contain only alphanumeric characters, hyphens, and underscores',
        { providedName: name }
      ));
    }
    
    // Validate name length
    if (name && name.length > 100) {
      errors.push(new EventHubConfigurationError(
        'EventHub name must be 100 characters or less',
        { providedName: name, nameLength: name.length }
      ));
    }
    
    return errors.length > 0
      ? Either.left(errors)
      : Either.right(undefined as void);
  }
  
  /**
   * Get factory configuration for debugging
   */
  getFactoryConfig(): EventHubFactoryConfig {
    return { ...this.factoryConfig };
  }
  
  /**
   * Debug representation of the factory
   */
  toString(): string {
    return `EventHubFactory{defaultRetention:${ this.factoryConfig.defaultRetention },defaultConcurrency:${ this.factoryConfig.defaultConcurrency }}`;
  }
}
