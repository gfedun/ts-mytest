/**
 * @fileoverview Configuration Package Index
 *
 * This module provides consolidated exports for the configuration package.
 * Only essential public API elements are exported for external consumption.
 *
 * @author
 * @version 1.0.0
 */

// Core configuration types and implementation
export {
  Config,
  ImmutableConfig
} from './Config';

// Factory implementation and utilities
export {
  ConfigFactory,
  ConfigBuilder,
  ConfigUtils,
  ConfigTypeGuards
} from './ConfigFactory';

// Types and enums
export type {
  ConfigEnvironment,
  ConfigOptions,
  ConfigValidationError
} from './types';
