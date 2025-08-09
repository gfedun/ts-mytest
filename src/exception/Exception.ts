/**
 * @fileoverview Enhanced Exception System with Error Aggregation
 *
 * Provides comprehensive error handling with information preservation across error chains.
 * Supports unified error codes and maintains all context through error conversions.
 */

import { Either } from "@/either";
import {
  Loggable,
  symbolLoggable
} from "@/logger/Loggable";
import util from "util";
import { UnifiedErrorCode } from "./ErrorCodes";

/**
 * Context information for errors with timestamp and operation details
 */
export interface ErrorContext {
  timestamp: Date;
  operation?: string | undefined;
  module: string;
  additionalData?: Record<string, unknown> | undefined;
}

/**
 * Information about aggregated errors in the chain
 */
export interface AggregatedErrorInfo {
  code: UnifiedErrorCode;
  message: string;
  context: ErrorContext;
  originalError?: Error | Exception | undefined;
}

/**
 * Enhanced base Exception class with error aggregation support
 *
 * Features:
 * - Error chain aggregation with full context preservation
 * - Unified error codes across all modules
 * - Complete message and context history
 * - Seamless Either<Error, T> integration
 */
export abstract class Exception
  extends Error
  implements Loggable {
  public readonly [symbolLoggable]: () => string;
  public readonly _tag: string;
  public readonly code: UnifiedErrorCode;
  public readonly context: ErrorContext;
  public readonly aggregatedErrors: AggregatedErrorInfo[];
  public readonly rootCause?: Error | Exception | undefined;
  
  /**
   * Enhanced constructor supporting error aggregation
   */
  protected constructor(
    code: UnifiedErrorCode,
    message: string,
    context: ErrorContext,
    cause?: Error | Exception
  ) {
    super(message);
    this.code = code;
    this.context = context;
    this.rootCause = cause || undefined;
    this.aggregatedErrors = [];
    
    // Initialize with current error as first in chain
    this.aggregatedErrors.push({
      code,
      message,
      context,
      originalError: cause || undefined
    });
    
    // If cause is an Exception, aggregate its errors
    if (cause instanceof Exception) {
      this.aggregatedErrors.push(...cause.aggregatedErrors);
    }
    
    // Set up logging symbol
    this[symbolLoggable] = () => this._tag;
  }
  
  /**
   * Add an error to the aggregation chain
   */
  public addError(error: AggregatedErrorInfo): Exception {
    this.aggregatedErrors.push(error);
    return this;
  }
  
  /**
   * Get all messages from the error chain in chronological order
   */
  public getAllMessages(): string[] {
    return this.aggregatedErrors.map(error => error.message);
  }
  
  /**
   * Get all contexts from the error chain
   */
  public getAllContexts(): ErrorContext[] {
    return this.aggregatedErrors.map(error => error.context);
  }
  
  /**
   * Get all error codes from the chain
   */
  public getAllCodes(): UnifiedErrorCode[] {
    return this.aggregatedErrors.map(error => error.code);
  }
  
  /**
   * Get the timeline of errors in the chain
   */
  public getTimeline(): Date[] {
    return this.aggregatedErrors.map(error => error.context.timestamp);
  }
  
  /**
   * Get all modules involved in the error chain
   */
  public getInvolvedModules(): string[] {
    const modules = new Set(this.aggregatedErrors.map(error => error.context.module));
    return Array.from(modules);
  }
  
  /**
   * Get all operations involved in the error chain
   */
  public getInvolvedOperations(): string[] {
    const operations = new Set(
      this.aggregatedErrors
        .map(error => error.context.operation)
        .filter(op => op !== undefined)
    );
    return Array.from(operations);
  }
  
  /**
   * Check if the error chain contains a specific error code
   */
  public hasErrorCode(code: UnifiedErrorCode): boolean {
    return this.aggregatedErrors.some(error => error.code === code);
  }
  
  /**
   * Get the depth of the error chain
   */
  public getChainDepth(): number {
    return this.aggregatedErrors.length;
  }
  
  /**
   * Static method to create Either.left with proper typing
   */
  static left<T>(error: Exception): Either<Exception, T> {
    return Either.left(error);
  }
  
  /**
   * Enhanced debugging with full chain information
   */
  protected doToDebug(): string {
    const chainInfo = this.aggregatedErrors.map((
      error,
      index
    ) => {
      const context = error.context;
      return `[${ index }] ${ error.code }: ${ error.message } (${ context.module }${ context.operation ? `::${ context.operation }` : '' } @ ${ context.timestamp.toISOString() })`;
    }).join('\n  ');
    
    return `${ this._tag }: ${ this.message }\nError Chain:\n  ${ chainInfo }`;
  }
  
  /**
   * Enhanced info output with chain summary
   */
  protected doToInfo(): string {
    const modules = this.getInvolvedModules().join(' → ');
    const operations = this.getInvolvedOperations().join(' → ');
    
    return `${ this._tag }: ${ this.message } [Chain: ${ this.getChainDepth() } errors, Modules: ${ modules }${ operations ? `, Ops: ${ operations }` : '' }]`;
  }
  
  /**
   * Standard toString with enhanced information
   */
  toString(): string {
    return this.toInfo();
  }
  
  /**
   * Custom inspect for Node.js debugging
   */
  [util.inspect.custom](): string {
    return this.toDebug();
  }
  
  /**
   * Debug output with optional additional message
   */
  toDebug(msg?: string): string {
    const debugOutput = this.doToDebug();
    return msg ? `${ debugOutput } - ${ msg }` : debugOutput;
  }
  
  /**
   * Info output with optional additional message
   */
  toInfo(msg?: string): string {
    const infoOutput = this.doToInfo();
    return msg ? `${ infoOutput } - ${ msg }` : infoOutput;
  }
}

/**
 * Concrete Exception implementation for cases where we need a non-abstract exception
 */
export class GenericException
  extends Exception {
  public readonly _tag = "GenericException" as const;
  
  constructor(
    code: UnifiedErrorCode,
    message: string,
    context: ErrorContext,
    cause?: Error | Exception
  ) {
    super(code, message, context, cause);
  }
  
  /**
   * Factory method for creating generic exceptions
   */
  static create(
    code: UnifiedErrorCode,
    message: string,
    module: string,
    operation?: string,
    additionalData?: Record<string, unknown>,
    cause?: Error | Exception
  ): GenericException {
    const context: ErrorContext = {
      timestamp: new Date(),
      module,
      ...(operation !== undefined && { operation }),
      ...(additionalData !== undefined && { additionalData })
    };
    
    return new GenericException(code, message, context, cause);
  }
}
