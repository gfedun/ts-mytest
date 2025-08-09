/**
 * @fileoverview BaseRegistry Error System - Unified Edition
 *
 * Comprehensive error handling for the service registry system using the unified
 * error code system with complete error aggregation and information preservation.
 */

import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import {
  ErrorContext,
  Exception
} from '@/exception/Exception';
import { ExceptionFactory } from '@/exception/ExceptionFactory';
import { symbolLoggable } from "@/logger/Loggable";

/**
 * BaseRegistry-specific context information extending the base ErrorContext
 */
export interface ServiceRegistryErrorContext
  extends ErrorContext {
  serviceDescriptor?: string;
  serviceName?: string;
  serviceLifetime?: string;
  registrationCount?: number;
  resolutionChain?: string[];
  interceptorName?: string;
  middlewareName?: string;
  registryType?: string;
  performanceMetrics?: Record<string, number>;
}

/**
 * Recovery suggestions for service registry errors
 */
export interface ServiceRegistryErrorRecovery {
  canRetry: boolean;
  retryDelay?: number;
  maxRetries?: number;
  suggestions: string[];
  alternativeActions?: string[];
}

/**
 * Enhanced RegistryError using the unified exception system
 */
export class ServiceRegistryError
  extends Exception {
  public readonly _tag = "ServiceRegistryError" as const;
  public readonly recovery: ServiceRegistryErrorRecovery;
  
  constructor(
    code: UnifiedErrorCode,
    message: string,
    context: ServiceRegistryErrorContext,
    recovery: Partial<ServiceRegistryErrorRecovery> = {},
    cause?: Error | Exception
  ) {
    const registryContext: ServiceRegistryErrorContext = {
      ...context,
      module: 'REGISTRY',
      timestamp: context.timestamp || new Date()
    };
    
    super(code, message, registryContext, cause);
    // @ts-expect-error
    this[symbolLoggable] = () => this._tag;
    
    this.recovery = {
      canRetry: false,
      suggestions: [],
      alternativeActions: [],
      ...recovery
    };
  }
  
  /**
   * Factory method for easy RegistryError creation
   */
  static create(
    code: UnifiedErrorCode,
    message: string,
    operation: string,
    registryContext: Partial<ServiceRegistryErrorContext> = {},
    recovery?: Partial<ServiceRegistryErrorRecovery>,
    cause?: Error | Exception
  ): ServiceRegistryError {
    const context: ServiceRegistryErrorContext = {
      timestamp: new Date(),
      operation,
      module: 'REGISTRY',
      ...registryContext
    };
    
    return new ServiceRegistryError(code, message, context, recovery, cause);
  }
  
  /**
   * Create service registration error
   */
  static registrationFailed(
    serviceName: string,
    operation: string,
    reason?: string,
    cause?: Error | Exception
  ): ServiceRegistryError {
    return ExceptionFactory.serviceRegistrationFailed(
      serviceName,
      'REGISTRY',
      operation,
      cause,
      { registrationFailureReason: reason }
    ) as ServiceRegistryError;
  }
  
  /**
   * Create service resolution error
   */
  static resolutionFailed(
    serviceName: string,
    operation: string,
    resolutionChain?: string[],
    cause?: Error | Exception
  ): ServiceRegistryError {
    return ServiceRegistryError.create(
      UnifiedErrorCode.REGISTRY_RESOLUTION_FAILED,
      `Failed to resolve service: ${ serviceName }`,
      operation,
      {
        serviceName,
        ...(resolutionChain && { resolutionChain }),
        additionalData: { resolutionAttempt: true }
      },
      {
        canRetry: true,
        retryDelay: 500,
        maxRetries: 2,
        suggestions: [
          'Check if the service is properly registered',
          'Verify service dependencies are available',
          'Check for circular dependencies'
        ]
      },
      cause
    );
  }
  
  /**
   * Create service not found error
   */
  static serviceNotFound(
    serviceName: string,
    operation: string,
    availableServices?: string[]
  ): ServiceRegistryError {
    return ServiceRegistryError.create(
      UnifiedErrorCode.REGISTRY_ENTRY_NOT_FOUND,
      `Service '${ serviceName }' not found in registry`,
      operation,
      {
        serviceName,
        additionalData: {
          availableServices,
          lookupAttempt: true
        }
      },
      {
        canRetry: false,
        suggestions: [
          'Register the service before attempting to resolve',
          'Check service name spelling',
          availableServices?.length ? `Available services: ${ availableServices.join(
            ', ') }` : 'No services currently registered'
        ].filter(Boolean)
      }
    );
  }
  
  /**
   * Create circular dependency error
   */
  static circularDependency(
    serviceName: string,
    dependencyChain: string[],
    operation: string
  ): ServiceRegistryError {
    return ServiceRegistryError.create(
      UnifiedErrorCode.CIRCULAR_DEPENDENCY,
      `Circular dependency detected for service '${ serviceName }': ${ dependencyChain.join(' → ') }`,
      operation,
      {
        serviceName,
        resolutionChain: dependencyChain,
        additionalData: { circularDependencyDetected: true }
      },
      {
        canRetry: false,
        suggestions: [
          'Review service dependencies to break circular references',
          'Use lazy initialization for one of the circular dependencies',
          'Refactor services to reduce coupling'
        ],
        alternativeActions: [
          'Use dependency injection patterns',
          'Implement service locator pattern'
        ]
      }
    );
  }
  
  /**
   * Create factory execution error
   */
  static factoryExecutionFailed(
    serviceName: string,
    operation: string,
    factoryError: string,
    cause?: Error | Exception
  ): ServiceRegistryError {
    return ServiceRegistryError.create(
      UnifiedErrorCode.FACTORY_EXECUTION_FAILED,
      `Factory execution failed for service '${ serviceName }': ${ factoryError }`,
      operation,
      {
        serviceName,
        additionalData: { factoryError, factoryExecution: true }
      },
      {
        canRetry: true,
        retryDelay: 1000,
        maxRetries: 1,
        suggestions: [
          'Check factory function implementation',
          'Verify factory dependencies are available',
          'Review factory error details'
        ]
      },
      cause
    );
  }
  
  /**
   * Create registry state error
   */
  static invalidState(
    currentState: string,
    expectedState: string,
    operation: string
  ): ServiceRegistryError {
    return ServiceRegistryError.create(
      UnifiedErrorCode.INVALID_REGISTRY_STATE,
      `Registry in invalid state '${ currentState }' for operation '${ operation }', expected '${ expectedState }'`,
      operation,
      {
        additionalData: {
          currentState,
          expectedState,
          stateValidation: true
        }
      },
      {
        canRetry: false,
        suggestions: [
          'Initialize registry before use',
          'Check registry lifecycle state',
          'Ensure proper registry setup'
        ]
      }
    );
  }
  
  // Enhanced debugging methods
  
  /**
   * Get registry-specific short error message
   */
  getShortMessage(): string {
    const registryContext = this.context as ServiceRegistryErrorContext;
    let message = `${ this.message }\n`;
    message += `Error Code: ${ this.code }\n`;
    
    if (registryContext.serviceName) {
      message += `Service: ${ registryContext.serviceName }\n`;
    }
    
    if (registryContext.operation) {
      message += `Operation: ${ registryContext.operation }\n`;
    }
    
    return message.trim();
  }
  
  /**
   * Get detailed registry error information with full chain
   */
  getDetailedMessage(): string {
    const registryContext = this.context as ServiceRegistryErrorContext;
    let details = `${ this.message }\n`;
    details += `Error Code: ${ this.code }\n`;
    details += `Chain Depth: ${ this.getChainDepth() }\n`;
    details += `Modules: ${ this.getInvolvedModules().join(' → ') }\n`;
    
    const operations = this.getInvolvedOperations();
    if (operations.length > 0) {
      details += `Operations: ${ operations.join(' → ') }\n`;
    }
    
    // BaseRegistry-specific context
    if (registryContext.serviceName) details += `Service Name: ${ registryContext.serviceName }\n`;
    if (registryContext.serviceLifetime) details += `Service Lifetime: ${ registryContext.serviceLifetime }\n`;
    if (registryContext.registrationCount !== undefined) details += `Registration Count: ${ registryContext.registrationCount }\n`;
    if (registryContext.resolutionChain) details += `Resolution Chain: ${ registryContext.resolutionChain.join(
      ' → ') }\n`;
    
    // Recovery information
    if (this.recovery.suggestions.length > 0) {
      details += 'Suggestions:\n';
      this.recovery.suggestions.forEach(suggestion => {
        details += `  - ${ suggestion }\n`;
      });
    }
    
    // Error chain messages
    const allMessages = this.getAllMessages();
    if (allMessages.length > 1) {
      details += 'Error Chain:\n';
      allMessages.forEach((
        msg,
        index
      ) => {
        details += `  [${ index }] ${ msg }\n`;
      });
    }
    
    return details.trim();
  }
  
  protected doToDebug(): string {
    return this.getDetailedMessage();
  }
  
  protected doToInfo(): string {
    return this.getShortMessage();
  }
}
