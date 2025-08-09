/**
 * @fileoverview Core Utils Package Index
 *
 * Common utility functions and types. Only exports essential utility functions
 * since no external packages currently use this module.
 *
 * @author
 * @version 1.0.0
 */

// Utility types
export type {
  DeepReadonly,
  Mutable,
  Resolve,
  Prettify,
  DeepPartial,
  Tuple,
  Head,
  Tail,
  HasTail,
  Last
} from './Types';

// Utility functions
export { utils } from './utils';
