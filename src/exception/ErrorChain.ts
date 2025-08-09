/**
 * @fileoverview Error Conversion and Chaining Utilities
 *
 * Provides utilities for safe error conversion with information preservation,
 * error chaining mechanisms, and factory methods for common error scenarios.
 */

import { UnifiedErrorCode } from "./ErrorCodes";
import {
  AggregatedErrorInfo,
  ErrorContext,
  Exception,
  GenericException
} from "./Exception";

/**
 * Utility class for error chaining and conversion operations
 */
export class ErrorChain {
  /**
   * Convert error from one type to another while preserving all information
   */
  static convertError<T extends Exception>(
    sourceError: Error | Exception,
    targetCode: UnifiedErrorCode,
    targetContext: ErrorContext,
    targetMessage?: string,
    TargetClass?: new (
      code: UnifiedErrorCode,
      message: string,
      context: ErrorContext,
      cause?: Error | Exception
    ) => T
  ): T {
    // Use provided message or derive from source error
    const message = targetMessage || this.deriveMessage(sourceError, targetCode);
    
    // If no specific target class provided, use GenericException
    if (!TargetClass) {
      return new GenericException(targetCode, message, targetContext, sourceError) as T;
    }
    
    // Create new exception with preserved information
    return new TargetClass(targetCode, message, targetContext, sourceError);
  }
  
  /**
   * Chain multiple errors together into a single aggregated exception
   */
  static chainErrors(
    primaryCode: UnifiedErrorCode,
    primaryMessage: string,
    primaryContext: ErrorContext,
    ...errors: (Error | Exception)[]
  ): Exception {
    const chainedException = new GenericException(primaryCode, primaryMessage, primaryContext);
    
    // Add all errors to the chain
    for (const error of errors) {
      if (error instanceof Exception) {
        // If it's already an Exception, add all its aggregated errors
        for (const aggregatedError of error.aggregatedErrors) {
          chainedException.addError(aggregatedError);
        }
      } else {
        // If it's a regular Error, wrap it in aggregated info
        const errorInfo: AggregatedErrorInfo = {
          code: UnifiedErrorCode.UNKNOWN_ERROR,
          message: error.message,
          context: {
            timestamp: new Date(),
            module: 'UNKNOWN',
            operation: 'error-chaining',
            additionalData: { originalErrorName: error.name, stack: error.stack }
          },
          originalError: error
        };
        chainedException.addError(errorInfo);
      }
    }
    
    return chainedException;
  }
  
  /**
   * Extract all information from error chain
   */
  static extractChainInfo(error: Error | Exception): {
    messages: string[];
    contexts: ErrorContext[];
    codes: UnifiedErrorCode[];
    timeline: Date[];
  } {
    if (error instanceof Exception) {
      return {
        messages: error.getAllMessages(),
        contexts: error.getAllContexts(),
        codes: error.getAllCodes(),
        timeline: error.getTimeline()
      };
    } else {
      // Handle regular Error objects
      return {
        messages: [error.message],
        contexts: [{
          timestamp: new Date(),
          module: 'UNKNOWN',
          operation: 'extract-info',
          additionalData: { originalErrorName: error.name }
        }],
        codes: [UnifiedErrorCode.UNKNOWN_ERROR],
        timeline: [new Date()]
      };
    }
  }
  
  /**
   * Merge multiple error chains into a single comprehensive chain
   */
  static mergeChains(
    primaryError: Exception,
    ...secondaryErrors: Exception[]
  ): Exception {
    const mergedError = new GenericException(
      primaryError.code,
      `Merged error chain: ${ primaryError.message }`,
      {
        ...primaryError.context,
        operation: 'chain-merge',
        additionalData: {
          ...primaryError.context.additionalData,
          mergedChainCount: secondaryErrors.length + 1
        }
      }
    );
    
    // Add primary error's chain
    for (const aggregatedError of primaryError.aggregatedErrors) {
      mergedError.addError(aggregatedError);
    }
    
    // Add secondary errors' chains
    for (const secondaryError of secondaryErrors) {
      for (const aggregatedError of secondaryError.aggregatedErrors) {
        mergedError.addError(aggregatedError);
      }
    }
    
    return mergedError;
  }
  
