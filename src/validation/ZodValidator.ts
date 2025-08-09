/**
 * @fileoverview Zod Adapter for Model Validation System
 *
 * This adapter bridges Zod schemas with our pluggable validation system,
 * providing seamless integration while maintaining the generic ModelValidator interface.
 *
 * Key Features:
 * - Full implementation of ZodValidator<T> interface
 * - Automatic error format conversion from Zod to our ValidationException format
 * - Support for all Zod transformation and refinement methods
 * - Performance metadata tracking
 * - Rich error context and path information
 *
 * @package model.validation
 * @version 2.0.0
 */

import { Either } from "@/either";
import { z } from 'zod';
import {
  ModelValidator,
  ValidationError,
  ValidationException,
  ValidatorOptions,
} from './types';

/**
 * Zod-specific validator interface that extends the base ModelValidator
 * with Zod-specific methods for enhanced functionality
 */
export abstract class ZodValidator<T>
  implements ModelValidator<T> {
  
  /**
   * Convenience function to create a Zod validator
   */
  static createZodValidator<T>(
    schema: z.ZodSchema<T>,
    options?: ValidatorOptions
  ): ZodValidator<T> {
    return new ZodValidatorImpl(schema, options);
  }
  
  /**
   * Parse and validate data, throwing an error if validation fails
   * @param data - The data to validate
   * @returns The validated and potentially transformed data
   */
  abstract parse(data: unknown): Either<ValidationException, T>;
  
  /**
   * Create a new validator that allows undefined values
   * @returns A new validator that accepts T | undefined
   */
  abstract optional(): ModelValidator<T | undefined>;
  
  /**
   * Create a new validator that allows null values
   * @returns A new validator that accepts T | null
   */
  abstract nullable(): ModelValidator<T | null>;
  
  /**
   * The underlying Zod schema for direct access when needed
   */
  readonly zodSchema: z.ZodSchema<T>;
  
  /**
   * Transform the validated data using a function
   * @param fn - Function to transform the validated data
   * @returns A new ZodValidator with the transformation applied
   */
  abstract transform<U>(fn: (data: T) => U): ZodValidator<U>;
  
  /**
   * Add a custom refinement/validation rule
   * @param check - Function that returns true if data is valid
   * @param message - Optional error message for failed validation
   * @returns A new ZodValidator with the refinement applied
   */
  abstract refine(
    check: (data: T) => boolean,
    message?: string
  ): ZodValidator<T>;
  
  /**
   * Add a custom refinement with detailed error information
   * @param check - Function that returns true if data is valid
   * @param ctx - Refinement context for detailed error information
   * @returns A new ZodValidator with the refinement applied
   */
  abstract superRefine(check: (
    data: T,
    ctx: any
  ) => void): ZodValidator<T>;
}

/**
 * Zod adapter that implements the ZodValidator interface
 * Bridges Zod schemas with our unified validation system
 */
