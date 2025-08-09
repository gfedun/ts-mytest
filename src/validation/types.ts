/**
 * @fileoverview New Validation Types for Pluggable Schema System
 *
 * This file defines the new validation interfaces that replace the internal
 * schema system with a pluggable approach that supports Zod and other validation libraries.
 *
 * Key Features:
 * - Generic ModelValidator interface for any validation library
 * - Zod-specific extensions with enhanced type safety
 * - Unified ValidationResult format across all validators
 * - Support for warnings, error paths, and validation codes
 *
 * @package model.validation
 * @version 2.0.0
 */
import { Either } from "@/either";

export type ValidationException = {
  message: string,
  errors: ValidationError[]
}

/**
 * Detailed information about a validation error
 */
export interface ValidationError {
  /**
   * Path to the field that failed validation (e.g., ['user', 'email'])
   */
  readonly path: string[];
  
  /**
   * Human-readable error message
   */
  readonly message: string;
  
  /**
   * Machine-readable error code for programmatic handling
   */
  readonly code?: string;
  
  /**
   * The value that failed validation
   */
  readonly received?: unknown;
  
  /**
   * Expected value or format
   */
  readonly expected?: string;
  
  /**
   * Additional context about the error
   */
  readonly context?: Record<string, any>;
}

/**
 * Generic validator interface that can be implemented by any validation library
 * This provides a consistent API regardless of the underlying validation system
 */
export interface ModelValidator<T> {
  /**
   * Parse and validate data, throwing an error if validation fails
   * @param data - The data to validate
   * @returns The validated and potentially transformed data
   * @throws ValidationError if validation fails
   */
  parse(data: unknown): Either<ValidationException, T>;
  
  /**
   * Safely parse and validate data, returning a result object instead of throwing
   * @param data - The data to validate
   * @returns ValidationResult with success status, data, and any errors
   */
  // safeParse(data: unknown): ValidationResult<T>;
  
  /**
   * Create a new validator that allows undefined values
   * @returns A new validator that accepts T | undefined
   */
  optional(): ModelValidator<T | undefined>;
  
  /**
   * Create a new validator that allows null values
   * @returns A new validator that accepts T | null
   */
  nullable(): ModelValidator<T | null>;
}

// /**
//  * Unified validation result format used across all validators
//  * Provides consistent error reporting regardless of the underlying validation library
//  */
// export interface ValidationResult<T = any> {
//   /**
//    * Whether the validation succeeded
//    */
//   readonly success: boolean;
//
//   /**
//    * The validated data (only present if success is true)
//    */
//   readonly data?: T;
//
//   /**
//    * Array of validation errors (empty if success is true)
//    */
//   readonly errors: ValidationError[];
//
//   /**
//    * Optional warnings that don't prevent validation success
//    */
//   readonly warnings?: ValidationWarning[];
//
//   /**
//    * Additional metadata about the validation process
//    */
//   readonly metadata?: ValidationMetadata;
// }

/**
 * Detailed information about a validation error
 */
export interface ValidationError {
  /**
   * Path to the field that failed validation (e.g., ['user', 'email'])
   */
  readonly path: string[];

  /**
   * Human-readable error message
   */
  readonly message: string;

  /**
   * Machine-readable error code for programmatic handling
   */
  readonly code?: string;

  /**
   * The value that failed validation
   */
  readonly received?: unknown;

  /**
   * Expected value or format
   */
  readonly expected?: string;

  /**
   * Additional context about the error
   */
  readonly context?: Record<string, any>;
}

// /**
//  * Metadata about the validation process
//  */
// export interface ValidationMetadata {
//   /**
//    * Time taken to perform validation (in milliseconds)
//    */
//   readonly duration?: number;
//
//   /**
//    * Name/type of the validator used
//    */
//   readonly validator?: string;
//
//   /**
//    * Version of the validation schema
//    */
//   readonly schemaVersion?: string;
//
//   /**
//    * Additional custom metadata
//    */
//   readonly custom?: Record<string, any>;
// }

/**
 * Options for creating validators
 */
export interface ValidatorOptions {
  /**
   * Whether to collect all errors or stop at the first one
   */
  readonly abortEarly?: boolean;

  /**
   * Whether to include warnings in the result
   */
  readonly includeWarnings?: boolean;

  /**
   * Custom error messages for specific validation rules
   */
  readonly errorMessages?: Record<string, string>;

  /**
   * Additional context to pass to validators
   */
  readonly context?: Record<string, any>;
}

