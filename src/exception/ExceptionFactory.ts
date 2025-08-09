/**
 * @fileoverview Unified Exception Factory
 *
 * Centralized exception creation with consistent patterns, built-in error chaining support,
 * and automatic context generation. Provides the main entry point for creating exceptions
 * across all modules with information preservation.
 */

import { ErrorChain } from "./ErrorChain";
import { UnifiedErrorCode } from "./ErrorCodes";
import {
  ErrorContext,
  Exception,
  GenericException
} from "./Exception";

/**
 * Configuration options for exception creation
 */
export interface ExceptionFactoryOptions {
  /** Custom message override */
  customMessage?: string;
  /** Additional context data */
  additionalData?: Record<string, unknown>;
  /** Whether to include stack traces from source errors */
  includeSourceStacks?: boolean;
  /** Custom timestamp (defaults to current time) */
  timestamp?: Date;
}

/**
 * Centralized factory for creating exceptions with consistent patterns
 * and automatic context generation
 */
export class ExceptionFactory {
  /**
   * Create exception with automatic context generation
   */
  static create(
    code: UnifiedErrorCode,
    message: string,
    module: string,
    operation?: string,
    cause?: Error | Exception,
    additionalData?: Record<string, unknown>
  ): Exception {
    const context: ErrorContext = {
      timestamp: new Date(),
      module,
      ...(operation !== undefined && { operation }),
      ...(additionalData !== undefined && { additionalData })
    };
    
    return new GenericException(code, message, context, cause);
  }
  
  /**
   * Create exception with explicit context
   */
  static createWithContext(
    code: UnifiedErrorCode,
    message: string,
    context: ErrorContext,
    cause?: Error | Exception
  ): Exception {
    return new GenericException(code, message, context, cause);
  }
  
  /**
   * Create chained exception preserving source information from multiple errors
   */
  static createChained(
    code: UnifiedErrorCode,
    message: string,
    context: ErrorContext,
    ...sourceErrors: (Error | Exception)[]
  ): Exception {
    return ErrorChain.chainErrors(code, message, context, ...sourceErrors);
  }
  
  /**
   * Convert and preserve - main utility for error conversion
   * This is the core method that solves the information loss problem
   */
  static convertAndPreserve<T extends Exception>(
    sourceError: Error | Exception,
    targetCode: UnifiedErrorCode,
    targetModule: string,
    operation: string,
    customMessage?: string,
    options?: ExceptionFactoryOptions
  ): T {
    // Generate context for the conversion
    const context: ErrorContext = {
      timestamp: options?.timestamp || new Date(),
      operation,
      module: targetModule,
      additionalData: {
        ...options?.additionalData,
        conversion: {
          sourceType: sourceError instanceof Exception ? 'Exception' : 'Error',
          sourceName: sourceError.constructor.name,
          convertedAt: new Date().toISOString(),
          ...(sourceError instanceof Exception && {
            sourceModule: sourceError.context.module,
            sourceOperation: sourceError.context.operation,
            sourceChainDepth: sourceError.getChainDepth()
          })
        },
        ...(options?.includeSourceStacks && {
          sourceStack: sourceError.stack
        })
      }
    };
    
    // Use custom message or derive from source
    const message = customMessage || this.deriveConversionMessage(sourceError, targetCode, targetModule);
    
    // Create the converted exception with preserved information
    return ErrorChain.convertError<T>(sourceError, targetCode, context, message);
  }
  
  /**
   * Create exception for common dependency resolution failures
   */
  static dependencyResolutionFailed(
    serviceName: string,
    module: string,
    operation: string,
    cause?: Error | Exception,
    additionalContext?: Record<string, unknown>
  ): Exception {
    return this.create(
      UnifiedErrorCode.DEPENDENCY_RESOLUTION_FAILED,
      `Failed to resolve dependency: ${ serviceName }`,
      module,
      operation,
      cause,
      {
        serviceName,
        scenario: 'dependency-resolution',
        ...additionalContext
      }
    );
  }
  
