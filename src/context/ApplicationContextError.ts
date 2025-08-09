/**
 * @fileoverview Application Context Error System - Unified Edition
 *
 * Comprehensive error handling for the application context system using the unified
 * error code system with complete error aggregation and information preservation.
 */

import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import {
  ErrorContext,
  Exception
} from '@/exception/Exception';
import { ExceptionFactory } from '@/exception/ExceptionFactory';
import { symbolLoggable } from "@/logger/Loggable";
import { ApplicationContextPhase } from './types';

/**
 * Context-specific context information extending the base ErrorContext
 */
export interface ApplicationContextErrorContext
  extends ErrorContext {
  contextName?: string;
  currentPhase?: ApplicationContextPhase;
  targetPhase?: ApplicationContextPhase;
  serviceName?: string;
  pluginId?: string;
  pluginVersion?: string;
  queueName?: string;
  topicName?: string;
  portName?: string;
  portType?: string;
  brokerType?: string;
  brokerId?: string;
  subscriptionId?: string;
  additionalData?: Record<string, unknown>;
}

/**
 * Recovery suggestions for application context errors
 */
export interface ApplicationContextErrorRecovery {
  canRetry: boolean;
  retryDelay?: number;
  maxRetries?: number;
  suggestions: string[];
  alternativeActions?: string[];
}

/**
 * Enhanced ApplicationContextError using the unified exception system
 */
