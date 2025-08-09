/**
 * @fileoverview NoOp Logger Implementation
 *
 * This module provides a no-operation logger implementation that does nothing.
 * Useful for testing or completely disabling logging.
 *
 * @author
 * @version 1.0.0
 */

import { Logger } from "@/logger/Logger";
import {
  LoggerConfig,
  LoggerMetrics,
  LogLevel
} from "./types";

/**
 * NoOp logger implementation that does nothing
 *
 * This logger implements the Logger interface but performs no actual logging operations.
 * All log methods are no-ops (do nothing). Useful for:
 * - Testing environments where you want to disable logging
 * - Performance testing where logging overhead should be eliminated
 * - Conditional logging scenarios
 */
export class NoOpLogger
  implements Logger {
  
  readonly config: LoggerConfig;
  private readonly timers = new Map<string, number>();
  private readonly metrics: LoggerMetrics = {
    messagesLogged: 0,
    errorCount: 0,
    warningCount: 0,
    lastLogTime: new Date(0),
    logLevelCounts: {}
  };
  
  static create(): Logger {
    return new NoOpLogger({ name: 'noop' })
  }
  
  constructor(config: LoggerConfig = {}) {
    this.config = config;
  }
  
  child(
    bindings?: Record<string, any>,
    options?: LoggerConfig
  ): Logger {
    const childConfig = { ...this.config, ...options };
    return new NoOpLogger(childConfig);
  }
  
  isLevelEnabled(level: LogLevel): boolean {
    return false; // NoOp never logs anything
  }
  
  withContext(context: Record<string, any>): Logger {
    return this.child(context);
  }
  
  withError(error: Error): Logger {
    return this.child();
  }
  
  withRequest(req: { id?: string; method?: string; url?: string; headers?: Record<string, any> }): Logger {
    return this.child();
  }
  
  // All logging methods do nothing
  fatal(
    messageOrObj: string | Record<string, any>,
    ...args: any[]
  ): void {
    // NoOp - do nothing
  }
  
  error(
    messageOrObjOrError: string | Record<string, any> | Error,
    ...args: any[]
  ): void {
    // NoOp - do nothing
  }
  
  warn(
    messageOrObj: string | Record<string, any>,
    ...args: any[]
  ): void {
    // NoOp - do nothing
  }
  
  info(
    messageOrObj: string | Record<string, any>,
    ...args: any[]
  ): void {
    // NoOp - do nothing
  }
  
  debug(
    messageOrObj: string | Record<string, any>,
    ...args: any[]
  ): void {
    // NoOp - do nothing
  }
  
  trace(
    messageOrObj: string | Record<string, any>,
    ...args: any[]
  ): void {
    // NoOp - do nothing
  }
  
  time(label: string): void {
    this.timers.set(label, Date.now());
  }
  
  timeEnd(label: string): void {
    this.timers.delete(label);
    // NoOp - don't log the timing
  }
  
  log(
    level: LogLevel,
    obj: Record<string, any>,
    message?: string
  ): void {
    // NoOp - do nothing
  }
  
  async flush(): Promise<void> {
    return Promise.resolve();
  }
  
  getMetrics(): LoggerMetrics {
    return { ...this.metrics };
  }
}