  /**
   * Create exception for service registration failures
   */
  static serviceRegistrationFailed(
    serviceName: string,
    module: string,
    operation: string,
    cause?: Error | Exception,
    additionalContext?: Record<string, unknown>
  ): Exception {
    return this.create(
      UnifiedErrorCode.SERVICE_REGISTRATION_FAILED,
      `Failed to register service: ${ serviceName }`,
      module,
      operation,
      cause,
      {
        serviceName,
        scenario: 'service-registration',
        ...additionalContext
      }
    );
  }
  
  /**
   * Create exception for service resolution failures
   */
  static serviceResolutionFailed(
    serviceName: string,
    module: string,
    operation: string,
    cause?: Error | Exception,
    additionalContext?: Record<string, unknown>
  ): Exception {
    return this.create(
      UnifiedErrorCode.SERVICE_RESOLUTION_FAILED,
      `Failed to resolve service: ${ serviceName }`,
      module,
      operation,
      cause,
      {
        serviceName,
        scenario: 'service-resolution',
        ...additionalContext
      }
    );
  }
  
  /**
   * Create exception for configuration validation failures
   */
  static configurationValidationFailed(
    configPath: string,
    validationError: string,
    operation: string,
    cause?: Error | Exception,
    additionalContext?: Record<string, unknown>
  ): Exception {
    return this.create(
      UnifiedErrorCode.CONFIGURATION_VALIDATION_FAILED,
      `Configuration validation failed for ${ configPath }: ${ validationError }`,
      'CONFIG',
      operation,
      cause,
      {
        configPath,
        validationError,
        scenario: 'config-validation',
        ...additionalContext
      }
    );
  }
  
  /**
   * Create exception for plugin lifecycle failures
   */
  static pluginLifecycleFailure(
    pluginId: string,
    lifecyclePhase: string,
    operation: string,
    cause?: Error | Exception,
    additionalContext?: Record<string, unknown>
  ): Exception {
    return this.create(
      this.getPluginLifecycleErrorCode(lifecyclePhase),
      `Plugin ${ pluginId } failed during ${ lifecyclePhase } phase`,
      'PLUGIN',
      operation,
      cause,
      {
        pluginId,
        lifecyclePhase,
        scenario: 'plugin-lifecycle',
        ...additionalContext
      }
    );
  }
  
  /**
   * Create exception for registry operation failures
   */
  static registryOperationFailed(
    registryOperation: string,
    entryName?: string,
    operation?: string,
    cause?: Error | Exception,
    additionalContext?: Record<string, unknown>
  ): Exception {
    const message = entryName
      ? `Registry ${ registryOperation } failed for entry: ${ entryName }`
      : `Registry ${ registryOperation } failed`;
    
    return this.create(
      this.getRegistryErrorCode(registryOperation),
      message,
      'REGISTRY',
      operation || registryOperation,
      cause,
      {
        registryOperation,
        entryName,
        scenario: 'registry-operation',
        ...additionalContext
      }
    );
  }
  
  /**
   * Create exception for resource access failures
   */
  static resourceAccessFailed(
    resourcePath: string,
    accessType: string,
    module: string,
    operation: string,
    cause?: Error | Exception,
    additionalContext?: Record<string, unknown>
  ): Exception {
    return this.create(
      this.getResourceErrorCode(accessType),
      `Resource ${ accessType } failed for: ${ resourcePath }`,
      module,
      operation,
      cause,
      {
        resourcePath,
        accessType,
        scenario: 'resource-access',
        ...additionalContext
      }
    );
  }
  
  /**
   * Create exception for event hub operation failures
   */
  static eventHubOperationFailed(
    eventOperation: string,
    topicOrQueue?: string,
    operation?: string,
    cause?: Error | Exception,
    additionalContext?: Record<string, unknown>
  ): Exception {
    const message = topicOrQueue
      ? `EventHub ${ eventOperation } failed for: ${ topicOrQueue }`
      : `EventHub ${ eventOperation } failed`;
    
    return this.create(
      this.getEventHubErrorCode(eventOperation),
      message,
      'EVENT_HUB',
      operation || eventOperation,
      cause,
      {
        eventOperation,
        topicOrQueue,
        scenario: 'eventhub-operation',
        ...additionalContext
      }
    );
  }
  