  /**
   * Find the root cause in an error chain
   */
  static findRootCause(error: Exception): Error | Exception {
    if (error.aggregatedErrors.length === 0) {
      return error;
    }
    
    // Find the oldest error in the chain
    const oldestError = error.aggregatedErrors
      .reduce((
          oldest,
          current
        ) =>
          current.context.timestamp < oldest.context.timestamp ? current : oldest
      );
    
    return oldestError.originalError || error;
  }
  
  /**
   * Filter error chain by specific criteria
   */
  static filterChain(
    error: Exception,
    criteria: {
      codes?: UnifiedErrorCode[];
      modules?: string[];
      operations?: string[];
    }
  ): AggregatedErrorInfo[] {
    return error.aggregatedErrors.filter(aggregatedError => {
      if (criteria.codes && !criteria.codes.includes(aggregatedError.code)) {
        return false;
      }
      if (criteria.modules && !criteria.modules.includes(aggregatedError.context.module)) {
        return false;
      }
      if (criteria.operations && aggregatedError.context.operation &&
        !criteria.operations.includes(aggregatedError.context.operation)) {
        return false;
      }
      return true;
    });
  }
  
  /**
   * Derive appropriate message for error conversion
   */
  private static deriveMessage(
    sourceError: Error | Exception,
    targetCode: UnifiedErrorCode
  ): string {
    const baseMessage = sourceError.message;
    
    if (sourceError instanceof Exception) {
      const modules = sourceError.getInvolvedModules().join(' → ');
      return `${ baseMessage } (converted from ${ modules } chain to ${ targetCode })`;
    } else {
      return `${ baseMessage } (converted to ${ targetCode })`;
    }
  }
}

/**
 * Specialized error converter with type-safe conversion methods
 */
export class ErrorConverter {
  /**
   * Safe conversion preserving all context - Generic method
   */
  static convert<T extends Exception>(
    sourceError: Error | Exception,
    targetCode: UnifiedErrorCode,
    targetModule: string,
    operation: string,
    additionalContext?: Record<string, unknown>,
    TargetClass?: new (
      code: UnifiedErrorCode,
      message: string,
      context: ErrorContext,
      cause?: Error | Exception
    ) => T
  ): T {
    const context: ErrorContext = {
      timestamp: new Date(),
      operation,
      module: targetModule,
      additionalData: {
        ...additionalContext,
        convertedFrom: sourceError instanceof Exception ?
          sourceError.getInvolvedModules().join(' → ') :
          sourceError.constructor.name
      }
    };
    
    return ErrorChain.convertError(sourceError, targetCode, context, undefined, TargetClass);
  }
  
  /**
   * Convert to PluginError with context preservation
   */
  static toPluginError(
    sourceError: Error | Exception,
    operation: string,
    pluginCode: UnifiedErrorCode = UnifiedErrorCode.UNKNOWN_ERROR,
    additionalContext?: Record<string, unknown>
  ): Exception {
    return this.convert(
      sourceError,
      pluginCode,
      'PLUGIN',
      operation,
      additionalContext
    );
  }
  
  /**
   * Convert to RegistryError with context preservation
   */
  static toRegistryError(
    sourceError: Error | Exception,
    operation: string,
    registryCode: UnifiedErrorCode = UnifiedErrorCode.REGISTRY_RESOLUTION_FAILED,
    additionalContext?: Record<string, unknown>
  ): Exception {
    return this.convert(
      sourceError,
      registryCode,
      'REGISTRY',
      operation,
      additionalContext
    );
  }
  
  /**
   * Convert to ServiceError with context preservation
   */
  static toServiceError(
    sourceError: Error | Exception,
    operation: string,
    serviceCode: UnifiedErrorCode = UnifiedErrorCode.SERVICE_RESOLUTION_FAILED,
    additionalContext?: Record<string, unknown>
  ): Exception {
    return this.convert(
      sourceError,
      serviceCode,
      'SERVICE',
      operation,
      additionalContext
    );
  }
  
