/**
 * @fileoverview Configuration Factory Implementation
 *
 * This module provides a factory for creating both mutable and immutable
 * configuration instances with shared common functionality.
 *
 * @author
 * @version 1.0.0
 */

import { Either } from '@/either';
import {
  Config,
  ConfigImpl,
  ImmutableConfig,
  ImmutableConfigImpl
} from './Config';
import {
  ConfigEnvironment,
  ConfigOptions,
  ConfigValidationError
} from './types';

/**
 * Base configuration data with common functionality
 */
abstract class BaseConfigData<T> {
  protected readonly _environment: ConfigEnvironment;
  protected readonly _options: ConfigOptions;
  protected readonly _initial: T;
  
  protected constructor(
    data: T,
    environment: ConfigEnvironment = 'development',
    options: ConfigOptions = {}
  ) {
    this._initial = this.deepClone(data);
    this._environment = environment;
    this._options = { immutable: false, validation: true, ...options };
  }
  
  /**
   * Get the configuration environment
   */
  getEnvironment(): ConfigEnvironment {
    return this._environment;
  }
  
  /**
   * Serialize configuration to JSON string
   */
  toJSON(data: T): string {
    return JSON.stringify(data, null, 2);
  }
  
  /**
   * Validate configuration with external validator
   */
  validateWith<V>(
    data: T,
    validator: (data: T) => Either<ConfigValidationError[], V>
  ): Either<ConfigValidationError[], V> {
    return validator(data);
  }
  
  /**
   * Deep clone utility
   */
  protected deepClone<U>(obj: U): U {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    if (obj instanceof Date) {
      return new Date(obj.getTime()) as any;
    }
    if (obj instanceof Array) {
      return obj.map(item => this.deepClone(item)) as any;
    }
    if (typeof obj === 'object') {
      const cloned: any = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = this.deepClone(obj[key]);
        }
      }
      return cloned;
    }
    return obj;
  }
  
  /**
   * Deep merge utility
   */
  protected deepMerge<U>(
    target: U,
    source: Partial<U>
  ): U {
    const result = this.deepClone(target);
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const sourceValue = source[key];
        const targetValue = (result as any)[key];
        if (this.isObject(sourceValue) && this.isObject(targetValue)) {
          (result as any)[key] = this.deepMerge(targetValue, sourceValue);
        } else {
          (result as any)[key] = sourceValue;
        }
      }
    }
    return result;
  }
  
  /**
   * Check if value is a plain object
   */
  protected isObject(value: any): value is Record<string, any> {
    return value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date);
  }
  
  /**
   * Parse JSON safely
   */
  protected parseJSON<U>(json: string): Either<Error, U> {
    try {
      const parsed = JSON.parse(json) as U;
      return Either.right(parsed);
    } catch (error) {
      return Either.left(error instanceof Error ? error : new Error(String(error)));
    }
  }
}

/**
 * Configuration factory with builder pattern support
 */
export class ConfigFactory {
  /**
   * Create a mutable configuration instance
   */
  static createMutable<T>(
    data: T,
    environment: ConfigEnvironment = 'development',
    options: ConfigOptions = {}
  ): Config<T> {
    const mutableOptions = { ...options, immutable: false };
    return new ConfigImpl(data, environment, mutableOptions);
  }
  
  /**
   * Create an immutable configuration instance
   */
  static createImmutable<T>(
    data: T,
    environment: ConfigEnvironment = 'development',
    options: ConfigOptions = {}
  ): ImmutableConfig<T> {
    const immutableOptions = { ...options, immutable: true };
    return new ImmutableConfigImpl(data, environment, immutableOptions);
  }
  