  /**
   * Wrap multiple exceptions into a single aggregated exception
   */
  static aggregateErrors(
    primaryCode: UnifiedErrorCode,
    primaryMessage: string,
    module: string,
    operation: string,
    errors: (Error | Exception)[],
    additionalContext?: Record<string, unknown>
  ): Exception {
    const context: ErrorContext = {
      timestamp: new Date(),
      operation,
      module,
      additionalData: {
        scenario: 'error-aggregation',
        errorCount: errors.length,
        ...additionalContext
      }
    };
    
    return this.createChained(primaryCode, primaryMessage, context, ...errors);
  }
  
  /**
   * Create a timeout exception
   */
  static timeoutError(
    operation: string,
    module: string,
    timeoutMs: number,
    additionalContext?: Record<string, unknown>
  ): Exception {
    return this.create(
      UnifiedErrorCode.TIMEOUT_ERROR,
      `Operation '${ operation }' timed out after ${ timeoutMs }ms`,
      module,
      operation,
      undefined,
      {
        timeoutMs,
        scenario: 'timeout',
        ...additionalContext
      }
    );
  }
  
  /**
   * Create a validation error
   */
  static validationError(
    validationTarget: string,
    validationMessage: string,
    module: string,
    operation: string,
    cause?: Error | Exception,
    additionalContext?: Record<string, unknown>
  ): Exception {
    return this.create(
      UnifiedErrorCode.CONFIGURATION_VALIDATION_FAILED,
      `Validation failed for ${ validationTarget }: ${ validationMessage }`,
      module,
      operation,
      cause,
      {
        validationTarget,
        validationMessage,
        scenario: 'validation',
        ...additionalContext
      }
    );
  }
  
  // Private helper methods
  
  /**
   * Derive appropriate message for error conversion
   */
  private static deriveConversionMessage(
    sourceError: Error | Exception,
    targetCode: UnifiedErrorCode,
    targetModule: string
  ): string {
    const baseMessage = sourceError.message;
    
    if (sourceError instanceof Exception) {
      const sourceModules = sourceError.getInvolvedModules();
      const moduleFlow = sourceModules.length > 0 ? sourceModules.join(' → ') + ' → ' : '';
      return `${ baseMessage } (converted: ${ moduleFlow }${ targetModule })`;
    } else {
      return `${ baseMessage } (converted to ${ targetModule }: ${ targetCode })`;
    }
  }
  
  /**
   * Get appropriate error code for plugin lifecycle phase
   */
  private static getPluginLifecycleErrorCode(phase: string): UnifiedErrorCode {
    switch (phase.toLowerCase()) {
      case 'load':
      case 'loading':
        return UnifiedErrorCode.PLUGIN_LOAD_LIFECYCLE_FAILED;
      case 'start':
      case 'starting':
        return UnifiedErrorCode.PLUGIN_START_LIFECYCLE_FAILED;
      case 'stop':
      case 'stopping':
        return UnifiedErrorCode.PLUGIN_STOP_LIFECYCLE_FAILED;
      case 'pause':
      case 'pausing':
        return UnifiedErrorCode.PLUGIN_PAUSE_LIFECYCLE_FAILED;
      case 'resume':
      case 'resuming':
        return UnifiedErrorCode.PLUGIN_RESUME_LIFECYCLE_FAILED;
      case 'destroy':
      case 'destroying':
        return UnifiedErrorCode.PLUGIN_DESTROY_LIFECYCLE_FAILED;
      case 'cleanup':
        return UnifiedErrorCode.PLUGIN_CLEANUP_FAILED;
      case 'health-check':
        return UnifiedErrorCode.PLUGIN_HEALTH_CHECK_FAILED;
      case 'initialize':
      case 'initialization':
      default:
        return UnifiedErrorCode.PLUGIN_INITIALIZATION_FAILED;
    }
  }
  
