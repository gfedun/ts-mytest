import {
  LoggerConfig,
  LoggerFeature,
  LoggerMetrics,
  LogLevel,
  RequestContext
} from "@/logger/types";

export interface LoggerBackendFactory {
  readonly name: string;
  createLogger(config: LoggerConfig): Logger;
  supportsFeature(feature: LoggerFeature): boolean;
  getConfigSchema?(): Record<string, any>;
  initialize?(globalConfig?: Record<string, any>): Promise<void>;
  shutdown?(): Promise<void>;
}

/**
 * Core Logger interface that can be implemented by different backends
 */
export interface Logger {
  /**
   * Logger configuration
   */
  readonly config: LoggerConfig;
  
  /**
   * Create a child logger with additional context
   */
  child(
    bindings?: Record<string, any>,
    options?: LoggerConfig
  ): Logger;
  
  /**
   * Check if a log level is enabled
   */
  isLevelEnabled(level: LogLevel): boolean;
  
  /**
   * Add persistent context to all log messages
   */
  withContext(context: Record<string, any>): Logger;
  
  /**
   * Add error context with automatic serialization
   */
  withError(error: Error): Logger;
  
  /**
   * Add request context (useful for web applications)
   */
  withRequest(req: RequestContext): Logger;
  
  /**
   * Basic logging methods
   */
  fatal(
    message: string,
    ...args: any[]
  ): void;
  fatal(
    obj: Record<string, any>,
    message?: string,
    ...args: any[]
  ): void;
  error(
    message: string,
    ...args: any[]
  ): void;
  error(
    obj: Record<string, any>,
    message?: string,
    ...args: any[]
  ): void;
  error(
    error: Error,
    message?: string,
    ...args: any[]
  ): void;
  warn(
    message: string,
    ...args: any[]
  ): void;
  warn(
    obj: Record<string, any>,
    message?: string,
    ...args: any[]
  ): void;
  info(
    message: string,
    ...args: any[]
  ): void;
  info(
    obj: Record<string, any>,
    message?: string,
    ...args: any[]
  ): void;
  debug(
    message: string,
    ...args: any[]
  ): void;
  debug(
    obj: Record<string, any>,
    message?: string,
    ...args: any[]
  ): void;
  trace(
    message: string,
    ...args: any[]
  ): void;
  trace(
    obj: Record<string, any>,
    message?: string,
    ...args: any[]
  ): void;
  
  /**
   * Performance timing
   */
  time(label: string): void;
  timeEnd(label: string): void;
  
  /**
   * Generic log method
   */
  log(
    level: LogLevel,
    obj: Record<string, any>,
    message?: string
  ): void;
  
  /**
   * Flush any buffered logs
   */
  flush(): Promise<void>;
  
  /**
   * Get logging metrics
   */
  getMetrics(): LoggerMetrics;
}