export class ZodValidatorImpl<T>
  extends ZodValidator<T> {
  /**
   * The underlying Zod schema
   */
  public readonly zodSchema: z.ZodSchema<T>;
  
  /**
   * Optional configuration for this validator instance
   */
  private readonly options: ValidatorOptions;
  
  constructor(
    zodSchema: z.ZodSchema<T>,
    options: ValidatorOptions = {}
  ) {
    super()
    this.zodSchema = zodSchema;
    this.options = {
      abortEarly: true,
      includeWarnings: false,
      ...options
    };
  }
  
  /**
   * Parse and validate data, throwing an error if validation fails
   */
  parse(data: unknown): Either<ValidationException, T> {
    try {
      const result = this.zodSchema.parse(data);
      return Either.right(result as T)
    } catch (error) {
      if (error instanceof z.ZodError) {
        const formattedErrors = this.formatZodErrors(error);
        const errorMessage = formattedErrors.map(e => `${ e.path.join('.') }: ${ e.message }`).join('; ');
        const validationException: ValidationException = {
          message: `Validation failed: ${ errorMessage }`,
          errors: formattedErrors
        };
        return Either.left(validationException);
      }
      const validationException: ValidationException = {
        message: error instanceof Error ? error.message : "unknown error",
        errors: []
      };
      return Either.left(validationException);
    }
  }
  
  /**
   * Create a new validator that allows undefined values
   */
  optional(): ModelValidator<T | undefined> {
    return new ZodValidatorImpl(this.zodSchema.optional(), this.options);
  }
  
  /**
   * Create a new validator that allows null values
   */
  nullable(): ModelValidator<T | null> {
    return new ZodValidatorImpl(this.zodSchema.nullable(), this.options);
  }
  
  /**
   * Transform the validated data using a function
   */
  transform<U>(fn: (data: T) => U): ZodValidator<U> {
    return new ZodValidatorImpl(this.zodSchema.transform(fn), this.options) as ZodValidator<U>;
  }
  
  /**
   * Add a custom refinement/validation rule
   */
  refine(
    check: (data: T) => boolean,
    message?: string
  ): ZodValidator<T> {
    const refinedSchema = message
      ? this.zodSchema.refine(check, { message })
      : this.zodSchema.refine(check);
    
    return new ZodValidatorImpl(refinedSchema, this.options);
  }
  
  /**
   * Add a custom refinement with detailed error information
   */
  superRefine(check: (
    data: T,
    ctx: z.RefinementCtx
  ) => void): ZodValidator<T> {
    return new ZodValidatorImpl(
      this.zodSchema.superRefine(check),
      this.options
    );
  }
  
  /**
   * Convert Zod errors to our ValidationException format
   */
  private formatZodErrors(zodError: z.ZodError): ValidationError[] {
    return zodError.issues.map(issue => {
      const path = issue.path.map(p => String(p));
      
      return {
        path,
        message: this.getCustomErrorMessage(issue) || issue.message,
        code: this.mapZodCodeToErrorCode(issue.code),
        received: 'received' in issue ? (issue as any).received : undefined,
        expected: (this.formatExpectedValue(issue) ?? ''), // Ensure string, not undefined
        context: {
          zodCode: issue.code,
          zodIssue: issue,
          ...this.options.context
        }
      } as ValidationError;
    });
  }
  
  /**
   * Get custom error message if configured
   */
  private getCustomErrorMessage(issue: z.ZodIssue): string | undefined {
    if (!this.options.errorMessages) {
      return undefined;
    }
    
    const path = issue.path.join('.');
    const code = issue.code;
    
    // Try path-specific message first, then code-specific
    return this.options.errorMessages[`${ path }.${ code }`] ||
      this.options.errorMessages[path] ||
      this.options.errorMessages[code];
  }
  
  /**
   * Map Zod error codes to our standard error codes
   */
  private mapZodCodeToErrorCode(zodCode: string): string {
    const codeMap: Record<string, string> = {
      'invalid_type': 'INVALID_TYPE',
      'custom': 'CUSTOM_VALIDATION',
      'invalid_union': 'INVALID_UNION',
      'unrecognized_keys': 'UNRECOGNIZED_KEYS',
      'too_small': 'TOO_SMALL',
      'too_big': 'TOO_BIG',
      'not_multiple_of': 'NOT_MULTIPLE_OF',
      'invalid_string': 'INVALID_STRING',
      'invalid_date': 'INVALID_DATE'
    };
    
    return codeMap[zodCode] || 'UNKNOWN_ERROR';
  }
  
  /**
   * Format expected value description from Zod issue
   */
  private formatExpectedValue(issue: z.ZodIssue): string | undefined {
    switch (issue.code) {
      case 'invalid_type':
        return (issue as any).expected;
      case 'too_small':
        const smallIssue = issue as any;
        return `${ smallIssue.type } with ${ smallIssue.inclusive ? 'at least' : 'more than' } ${ smallIssue.minimum } ${ smallIssue.type === 'string' ? 'characters' : 'items' }`;
      case 'too_big':
        const bigIssue = issue as any;
        return `${ bigIssue.type } with ${ bigIssue.inclusive ? 'at most' : 'less than' } ${ bigIssue.maximum } ${ bigIssue.type === 'string' ? 'characters' : 'items' }`;
      default:
        return undefined;
    }
  }
  
  /**
   * Get schema version for metadata (placeholder)
   */
  private getSchemaVersion(): string {
    // Could be enhanced to extract version from schema description or custom metadata
    return '1.0.0';
  }
  
  /**
   * Get Zod version for metadata
   */
  private getZodVersion(): string {
    try {
      // This would need to be implemented based on how Zod exposes version info
      return 'unknown';
    } catch {
      return 'unknown';
    }
  }
}
