/**
 * @fileoverview EventHub Error System - Unified Edition
 *
 * Comprehensive error handling for the EventHub system using the unified
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
 * EventHub-specific context information extending the base ErrorContext
 */
export interface EventHubErrorContext
  extends ErrorContext {
  topicName?: string;
  queueName?: string;
  subscriptionId?: string;
  adapterId?: string;
  eventId?: string;
  eventType?: string;
  brokerType?: string;
  /** Performance metrics for EventHub operations */
  performanceMetrics?: Record<string, number>;
  /** Preserved error information from original errors */
  preservedErrorInfo?: {
    originalErrorCode?: string;
    originalMessage?: string;
    originalModule?: string;
  };
}

/**
 * Recovery suggestions for EventHub errors
 */
export interface EventHubErrorRecovery {
  canRetry: boolean;
  retryDelayMs?: number;
  maxRetries?: number;
  suggestions: string[];
  alternativeActions?: string[];
}

/**
 * Enhanced EventHubError using the unified exception system
 */
export class EventHubError
  extends Exception {
  public readonly _tag = "EventHubError" as const;
  public readonly recovery: EventHubErrorRecovery;
  
  constructor(
    code: UnifiedErrorCode,
    message: string,
    context: EventHubErrorContext,
    recovery: Partial<EventHubErrorRecovery> = {},
    cause?: Error | Exception
  ) {
    // Ensure module is set to EVENTHUB
    const eventHubContext: EventHubErrorContext = {
      ...context,
      module: 'EVENTHUB',
      timestamp: context.timestamp || new Date()
    };
    
    super(code, message, eventHubContext, cause);
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
   * Factory method for easy EventHubError creation
   */
  static create(
    code: UnifiedErrorCode,
    message: string,
    operation: string,
    eventHubContext: Partial<EventHubErrorContext> = {},
    recovery?: Partial<EventHubErrorRecovery>,
    cause?: Error | Exception
  ): EventHubError {
    const context: EventHubErrorContext = {
      timestamp: new Date(),
      operation,
      module: 'EVENTHUB',
      ...eventHubContext
    };
    
    return new EventHubError(code, message, context, recovery, cause);
  }
  
  /**
   * Create from registry error with information preservation
   */
  static fromRegistryError(
    registryError: Exception,
    operation: string,
    unifiedCode: UnifiedErrorCode,
    additionalContext: Partial<EventHubErrorContext> = {}
  ): EventHubError {
    return EventHubError.create(
      unifiedCode,
      `EventHub operation failed: ${ registryError.message }`,
      operation,
      {
        ...additionalContext,
        preservedErrorInfo: {
          originalErrorCode: registryError.code,
          originalMessage: registryError.message,
          originalModule: (registryError.context as any)?.module || 'unknown'
        }
      },
      {
        canRetry: false,
        suggestions: [
          'Check service registry configuration',
          'Verify required dependencies are available',
          'Review EventHub initialization'
        ]
      },
      registryError
    );
  }
  
  /**
   * Create EventHub state error
   */
  static stateError(
    currentState: string,
    expectedState: string,
    operation: string,
    context: Partial<EventHubErrorContext> = {}
  ): EventHubError {
    return EventHubError.create(
      UnifiedErrorCode.INVALID_STATE_TRANSITION,
      `Invalid EventHub state '${ currentState }' for operation '${ operation }', expected '${ expectedState }'`,
      operation,
      {
        ...context,
        additionalData: { currentState, expectedState }
      },
      {
        canRetry: false,
        suggestions: [
          'Initialize EventHub before use',
          'Check EventHub lifecycle state',
          'Ensure proper EventHub setup'
        ]
      }
    );
  }
  
  /**
   * Create event processing error
   */
  static eventProcessingFailed(
    eventId: string,
    eventType: string,
    operation: string,
    reason?: string,
    cause?: Error | Exception
  ): EventHubError {
    const message = reason
      ? `Failed to process event '${ eventId }' of type '${ eventType }': ${ reason }`
      : `Failed to process event '${ eventId }' of type '${ eventType }'`;
    
    return EventHubError.create(
      UnifiedErrorCode.EVENT_PROCESSING_FAILED,
      message,
      operation,
      { eventId, eventType },
      {
        canRetry: true,
        retryDelayMs: 1000,
        maxRetries: 3,
        suggestions: [
          'Check event data format and schema',
          'Verify event handler configuration',
          'Review system resources'
        ]
      },
      cause
    );
  }
  
  /**
   * Create adapter connection error
   */
  static adapterConnectionFailed(
    adapterId: string,
    brokerType: string,
    operation: string,
    cause?: Error | Exception
  ): EventHubError {
    return EventHubError.create(
      UnifiedErrorCode.ADAPTER_CONNECTION_FAILED,
      `Failed to connect adapter '${ adapterId }' to ${ brokerType } broker`,
      operation,
      { adapterId, brokerType },
      {
        canRetry: true,
        retryDelayMs: 5000,
        maxRetries: 5,
        suggestions: [
          'Check network connectivity',
          'Verify broker credentials',
          'Check broker availability',
          'Review adapter configuration'
        ]
      },
      cause
    );
  }
  
  /**
   * Enhanced debugging methods
   */
  getShortMessage(): string {
    const eventHubContext = this.context as EventHubErrorContext;
    let message = `${ this.message }\n`;
    message += `Error Code: ${ this.code }\n`;
    
    if (eventHubContext.operation) {
      message += `Operation: ${ eventHubContext.operation }\n`;
    }
    
    if (eventHubContext.adapterId) {
      message += `Adapter: ${ eventHubContext.adapterId }\n`;
    }
    
    return message.trim();
  }
  
  getDetailedMessage(): string {
    const eventHubContext = this.context as EventHubErrorContext;
    let details = `${ this.message }\n`;
    details += `Error Code: ${ this.code }\n`;
    details += `Chain Depth: ${ this.getChainDepth() }\n`;
    details += `Modules: ${ this.getInvolvedModules().join(' → ') }\n`;
    
    const operations = this.getInvolvedOperations();
    if (operations.length > 0) {
      details += `Operations: ${ operations.join(' → ') }\n`;
    }
    
    // EventHub-specific context
    if (eventHubContext.topicName) details += `Topic: ${ eventHubContext.topicName }\n`;
    if (eventHubContext.queueName) details += `Queue: ${ eventHubContext.queueName }\n`;
    if (eventHubContext.adapterId) details += `Adapter ID: ${ eventHubContext.adapterId }\n`;
    if (eventHubContext.eventId) details += `Event ID: ${ eventHubContext.eventId }\n`;
    if (eventHubContext.eventType) details += `Event Type: ${ eventHubContext.eventType }\n`;
    
    // Recovery information
    if (this.recovery.suggestions.length > 0) {
      details += 'Suggestions:\n';
      this.recovery.suggestions.forEach(suggestion => {
        details += `  - ${ suggestion }\n`;
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

// Type aliases for backward compatibility during migration
export type TopicError = EventHubError;
export type QueueError = EventHubError;
export type SubscriptionError = EventHubError;
export type EventProcessingError = EventHubError;
export type EventHubStateError = EventHubError;