  /**
   * Convert to ContextError with context preservation
   */
  static toContextError(
    sourceError: Error | Exception,
    operation: string,
    contextCode: UnifiedErrorCode = UnifiedErrorCode.CONTEXT_INITIALIZATION_FAILED,
    additionalContext?: Record<string, unknown>
  ): Exception {
    return this.convert(
      sourceError,
      contextCode,
      'CONTEXT',
      operation,
      additionalContext
    );
  }
  
  /**
   * Convert to EventHubError with context preservation
   */
  static toEventHubError(
    sourceError: Error | Exception,
    operation: string,
    eventCode: UnifiedErrorCode = UnifiedErrorCode.EVENT_PROCESSING_FAILED,
    additionalContext?: Record<string, unknown>
  ): Exception {
    return this.convert(
      sourceError,
      eventCode,
      'EVENT_HUB',
      operation,
      additionalContext
    );
  }
  
  /**
   * Convert to ResourceError with context preservation
   */
  static toResourceError(
    sourceError: Error | Exception,
    operation: string,
    resourceCode: UnifiedErrorCode = UnifiedErrorCode.RESOURCE_UNAVAILABLE,
    additionalContext?: Record<string, unknown>
  ): Exception {
    return this.convert(
      sourceError,
      resourceCode,
      'RESOURCE',
      operation,
      additionalContext
    );
  }
  
  /**
   * Convert to ConfigError with context preservation
   */
  static toConfigError(
    sourceError: Error | Exception,
    operation: string,
    configCode: UnifiedErrorCode = UnifiedErrorCode.CONFIG_VALIDATION_FAILED,
    additionalContext?: Record<string, unknown>
  ): Exception {
    return this.convert(
      sourceError,
      configCode,
      'CONFIG',
      operation,
      additionalContext
    );
  }
}

/**
 * Utility class for common error scenarios and patterns
 */
export class ErrorScenarios {
  /**
   * Create error for dependency resolution failure
   */
  static dependencyResolutionFailed(
    serviceName: string,
    operation: string,
    module: string,
    cause?: Error | Exception
  ): Exception {
    return new GenericException(
      UnifiedErrorCode.DEPENDENCY_RESOLUTION_FAILED,
      `Failed to resolve dependency: ${ serviceName }`,
      {
        timestamp: new Date(),
        operation,
        module,
        additionalData: { serviceName, scenario: 'dependency-resolution' }
      },
      cause
    );
  }
  
  /**
   * Create error for service registration failure
   */
  static serviceRegistrationFailed(
    serviceName: string,
    operation: string,
    module: string,
    cause?: Error | Exception
  ): Exception {
    return new GenericException(
      UnifiedErrorCode.SERVICE_REGISTRATION_FAILED,
      `Failed to register service: ${ serviceName }`,
      {
        timestamp: new Date(),
        operation,
        module,
        additionalData: { serviceName, scenario: 'service-registration' }
      },
      cause
    );
  }
  
  /**
   * Create error for configuration validation failure
   */
  static configurationValidationFailed(
    configPath: string,
    validationError: string,
    operation: string,
    cause?: Error | Exception
  ): Exception {
    return new GenericException(
      UnifiedErrorCode.CONFIGURATION_VALIDATION_FAILED,
      `Configuration validation failed for ${ configPath }: ${ validationError }`,
      {
        timestamp: new Date(),
        operation,
        module: 'CONFIG',
        additionalData: { configPath, validationError, scenario: 'config-validation' }
      },
      cause
    );
  }
  
  /**
   * Create error for plugin lifecycle failure
   */
  static pluginLifecycleFailure(
    pluginId: string,
    lifecyclePhase: string,
    operation: string,
    cause?: Error | Exception
  ): Exception {
    return new GenericException(
      UnifiedErrorCode.PLUGIN_INITIALIZATION_FAILED,
      `Plugin ${ pluginId } failed during ${ lifecyclePhase } phase`,
      {
        timestamp: new Date(),
        operation,
        module: 'PLUGIN',
        additionalData: { pluginId, lifecyclePhase, scenario: 'plugin-lifecycle' }
      },
      cause
    );
  }
}