  /**
   * Create configuration from JSON string (mutable)
   */
  static fromJSONMutable<T>(
    json: string,
    environment: ConfigEnvironment = 'development',
    options: ConfigOptions = {}
  ): Either<Error, Config<T>> {
    try {
      const parsed = JSON.parse(json) as T;
      return Either.right(ConfigFactory.createMutable(parsed, environment, options));
    } catch (error) {
      return Either.left(error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  /**
   * Create configuration from JSON string (immutable)
   */
  static fromJSONImmutable<T>(
    json: string,
    environment: ConfigEnvironment = 'development',
    options: ConfigOptions = {}
  ): Either<Error, ImmutableConfig<T>> {
    try {
      const parsed = JSON.parse(json) as T;
      return Either.right(ConfigFactory.createImmutable(parsed, environment, options));
    } catch (error) {
      return Either.left(error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  /**
   * Create configuration with validation
   */
  static createWithValidationMutable<T, V>(
    data: T,
    validator: (data: T) => Either<ConfigValidationError[], V>,
    environment: ConfigEnvironment = 'development',
    options: ConfigOptions = {}
  ): Either<ConfigValidationError[], Config<T>> {
    const validationResult = validator(data);
    if (validationResult.isLeft()) {
      return Either.left(validationResult.left);
    }
    const config = ConfigFactory.createMutable(data, environment, options);
    return Either.right(config);
  }
  
  /**
   * Create configuration with validation (immutable)
   */
  static createWithValidationImmutable<T, V>(
    data: T,
    validator: (data: T) => Either<ConfigValidationError[], V>,
    environment: ConfigEnvironment = 'development',
    options: ConfigOptions = {}
  ): Either<ConfigValidationError[], ImmutableConfig<T>> {
    const validationResult = validator(data);
    if (validationResult.isLeft()) {
      return Either.left(validationResult.left);
    }
    const config = ConfigFactory.createImmutable(data, environment, options);
    return Either.right(config);
  }
  
  /**
   * Builder pattern for configuration creation
   */
  static builder<T>() {
    return new ConfigBuilder<T>();
  }
}

/**
 * Builder class for fluent configuration creation
 */
export class ConfigBuilder<T> {
  private _data?: T;
  private _environment: ConfigEnvironment = 'development';
  private _options: ConfigOptions = {};
  private _validator?: (data: T) => Either<ConfigValidationError[], any>;
  
  /**
   * Set the configuration data
   */
  withData(data: T): ConfigBuilder<T> {
    this._data = data;
    return this;
  }
  
  /**
   * Set the environment
   */
  withEnvironment(environment: ConfigEnvironment): ConfigBuilder<T> {
    this._environment = environment;
    return this;
  }
  
  /**
   * Set configuration options
   */
  withOptions(options: ConfigOptions): ConfigBuilder<T> {
    this._options = { ...this._options, ...options };
    return this;
  }
  
  /**
   * Add validation
   */
  withValidation(validator: (data: T) => Either<ConfigValidationError[], any>): ConfigBuilder<T> {
    this._validator = validator;
    return this;
  }
  
  /**
   * Enable validation flag
   */
  enableValidation(enabled: boolean = true): ConfigBuilder<T> {
    this._options = { ...this._options, validation: enabled };
    return this;
  }
  
  /**
   * Load data from JSON
   */
  fromJSON(json: string): Either<Error, ConfigBuilder<T>> {
    try {
      this._data = JSON.parse(json) as T;
      return Either.right(this as ConfigBuilder<T>);
    } catch (error) {
      return Either.left(error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  /**
   * Build mutable configuration
   */
  buildMutable(): Either<ConfigValidationError[] | Error[], Config<T>> {
    if (!this._data) {
      return Either.left([new Error('No data provided to ConfigBuilder')] as ConfigValidationError[] | Error[]);
    }
    const data = this._data as T;
    if (this._validator) {
      const validationResult = ConfigFactory.createWithValidationMutable(
        data,
        this._validator,
        this._environment,
        this._options
      );
      if (validationResult.isLeft()) {
        return Either.left(validationResult.left as ConfigValidationError[] | Error[]);
      }
      return Either.right(ConfigFactory.createMutable(data, this._environment, this._options));
    }
    return Either.right(ConfigFactory.createMutable(data, this._environment, this._options));
  }
  
  /**
   * Build immutable configuration
   */
  buildImmutable(): Either<ConfigValidationError[] | Error[], ImmutableConfig<T>> {
    if (!this._data) {
      return Either.left(
        [new Error('No data provided to ConfigBuilder')] as ConfigValidationError[] | Error[]
      );
    }
    const data = this._data as T;
    if (this._validator) {
      const validationResult = ConfigFactory.createWithValidationImmutable(
        data,
        this._validator,
        this._environment,
        this._options
      );
      if (validationResult.isLeft()) {
        return Either.left(validationResult.left as ConfigValidationError[] | Error[]);
      }
      return Either.right(ConfigFactory.createImmutable(data, this._environment, this._options));
    }
    return Either.right(ConfigFactory.createImmutable(data, this._environment, this._options));
  }
}

/**
 * Utility functions for configuration management
 */
export class ConfigUtils {
  /**
   * Convert mutable config to immutable
   */
  static toImmutable<T>(config: Config<T>): ImmutableConfig<T> {
    return ConfigFactory.createImmutable(
      config.get(),
      config.getEnvironment(),
      { immutable: true, validation: true }
    );
  }
  
  /**
   * Convert immutable config to mutable
   */
  static toMutable<T>(config: ImmutableConfig<T>): Config<T> {
    return ConfigFactory.createMutable(
      config.get() as T,
      config.getEnvironment(),
      { immutable: false, validation: true }
    );
  }
  
  /**
   * Merge multiple configurations (returns mutable)
   */
  static merge<T>(...configs: Array<Config<T> | ImmutableConfig<T>>): Config<T> {
    if (configs.length === 0) {
      throw new Error('At least one configuration must be provided');
    }
    const first = configs[0];
    let merged = first.get() as T;
    const environment = first.getEnvironment();
    for (let i = 1; i < configs.length; i++) {
      const current = configs[i].get() as T;
      merged = ConfigFactory.createMutable(merged, environment)
        .mergeWith(current as Partial<T>)
        .get();
    }
    return ConfigFactory.createMutable(merged, environment);
  }
}

/**
 * Type guards for configuration types
 */
export namespace ConfigTypeGuards {
  export function isMutableConfig<T>(config: Config<T> | ImmutableConfig<T>): config is Config<T> {
    return 'set' in config && 'update' in config && 'merge' in config;
  }
  export function isImmutableConfig<T>(config: Config<T> | ImmutableConfig<T>): config is ImmutableConfig<T> {
    return !isMutableConfig(config);
  }
}
