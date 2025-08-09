/**
 * Configuration environment types
 */
export type ConfigEnvironment = 'development' | 'production' | 'test' | 'staging';

/**
 * Configuration validation error
 */
export interface ConfigValidationError {
  readonly path: string;
  readonly message: string;
  readonly value?: any;
}

/**
 * Configuration options
 */
export interface ConfigOptions {
  readonly environment?: ConfigEnvironment;
  readonly immutable?: boolean;
  readonly validation?: boolean;
}
