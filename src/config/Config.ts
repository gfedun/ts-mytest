/**
 * @fileoverview Configuration Management Implementation
 *
 * This module provides the core configuration management functionality
 * with proper type safety and validation support.
 *
 * @author
 * @version 1.0.0
 */

import { Either } from '@/either';
import {
  DeepReadonly,
  utils
} from "@/utils";
import {
  ConfigEnvironment,
  ConfigOptions,
  ConfigValidationError
} from "./types";

/**
 * Core configuration interface
 */
export interface ImmutableConfig<T> {
  get(): DeepReadonly<T>;
  get$(): DeepReadonly<T>;
  validateWith<V>(validator: (data: T) => Either<ConfigValidationError[], V>): Either<ConfigValidationError[], V>;
  getEnvironment(): ConfigEnvironment;
  toJSON(): string;
  fromJSON(json: string): Either<Error, ImmutableConfig<T>>;
}

export class ImmutableConfigImpl<T>
  implements ImmutableConfig<T> {
  
  private readonly _data: DeepReadonly<T>
  private readonly _environment: ConfigEnvironment;
  private readonly _options: ConfigOptions;
  
  constructor(
    data: T,
    environment: ConfigEnvironment = 'development',
    options: ConfigOptions = {}
  ) {
    this._data = utils.deepFreeze(data) as DeepReadonly<T>;
    this._environment = environment;
    this._options = { validation: true, ...options, immutable: true };
  }
  
  get(): DeepReadonly<T> {
    return this._data;
  }
  get$(): DeepReadonly<T> {
    return this._data;
  }
  getEnvironment(): ConfigEnvironment {
    return this._environment;
  }
  toJSON(): string {
    return JSON.stringify(this._data, null, 2);
  }
  
  fromJSON(json: string): Either<Error, ImmutableConfig<T>> {
    try {
      const parsed = JSON.parse(json) as T;
      return Either.right(
        new ImmutableConfigImpl(parsed, this._environment, this._options) as ImmutableConfig<T>
      );
    } catch (error) {
      return Either.left(error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  validateWith<V>(validator: (data: T) => Either<ConfigValidationError[], V>): Either<ConfigValidationError[], V> {
    return validator(this._data as any);
  }
}

/**
 * Core configuration interface
 */
export interface Config<T> {
  get(): T;
  get$(): T;
  set(value: T): Config<T>;
  update(updater: (current: T) => T): Config<T>;
  merge(other: Partial<T>): Config<T>;
  mergeWith(other: Partial<T>): Config<T>;
  validateWith<V>(validator: (data: T) => Either<ConfigValidationError[], V>): Either<ConfigValidationError[], V>;
  validateConfig<V = T>(validator?: (data: T) => Either<ConfigValidationError[], V>): Either<ConfigValidationError[], T>;
  getEnvironment(): ConfigEnvironment;
  clone(): Config<T>;
  reset(): Config<T>;
  toJSON(): string;
  fromJSON(json: string): Either<Error, Config<T>>;
}

/**
 * Core configuration implementation
 */
export class ConfigImpl<T>
  implements Config<T> {
  private _data: T;
  private readonly _initial: T;
  private readonly _environment: ConfigEnvironment;
  private readonly _options: ConfigOptions;
  
  constructor(
    data: T,
    environment: ConfigEnvironment = 'development',
    options: ConfigOptions = {}
  ) {
    this._data = this.deepClone(data);
    this._initial = this.deepClone(data);
    this._environment = environment;
    this._options = { immutable: false, validation: true, ...options };
  }
  
  /**
   * Get the current configuration data
   */
  get(): T {
    return this.deepClone(this._data);
  }
  
  /**
   * Get the current configuration data (direct reference)
   * Use with caution in immutable contexts
   */
  get$(): T {
    return this._data;
  }
  
  /**
   * Set new configuration data
   */
  set(value: T): Config<T> {
    if (this._options.immutable) {
      return new ConfigImpl(value, this._environment, this._options);
    }
    
    this._data = this.deepClone(value);
    return this;
  }
  
  /**
   * Update configuration using an updater function
   */
  update(updater: (current: T) => T): Config<T> {
    const newValue = updater(this.get());
    return this.set(newValue);
  }
  
  /**
   * Merge with partial configuration data
   */
  merge(other: Partial<T>): Config<T> {
    return this.mergeWith(other);
  }
  
  /**
   * Merge with partial configuration data (implementation)
   */
  mergeWith(other: Partial<T>): Config<T> {
    const merged = this.deepMerge(this._data, other);
    if (this._options.immutable) {
      return new ConfigImpl(merged, this._environment, this._options);
    }
    this._data = merged;
    return this;
  }
  
  /**
   * Validate configuration with external validator
   */
  validateWith<V>(validator: (data: T) => Either<ConfigValidationError[], V>): Either<ConfigValidationError[], V> {
    return validator(this._data);
  }
  
  /**
   * Validates configuration using optional external validator (e.g., Zod)
   * This is a Config-specific wrapper around the generic validateWith method
   */
  validateConfig<V = T>(validator?: (data: T) => Either<ConfigValidationError[], V>): Either<ConfigValidationError[], T> {
    if (!validator) {
      return Either.right(this.get$());
    }
    
    // Properly handle the validation result using Either.match
    const result = this.validateWith(validator);
    return Either.match(result, {
      onLeft: (errors: ConfigValidationError[]) => Either.left(errors),
      onRight: () => Either.right(this.get$())
    });
  }
  
  /**
   * Get the configuration environment
   */
  getEnvironment(): ConfigEnvironment {
    return this._environment;
  }
  
  /**
   * Create a deep clone of this configuration
   */
  clone(): Config<T> {
    return new ConfigImpl(this._data, this._environment, this._options);
  }
  
  /**
   * Reset configuration to initial state
   */
  reset(): Config<T> {
    return this.set(this._initial);
  }
  
  /**
   * Serialize configuration to JSON string
   */
  toJSON(): string {
    return JSON.stringify(this._data, null, 2);
  }
  
  /**
   * Deserialize configuration from JSON string
   */
  fromJSON(json: string): Either<Error, Config<T>> {
    try {
      const parsed = JSON.parse(json) as T;
      return Either.right(new ConfigImpl(parsed, this._environment, this._options) as Config<T>);
    } catch (error) {
      return Either.left(error instanceof Error ? error : new Error(String(error)));
    }
  }
  
  /**
   * Deep clone utility
   */
  private deepClone<U>(obj: U): U {
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
  private deepMerge<U>(
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
  private isObject(value: any): value is Record<string, any> {
    return value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      !(value instanceof Date);
  }
}
