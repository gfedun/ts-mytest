/**
 * Comprehensive utility functions for common operations
 */
export namespace utils {
  
  export function tuple<T extends unknown[]>(...elements: T) { return elements }
  export function readonlyTuple<T extends unknown[]>(...ts: T): readonly [...T] { return ts }
  
  /**
   * Deep freeze an object and all its nested properties
   */
  export function deepFreeze<T>(obj: T): T {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }
    
    const propNames = Object.getOwnPropertyNames(obj);
    for (const name of propNames) {
      const value = (obj as any)[name];
      if (Array.isArray(value)) {
        for (const item of value) {
          deepFreeze(item);
        }
      } else if (value && typeof value === "object") {
        deepFreeze(value);
      }
    }
    return Object.freeze(obj);
  }
  
  /**
   * Deep clone an object using JSON serialization
   */
  export function deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }
    return JSON.parse(JSON.stringify(obj));
  }
  
  /**
   * Deep merge two objects
   */
  export function deepMerge<T extends Record<string, any>>(
    target: T,
    source: Partial<T>
  ): T {
    const result = { ...target };
    
    for (const key in source) {
      if (source.hasOwnProperty(key)) {
        const sourceValue = source[key];
        const targetValue = result[key];
        
        if (isObject(sourceValue) && isObject(targetValue)) {
          result[key] = deepMerge(targetValue, sourceValue as any);
        } else {
          result[key] = sourceValue as T[Extract<keyof T, string>];
        }
      }
    }
    
    return result;
  }
  
  /**
   * Check if a value is a plain object
   */
  export function isObject(value: unknown): value is Record<string, any> {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  
  /**
   * Check if a value is empty (null, undefined, empty string, empty array, empty object)
   */
  export function isEmpty(value: unknown): boolean {
    if (value === null || value === undefined) return true;
    if (typeof value === "string") return value.length === 0;
    if (Array.isArray(value)) return value.length === 0;
    if (isObject(value)) return Object.keys(value).length === 0;
    return false;
  }
  
  /**
   * Check if a value is not empty
   */
  export function isNotEmpty(value: unknown): boolean {
    return !isEmpty(value);
  }
  
  /**
   * Safely access nested properties with dot notation
   */
  export function get<T = any>(
    obj: any,
    path: string,
    defaultValue?: T
  ): T | undefined {
    const keys = path.split('.');
    let result = obj;
    
    for (const key of keys) {
      if (result === null || result === undefined || typeof result !== 'object') {
        return defaultValue;
      }
      result = result[key];
    }
    
    return result === undefined ? defaultValue : result;
  }
  
  /**
   * Safely set nested properties with dot notation
   */
  export function set<T extends Record<string, any>>(
    obj: T,
    path: string,
    value: any
  ): T {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    let current = obj;
    
    for (const key of keys) {
      if (!(key in current) || !isObject(current[key])) {
        (current as any)[key] = {};
      }
      current = current[key];
    }
    
    (current as any)[lastKey] = value;
    return obj;
  }
  
  /**
   * Check if nested property exists
   */
  export function has(
    obj: any,
    path: string
  ): boolean {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current === null || current === undefined || typeof current !== 'object' || !(key in current)) {
        return false;
      }
      current = current[key];
    }
    
    return true;
  }
  
  /**
   * Debounce function execution
   */
  export function debounce<T extends (...args: any[]) => any>(
    func: T,
    wait: number
  ): (...args: Parameters<T>) => void {
    let timeout: NodeJS.Timeout | undefined;
    
    return (...args: Parameters<T>) => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeout = setTimeout(() => func(...args), wait);
    };
  }
  
  /**
   * Throttle function execution
   */
  export function throttle<T extends (...args: any[]) => any>(
    func: T,
    limit: number
  ): (...args: Parameters<T>) => void {
    let inThrottle: boolean;
    
    return (...args: Parameters<T>) => {
      if (!inThrottle) {
        func(...args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }
  
  /**
   * Create a new object with only specified keys
   */
  export function pick<T extends Record<string, any>, K extends keyof T>(
    obj: T,
    keys: K[]
  ): Pick<T, K> {
    const result = {} as Pick<T, K>;
    for (const key of keys) {
      if (key in obj) {
        result[key] = obj[key];
      }
    }
    return result;
  }
  
  /**
   * Create a new object without specified keys
   */
  export function omit<T extends Record<string, any>, K extends keyof T>(
    obj: T,
    keys: K[]
  ): Omit<T, K> {
    const result = { ...obj };
    for (const key of keys) {
      delete result[key];
    }
    return result;
  }
  
  /**
   * Group array elements by a key function
   */
  export function groupBy<T, K extends string | number | symbol>(
    array: T[],
    keyFn: (item: T) => K
  ): Record<K, T[]> {
    return array.reduce((
      groups,
      item
    ) => {
      const key = keyFn(item);
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(item);
      return groups;
    }, {} as Record<K, T[]>);
  }
  
  /**
   * Remove duplicate elements from array
   */
  export function unique<T>(array: T[]): T[] {
    return Array.from(new Set(array));
  }
  
  /**
   * Remove duplicate elements by key function
   */
  export function uniqueBy<T, K>(
    array: T[],
    keyFn: (item: T) => K
  ): T[] {
    const seen = new Set<K>();
    return array.filter(item => {
      const key = keyFn(item);
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }
  
  /**
   * Chunk array into smaller arrays of specified size
   */
  export function chunk<T>(
    array: T[],
    size: number
  ): T[][] {
    if (size <= 0) throw new Error('Chunk size must be greater than 0');
    
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
  
  /**
   * Flatten nested arrays
   */
  export function flatten<T>(array: (T | T[])[]): T[] {
    return array.reduce<T[]>((
      acc,
      val
    ) =>
      Array.isArray(val) ? acc.concat(flatten(val)) : acc.concat(val), []);
  }
  
  /**
   * Sleep for specified milliseconds
   */
  export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  /**
   * Retry function with exponential backoff
   */
  export async function retry<T>(
    fn: () => Promise<T>,
    options: {
      maxAttempts?: number;
      delay?: number;
      backoff?: number;
      onRetry?: (
        attempt: number,
        error: Error
      ) => void;
    } = {}
  ): Promise<T> {
    const { maxAttempts = 3, delay = 1000, backoff = 2, onRetry } = options;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        if (attempt === maxAttempts) {
          throw error;
        }
        
        if (onRetry) {
          onRetry(attempt, error as Error);
        }
        
        await sleep(delay * Math.pow(backoff, attempt - 1));
      }
    }
    
    throw new Error('Retry failed');
  }
  
  /**
   * Create a range of numbers
   */
  export function range(
    start: number,
    end?: number,
    step: number = 1
  ): number[] {
    if (end === undefined) {
      end = start;
      start = 0;
    }
    
    const result: number[] = [];
    if (step > 0) {
      for (let i = start; i < end; i += step) {
        result.push(i);
      }
    } else if (step < 0) {
      for (let i = start; i > end; i += step) {
        result.push(i);
      }
    }
    
    return result;
  }
  
  /**
   * Compose functions from right to left
   */
  export function compose<T>(...fns: Array<(arg: any) => any>): (arg: T) => any {
    return (arg: T) => fns.reduceRight((
      acc,
      fn
    ) => fn(acc), arg);
  }
  
  /**
   * Pipe functions from left to right
   */
  export function pipe<T>(...fns: Array<(arg: any) => any>): (arg: T) => any {
    return (arg: T) => fns.reduce((
      acc,
      fn
    ) => fn(acc), arg);
  }
  
  /**
   * Memoize function results
   */
  export function memoize<T extends (...args: any[]) => any>(fn: T): T {
    const cache = new Map();
    
    return ((...args: Parameters<T>) => {
      const key = JSON.stringify(args);
      if (cache.has(key)) {
        return cache.get(key);
      }
      
      const result = fn(...args);
      cache.set(key, result);
      return result;
    }) as T;
  }
}