export class ApplicationContextError
  extends Exception {
  public readonly _tag = "ApplicationContextError" as const;
  public readonly recovery: ApplicationContextErrorRecovery;
  
  constructor(
    code: UnifiedErrorCode,
    message: string,
    context: ApplicationContextErrorContext,
    recovery: Partial<ApplicationContextErrorRecovery> = {},
    cause?: Error | Exception
  ) {
    // Ensure module is set to CONTEXT
    const contextContext: ApplicationContextErrorContext = {
      ...context,
      module: 'CONTEXT',
      timestamp: context.timestamp || new Date()
    };
    
    super(code, message, contextContext, cause);
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
   * Factory method for easy ApplicationContextError creation
   */
  static create(
    code: UnifiedErrorCode,
    message: string,
    operation: string,
    contextContext: Partial<ApplicationContextErrorContext> = {},
    recovery?: Partial<ApplicationContextErrorRecovery>,
    cause?: Error | Exception
  ): ApplicationContextError {
    const context: ApplicationContextErrorContext = {
      timestamp: new Date(),
      operation,
      module: 'CONTEXT',
      ...contextContext
    };
    
    return new ApplicationContextError(code, message, context, recovery, cause);
  }
  
  /**
   * Create context initialization error
   */
  static initializationFailed(
    contextName: string,
    operation: string,
    reason?: string,
    cause?: Error | Exception
  ): ApplicationContextError {
    return ApplicationContextError.create(
      UnifiedErrorCode.CONTEXT_INITIALIZATION_FAILED,
      `Application context '${ contextName }' initialization failed${ reason ? `: ${ reason }` : '' }`,
      operation,
      {
        contextName,
        additionalData: { initializationReason: reason }
      },
      {
        canRetry: true,
        retryDelay: 2000,
        maxRetries: 2,
        suggestions: [
          'Check context configuration',
          'Verify all dependencies are available',
          'Review initialization sequence'
        ]
      },
      cause
    );
  }
  
  /**
   * Create phase transition error
   */
  static phaseTransitionFailed(
    currentPhase: ApplicationContextPhase,
    targetPhase: ApplicationContextPhase,
    operation: string,
    cause?: Error | Exception
  ): ApplicationContextError {
    return ApplicationContextError.create(
      UnifiedErrorCode.CONTEXT_INVALID_PHASE_TRANSITION,
      `Invalid phase transition from '${ currentPhase }' to '${ targetPhase }'`,
      operation,
      {
        currentPhase,
        targetPhase,
        additionalData: { phaseTransition: true }
      },
      {
        canRetry: false,
        suggestions: [
          'Check valid phase transition sequence',
          'Ensure context is in correct state',
          'Review phase transition logic'
        ]
      },
      cause
    );
  }
  
  /**
   * Create service error within context
   */
  static serviceError(
    serviceName: string,
    operation: string,
    errorType: 'unavailable' | 'initialization' | 'resolution' | 'registration',
    cause?: Error | Exception
  ): ApplicationContextError {
    const errorCodeMap = {
      unavailable: UnifiedErrorCode.CONTEXT_SERVICE_UNAVAILABLE,
      initialization: UnifiedErrorCode.CONTEXT_SERVICE_INITIALIZATION_FAILED,
      resolution: UnifiedErrorCode.CONTEXT_SERVICE_RESOLUTION_FAILED,
      registration: UnifiedErrorCode.CONTEXT_SERVICE_REGISTRATION_FAILED
    };
    
    return ApplicationContextError.create(
      errorCodeMap[errorType],
      `Service '${ serviceName }' ${ errorType } error in context`,
      operation,
      {
        serviceName,
        additionalData: { serviceErrorType: errorType }
      },
      {
        canRetry: errorType !== 'unavailable',
        retryDelay: 1000,
        maxRetries: 3,
        suggestions: [
          'Check service configuration',
          'Verify service dependencies',
          'Review service registration'
        ]
      },
      cause
    );
  }
  
  /**
   * Create queue operation error
   */
  static queueOperationFailed(
    queueName: string,
    operation: string,
    operationType: 'create' | 'delete' | 'send' | 'receive',
    cause?: Error | Exception
  ): ApplicationContextError {
    const errorCodeMap = {
      create: UnifiedErrorCode.CONTEXT_QUEUE_CREATION_FAILED,
      delete: UnifiedErrorCode.CONTEXT_QUEUE_DELETION_FAILED,
      send: UnifiedErrorCode.CONTEXT_QUEUE_MESSAGE_SEND_FAILED,
      receive: UnifiedErrorCode.CONTEXT_QUEUE_MESSAGE_RECEIVE_FAILED
    };
    
    return ApplicationContextError.create(
      errorCodeMap[operationType],
      `Queue ${ operationType } operation failed for '${ queueName }'`,
      operation,
      {
        queueName,
        additionalData: { queueOperation: operationType }
      },
      {
        canRetry: true,
        retryDelay: 500,
        maxRetries: 3,
        suggestions: [
          'Check queue configuration',
          'Verify queue exists',
          'Check EventHub connection'
        ]
      },
      cause
    );
  }
  
  /**
   * Create topic operation error
   */
  static topicOperationFailed(
    topicName: string,
    operation: string,
    operationType: 'create' | 'delete' | 'publish' | 'subscribe',
    cause?: Error | Exception
  ): ApplicationContextError {
    const errorCodeMap = {
      create: UnifiedErrorCode.CONTEXT_TOPIC_CREATION_FAILED,
      delete: UnifiedErrorCode.CONTEXT_TOPIC_DELETION_FAILED,
      publish: UnifiedErrorCode.CONTEXT_TOPIC_PUBLISH_FAILED,
      subscribe: UnifiedErrorCode.CONTEXT_TOPIC_SUBSCRIBE_FAILED
    };
    
    return ApplicationContextError.create(
      errorCodeMap[operationType],
      `Topic ${ operationType } operation failed for '${ topicName }'`,
      operation,
      {
        topicName,
        additionalData: { topicOperation: operationType }
      },
      {
        canRetry: true,
        retryDelay: 500,
        maxRetries: 3,
        suggestions: [
          'Check topic configuration',
          'Verify topic exists',
          'Check EventHub connection'
        ]
      },
      cause
    );
  }
  
  /**
   * Create port registration error
   */
  static portRegistrationFailed(
    portName: string,
    operation: string,
    cause?: Error | Exception
  ): ApplicationContextError {
    return ApplicationContextError.create(
      UnifiedErrorCode.CONTEXT_PORT_REGISTRATION_FAILED,
      `Port registration failed for '${ portName }'`,
      operation,
      {
        portName,
        additionalData: { portRegistration: true }
      },
      {
        canRetry: true,
        retryDelay: 1000,
        maxRetries: 2,
        suggestions: [
          'Check port configuration',
          'Verify port is not already registered',
          'Review broker connection'
        ]
      },
      cause
    );
  }
  
  // Enhanced debugging methods
  
  /**
   * Get context-specific short error message
   */
  getShortMessage(): string {
    const contextContext = this.context as ApplicationContextErrorContext;
    let message = `${ this.message }\n`;
    message += `Error Code: ${ this.code }\n`;
    
    if (contextContext.contextName) {
      message += `Context: ${ contextContext.contextName }\n`;
    }
    
    if (contextContext.currentPhase) {
      message += `Phase: ${ contextContext.currentPhase }\n`;
    }
    
    if (contextContext.operation) {
      message += `Operation: ${ contextContext.operation }\n`;
    }
    
    return message.trim();
  }
  
  /**
   * Get detailed context error information with full chain
   */
  getDetailedMessage(): string {
    const contextContext = this.context as ApplicationContextErrorContext;
    let details = `${ this.message }\n`;
    details += `Error Code: ${ this.code }\n`;
    details += `Chain Depth: ${ this.getChainDepth() }\n`;
    details += `Modules: ${ this.getInvolvedModules().join(' → ') }\n`;
    
    const operations = this.getInvolvedOperations();
    if (operations.length > 0) {
      details += `Operations: ${ operations.join(' → ') }\n`;
    }
    
    // Context-specific context
    if (contextContext.contextName) details += `Context Name: ${ contextContext.contextName }\n`;
    if (contextContext.currentPhase) details += `Current Phase: ${ contextContext.currentPhase }\n`;
    if (contextContext.targetPhase) details += `Target Phase: ${ contextContext.targetPhase }\n`;
    if (contextContext.serviceName) details += `Service: ${ contextContext.serviceName }\n`;
    if (contextContext.queueName) details += `Queue: ${ contextContext.queueName }\n`;
    if (contextContext.topicName) details += `Topic: ${ contextContext.topicName }\n`;
    
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

// Legacy error code mapping for backward compatibility during migration
export const LEGACY_CONTEXT_ERROR_MAPPING = new Map<string, UnifiedErrorCode>([
  // Initialization errors
  ['INVALID_CONFIGURATION', UnifiedErrorCode.CONTEXT_INVALID_CONFIGURATION],
  ['MISSING_DEPENDENCIES', UnifiedErrorCode.CONTEXT_MISSING_DEPENDENCIES],
  ['INITIALIZATION_FAILED', UnifiedErrorCode.CONTEXT_INITIALIZATION_FAILED],
  
  // Phase transition errors
  ['INVALID_PHASE_TRANSITION', UnifiedErrorCode.CONTEXT_INVALID_PHASE_TRANSITION],
  ['PHASE_TRANSITION_FAILED', UnifiedErrorCode.CONTEXT_PHASE_TRANSITION_FAILED],
  
  // Service errors
  ['SERVICE_UNAVAILABLE', UnifiedErrorCode.CONTEXT_SERVICE_UNAVAILABLE],
  ['SERVICE_INITIALIZATION_FAILED', UnifiedErrorCode.CONTEXT_SERVICE_INITIALIZATION_FAILED],
  ['SERVICE_RESOLUTION_FAILED', UnifiedErrorCode.CONTEXT_SERVICE_RESOLUTION_FAILED],
  ['SERVICE_REGISTRATION_FAILED', UnifiedErrorCode.CONTEXT_SERVICE_REGISTRATION_FAILED],
  
  // Queue errors
  ['QUEUE_CREATION_FAILED', UnifiedErrorCode.CONTEXT_QUEUE_CREATION_FAILED],
  ['QUEUE_DELETION_FAILED', UnifiedErrorCode.CONTEXT_QUEUE_DELETION_FAILED],
  ['QUEUE_MESSAGE_SEND_FAILED', UnifiedErrorCode.CONTEXT_QUEUE_MESSAGE_SEND_FAILED],
  ['QUEUE_MESSAGE_RECEIVE_FAILED', UnifiedErrorCode.CONTEXT_QUEUE_MESSAGE_RECEIVE_FAILED],
  
  // Topic errors
  ['TOPIC_CREATION_FAILED', UnifiedErrorCode.CONTEXT_TOPIC_CREATION_FAILED],
  ['TOPIC_DELETION_FAILED', UnifiedErrorCode.CONTEXT_TOPIC_DELETION_FAILED],
  ['TOPIC_PUBLISH_FAILED', UnifiedErrorCode.CONTEXT_TOPIC_PUBLISH_FAILED],
  ['TOPIC_SUBSCRIBE_FAILED', UnifiedErrorCode.CONTEXT_TOPIC_SUBSCRIBE_FAILED],
  
  // Port errors
  ['PORT_REGISTRATION_FAILED', UnifiedErrorCode.CONTEXT_PORT_REGISTRATION_FAILED],
  
  // General errors
  ['UNKNOWN_ERROR', UnifiedErrorCode.UNKNOWN_ERROR]
]);

/**
 * Helper function to map legacy error codes during migration
 */
export function mapLegacyContextError(legacyCode: string): UnifiedErrorCode {
  return LEGACY_CONTEXT_ERROR_MAPPING.get(legacyCode) || UnifiedErrorCode.UNKNOWN_ERROR;
}
