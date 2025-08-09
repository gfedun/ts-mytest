/**
 * @fileoverview Validation Package Index
 *
 * This module provides consolidated exports for the validation package,
 * implementing pluggable validation capabilities with Zod integration.
 *
 * @package validation
 * @version 2.0.0
 */

// Core validation interfaces and types
export type {
  ModelValidator,
  ValidationError,
  ValidationException,
  ValidatorOptions
} from './types';

// Zod validator implementation
export {
  ZodValidator,
} from './ZodValidator';

// Re-export Zod for convenience
export { z } from 'zod';