  /**
   * Get appropriate error code for registry operations
   */
  private static getRegistryErrorCode(operation: string): UnifiedErrorCode {
    switch (operation.toLowerCase()) {
      case 'register':
      case 'registration':
        return UnifiedErrorCode.REGISTRATION_FAILED;
      case 'unregister':
      case 'unregistration':
        return UnifiedErrorCode.UNREGISTRATION_FAILED;
      case 'resolve':
      case 'resolution':
        return UnifiedErrorCode.REGISTRY_RESOLUTION_FAILED;
      case 'lookup':
        return UnifiedErrorCode.REGISTRY_ENTRY_NOT_FOUND;
      default:
        return UnifiedErrorCode.REGISTRY_RESOLUTION_FAILED;
    }
  }
  
  /**
   * Get appropriate error code for resource access types
   */
  private static getResourceErrorCode(accessType: string): UnifiedErrorCode {
    switch (accessType.toLowerCase()) {
      case 'read':
      case 'access':
        return UnifiedErrorCode.RESOURCE_ACCESS_DENIED;
      case 'create':
      case 'creation':
        return UnifiedErrorCode.RESOURCE_CREATION_FAILED;
      case 'delete':
      case 'deletion':
        return UnifiedErrorCode.RESOURCE_DELETION_FAILED;
      case 'modify':
      case 'modification':
      case 'update':
        return UnifiedErrorCode.RESOURCE_MODIFICATION_FAILED;
      case 'lock':
        return UnifiedErrorCode.RESOURCE_LOCKED;
      case 'not-found':
      case 'missing':
        return UnifiedErrorCode.RESOURCE_NOT_FOUND;
      default:
        return UnifiedErrorCode.RESOURCE_UNAVAILABLE;
    }
  }
  
  /**
   * Get appropriate error code for event hub operations
   */
  private static getEventHubErrorCode(operation: string): UnifiedErrorCode {
    switch (operation.toLowerCase()) {
      case 'publish':
      case 'send':
        return UnifiedErrorCode.CONTEXT_TOPIC_PUBLISH_FAILED;
      case 'subscribe':
        return UnifiedErrorCode.CONTEXT_TOPIC_SUBSCRIBE_FAILED;
      case 'unsubscribe':
        return UnifiedErrorCode.CONTEXT_TOPIC_SUBSCRIBE_FAILED; // Reuse subscribe failed for unsubscribe
      case 'create-topic':
        return UnifiedErrorCode.CONTEXT_TOPIC_CREATION_FAILED;
      case 'delete-topic':
        return UnifiedErrorCode.CONTEXT_TOPIC_DELETION_FAILED;
      case 'create-queue':
        return UnifiedErrorCode.CONTEXT_QUEUE_CREATION_FAILED;
      case 'delete-queue':
        return UnifiedErrorCode.CONTEXT_QUEUE_DELETION_FAILED;
      case 'process':
      case 'processing':
        return UnifiedErrorCode.EVENT_PROCESSING_FAILED;
      case 'validate':
      case 'validation':
        return UnifiedErrorCode.EVENT_VALIDATION_FAILED;
      case 'serialize':
      case 'serialization':
        return UnifiedErrorCode.EVENT_SERIALIZATION_FAILED;
      case 'deserialize':
      case 'deserialization':
        return UnifiedErrorCode.EVENT_DESERIALIZATION_FAILED;
      case 'route':
      case 'routing':
        return UnifiedErrorCode.EVENT_ROUTING_FAILED;
      case 'deliver':
      case 'delivery':
        return UnifiedErrorCode.EVENT_DELIVERY_FAILED;
      default:
        return UnifiedErrorCode.EVENT_PROCESSING_FAILED;
    }
  }
}
