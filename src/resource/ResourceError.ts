/**
 * @fileoverview Resource Error System - Unified Edition
 *
 * Comprehensive error handling for the resource system using the unified
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
 * Resource-specific context information extending the base ErrorContext
 */
export interface ResourceErrorContext extends ErrorContext {
  resourceName?: string;
  resourceType?: string;
  resourcePath?: string;
  protocol?: string;
  contentType?: string;
  resourceSize?: number;
  loadTime?: number;
  retryAttempts?: number;
  supportedProtocols?: string[];
  location?: string;
  networkInfo?: Record<string, any>;
  validationErrors?: string[];
  performanceMetrics?: Record<string, number>;
}

/**
 * Recovery suggestions for resource errors
 */
export interface ResourceErrorRecovery {
  canRetry: boolean;
  retryDelay?: number;
  maxRetries?: number;
  suggestions: string[];
  alternativeActions?: string[];
}

/**
 * Enhanced ResourceError using the unified exception system
 */
export class ResourceError extends Exception {
  public readonly _tag = "ResourceError" as const;
  public readonly recovery: ResourceErrorRecovery;
  
  constructor(
    code: UnifiedErrorCode,
    message: string,
    context: ResourceErrorContext,
    recovery: Partial<ResourceErrorRecovery> = {},
    cause?: Error | Exception
  ) {
    const resourceContext: ResourceErrorContext = {
      ...context,
      module: 'RESOURCE',
      timestamp: context.timestamp || new Date()
    };
    
    super(code, message, resourceContext, cause);
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
   * Factory method for easy ResourceError creation
   */
  static create(
    code: UnifiedErrorCode,
    message: string,
    operation: string,
    resourceContext: Partial<ResourceErrorContext> = {},
    recovery?: Partial<ResourceErrorRecovery>,
    cause?: Error | Exception
  ): ResourceError {
    const context: ResourceErrorContext = {
      timestamp: new Date(),
      operation,
      module: 'RESOURCE',
      ...resourceContext
    };
    
    return new ResourceError(code, message, context, recovery, cause);
  }
  
  /**
   * Create a ResourceNotFoundError
   */
  static notFound(
    resourceName: string,
    location: string,
    cause?: Error | Exception
  ): ResourceError {
    return ResourceError.create(
      UnifiedErrorCode.REGISTRY_ENTRY_NOT_FOUND, // Using registry not found as closest match
      `Resource '${resourceName}' not found at location '${location}'`,
      'load',
      {
        resourceName,
        location,
        resourcePath: location
      },
      {
        canRetry: true,
        retryDelay: 500,
        maxRetries: 1,
        suggestions: [
          'Check if the resource path is correct',
          'Verify resource exists at the specified location',
          'Check file permissions and accessibility'
        ]
      },
      cause
    );
  }
  
  /**
   * Create a ResourceLoadError
   */
  static loadFailed(
    resourceName: string,
    location: string,
    reason?: string,
    cause?: Error | Exception
  ): ResourceError {
    const message = reason
      ? `Failed to load resource '${resourceName}' from '${location}': ${reason}`
      : `Failed to load resource '${resourceName}' from '${location}'`;
    
    return ResourceError.create(
      UnifiedErrorCode.PLUGIN_LOAD_FAILED, // Reusing plugin load failed for resource loading
      message,
      'load',
      {
        resourceName,
        location,
        resourcePath: location,
        ...(reason && { additionalData: { failureReason: reason } })
      },
      {
        canRetry: true,
        retryDelay: 1000,
        maxRetries: 2,
        suggestions: [
          'Check network connectivity',
          'Verify resource is accessible',
          'Check for temporary server issues',
          ...(reason ? [`Address specific issue: ${reason}`] : [])
        ]
      },
      cause
    );
  }
  
  /**
   * Create a ProtocolNotSupportedError
   */
  static protocolNotSupported(
    protocol: string,
    supportedProtocols: string[]
  ): ResourceError {
    return ResourceError.create(
      UnifiedErrorCode.INVALID_OPERATION,
      `Protocol '${protocol}' is not supported. Supported protocols: ${supportedProtocols.join(', ')}`,
      'load',
      {
        protocol,
        supportedProtocols,
        additionalData: { protocolValidation: true }
      },
      {
        canRetry: false,
        suggestions: [
          'Use a supported protocol',
          `Available protocols: ${supportedProtocols.join(', ')}`,
          'Check protocol configuration'
        ]
      }
    );
  }
  
  /**
   * Create an AccessDeniedError
   */
  static accessDenied(
    resourceName: string,
    location: string,
    cause?: Error | Exception
  ): ResourceError {
    return ResourceError.create(
      UnifiedErrorCode.PERMISSION_DENIED,
      `Access denied to resource '${resourceName}' at location '${location}'`,
      'load',
      {
        resourceName,
        location,
        resourcePath: location
      },
      {
        canRetry: false,
        suggestions: [
          'Check file/resource permissions',
          'Verify authentication credentials',
          'Contact administrator for access rights'
        ]
      },
      cause
    );
  }
  
  /**
   * Create a ContentParseError
   */
  static contentParseError(
    resourceName: string,
    contentType: string,
    operation: string,
    reason?: string,
    cause?: Error | Exception
  ): ResourceError {
    const message = reason
      ? `Failed to parse ${contentType} content for resource '${resourceName}' during ${operation}: ${reason}`
      : `Failed to parse ${contentType} content for resource '${resourceName}' during ${operation}`;
    
    return ResourceError.create(
      UnifiedErrorCode.INVALID_CONFIGURATION, // Using config error for parse errors
      message,
      operation,
      {
        resourceName,
        contentType,
        ...(reason && { additionalData: { parseError: reason } })
      },
      {
        canRetry: false,
        suggestions: [
          'Check content format and syntax',
          'Verify content type matches actual format',
          'Review content structure',
          ...(reason ? [`Fix parsing issue: ${reason}`] : [])
        ]
      },
      cause
    );
  }
  
  /**
   * Create a ValidationError
   */
  static validationFailed(
    resourceName: string,
    operation: string,
    validationErrors: string[],
    cause?: Error | Exception
  ): ResourceError {
    return ResourceError.create(
      UnifiedErrorCode.CONFIGURATION_VALIDATION_FAILED,
      `Resource validation failed for '${resourceName}': ${validationErrors.join(', ')}`,
      operation,
      {
        resourceName,
        validationErrors,
        additionalData: { validationAttempt: true }
      },
      {
        canRetry: false,
        suggestions: [
          'Fix validation errors',
          'Check resource format requirements',
          'Review resource specifications',
          ...validationErrors.map(error => `Fix: ${error}`)
        ]
      },
      cause
    );
  }
  
  /**
   * Create a NetworkTimeoutError
   */
  static networkTimeout(
    resourceName: string,
    location: string,
    timeoutMs: number,
    cause?: Error | Exception
  ): ResourceError {
    return ResourceError.create(
      UnifiedErrorCode.TIMEOUT_ERROR,
      `Network timeout after ${timeoutMs}ms while loading resource '${resourceName}' from '${location}'`,
      'load',
      {
        resourceName,
        location,
        resourcePath: location,
        loadTime: timeoutMs,
        additionalData: { timeoutMs, networkTimeout: true }
      },
      {
        canRetry: true,
        retryDelay: 2000,
        maxRetries: 2,
        suggestions: [
          'Check network connectivity',
          'Increase timeout value',
          'Verify server availability',
          'Try loading smaller resources first'
        ],
        alternativeActions: [
          'Use cached version if available',
          'Load from alternative location'
        ]
      },
      cause
    );
  }
  
  /**
   * Create an InvalidFormatError
   */
  static invalidFormat(
    resourceName: string,
    expectedFormat: string,
    actualFormat?: string,
    cause?: Error | Exception
  ): ResourceError {
    const message = actualFormat
      ? `Invalid format for resource '${resourceName}'. Expected: ${expectedFormat}, got: ${actualFormat}`
      : `Invalid format for resource '${resourceName}'. Expected: ${expectedFormat}`;
    
    return ResourceError.create(
      UnifiedErrorCode.INVALID_PLUGIN_FORMAT, // Reusing plugin format error
      message,
      'validate',
      {
        resourceName,
        contentType: expectedFormat,
        additionalData: {
          expectedFormat,
          actualFormat,
          formatValidation: true
        }
      },
      {
        canRetry: false,
        suggestions: [
          'Convert resource to expected format',
          'Check resource type configuration',
          'Verify format specifications'
        ]
      },
      cause
    );
  }
  
  /**
   * Create a ResourceTooLargeError
   */
  static resourceTooLarge(
    resourceName: string,
    size: number,
    maxSize: number
  ): ResourceError {
    return ResourceError.create(
      UnifiedErrorCode.INVALID_OPERATION, // Using INVALID_OPERATION since INVALID_PARAMETER doesn't exist
      `Resource '${resourceName}' is too large (${size} bytes). Maximum allowed: ${maxSize} bytes`,
      'load',
      {
        resourceName,
        resourceSize: size,
        additionalData: { maxSize, sizeValidation: true }
      },
      {
        canRetry: false,
        suggestions: [
          'Reduce resource size',
          'Compress the resource',
          'Split into smaller resources',
          'Increase size limit if appropriate'
        ],
        alternativeActions: [
          'Stream the resource instead of loading entirely',
          'Load resource in chunks'
        ]
      }
    );
  }
  
  // Enhanced debugging methods following ServiceRegistryError pattern
  
  /**
   * Get resource-specific short error message
   */
  getShortMessage(): string {
    const resourceContext = this.context as ResourceErrorContext;
    let message = `${this.message}\n`;
    message += `Error Code: ${this.code}\n`;
    
    if (resourceContext.resourceName) {
      message += `Resource: ${resourceContext.resourceName}\n`;
    }
    
    if (resourceContext.operation) {
      message += `Operation: ${resourceContext.operation}\n`;
    }
    
    return message.trim();
  }
  
  /**
   * Get detailed resource error information with full chain
   */
  getDetailedMessage(): string {
    const resourceContext = this.context as ResourceErrorContext;
    let details = `${this.message}\n`;
    details += `Error Code: ${this.code}\n`;
    details += `Chain Depth: ${this.getChainDepth()}\n`;
    details += `Modules: ${this.getInvolvedModules().join(' → ')}\n`;
    
    const operations = this.getInvolvedOperations();
    if (operations.length > 0) {
      details += `Operations: ${operations.join(' → ')}\n`;
    }
    
    // Resource-specific context
    if (resourceContext.resourceName) details += `Resource Name: ${resourceContext.resourceName}\n`;
    if (resourceContext.resourceType) details += `Resource Type: ${resourceContext.resourceType}\n`;
    if (resourceContext.resourcePath) details += `Resource Path: ${resourceContext.resourcePath}\n`;
    if (resourceContext.location) details += `Location: ${resourceContext.location}\n`;
    if (resourceContext.protocol) details += `Protocol: ${resourceContext.protocol}\n`;
    if (resourceContext.contentType) details += `Content Type: ${resourceContext.contentType}\n`;
    if (resourceContext.resourceSize) details += `Resource Size: ${resourceContext.resourceSize} bytes\n`;
    if (resourceContext.loadTime) details += `Load Time: ${resourceContext.loadTime}ms\n`;
    if (resourceContext.retryAttempts) details += `Retry Attempts: ${resourceContext.retryAttempts}\n`;
    if (resourceContext.supportedProtocols) details += `Supported Protocols: ${resourceContext.supportedProtocols.join(', ')}\n`;
    
    // Validation errors
    if (resourceContext.validationErrors?.length) {
      details += 'Validation Errors:\n';
      resourceContext.validationErrors.forEach(error => {
        details += `  - ${error}\n`;
      });
    }
    
    // Recovery information
    if (this.recovery.suggestions.length > 0) {
      details += 'Suggestions:\n';
      this.recovery.suggestions.forEach(suggestion => {
        details += `  - ${suggestion}\n`;
      });
    }
    
    if (this.recovery.alternativeActions?.length) {
      details += 'Alternative Actions:\n';
      this.recovery.alternativeActions.forEach(action => {
        details += `  - ${action}\n`;
      });
    }
    
    // Error chain messages
    const allMessages = this.getAllMessages();
    if (allMessages.length > 1) {
      details += 'Error Chain:\n';
      allMessages.forEach((msg, index) => {
        details += `  [${index}] ${msg}\n`;
      });
    }
    
    // Performance metrics
    if (resourceContext.performanceMetrics && Object.keys(resourceContext.performanceMetrics).length > 0) {
      details += 'Performance Metrics:\n';
      Object.entries(resourceContext.performanceMetrics).forEach(([key, value]) => {
        details += `  ${key}: ${value}\n`;
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
