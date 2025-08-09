/**
 * @fileoverview Pino Logger Implementation
 *
 * This module provides a smart, agnostic layer over Pino logger that enhances
 * its functionality while maintaining simplicity and performance.
 *
 * @author
 * @version 1.0.0
 */

import { Logger } from "@/logger/Logger";
import { Logger as PinoLoggerInstance } from 'pino';
import {
  LoggerConfig,
  LoggerMetrics,
  LogLevel
} from "./types";

/**
 * Logger implementation that wraps Pino
 */
export class PinoLogger
  implements Logger {
  
  readonly pino: PinoLoggerInstance;
  readonly config: LoggerConfig;
  
  private readonly timers = new Map<string, number>();
  private metrics: LoggerMetrics = {
    messagesLogged: 0,
    errorCount: 0,
    warningCount: 0,
    lastLogTime: new Date(0),
    logLevelCounts: {}
  };
  
  constructor(
    pinoInstance: PinoLoggerInstance,
    config: LoggerConfig = {}
  ) {
    this.pino = pinoInstance;
    this.config = config;
  }
  
  child(
    bindings?: Record<string, any>,
    options?: LoggerConfig
  ): Logger {
    const childPino = this.pino.child(bindings || {});
    const childConfig = { ...this.config, ...options };
    const child = new PinoLogger(childPino, childConfig);
    
    // Inherit metrics reference (optional - could be separate)
    child.metrics = { ...this.metrics };
    
    return child;
  }
  
  isLevelEnabled(level: LogLevel): boolean {
    return this.pino.isLevelEnabled(this.levelToString(level));
  }
  
  withContext(context: Record<string, any>): Logger {
    return this.child(context);
  }
  
  withError(error: Error): Logger {
    return this.child({
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        cause: error.cause
      }
    });
  }
  
  withRequest(req: { id?: string; method?: string; url?: string; headers?: Record<string, any> }): Logger {
    const requestContext: Record<string, any> = {};
    
    if (req.id) requestContext.reqId = req.id;
    if (req.method) requestContext.method = req.method;
    if (req.url) requestContext.url = req.url;
    if (req.headers) {
      const safeHeaders: Record<string, any> = {};
      const headerWhitelist = ['user-agent', 'content-type', 'accept', 'host'];
      headerWhitelist.forEach(header => {
        if (req.headers![header]) {
          safeHeaders[header] = req.headers![header];
        }
      });
      if (Object.keys(safeHeaders).length > 0) {
        requestContext.headers = safeHeaders;
      }
    }
    
    return this.child({ req: requestContext });
  }
  
  fatal(
    messageOrObj: string | Record<string, any>,
    ...args: any[]
  ): void {
    this.updateMetrics('fatal');
    if (typeof messageOrObj === 'string') {
      this.pino.fatal(messageOrObj, ...args);
    } else {
      this.pino.fatal(messageOrObj, ...args);
    }
  }
  
  error(
    messageOrObjOrError: string | Record<string, any> | Error,
    ...args: any[]
  ): void {
    this.updateMetrics('error');
    
    if (messageOrObjOrError instanceof Error) {
      const error = messageOrObjOrError;
      const message = args[0] as string;
      this.pino.error({
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
          cause: error.cause
        }
      }, message || error.message, ...args.slice(1));
    } else if (typeof messageOrObjOrError === 'string') {
      this.pino.error(messageOrObjOrError, ...args);
    } else {
      this.pino.error(messageOrObjOrError, ...args);
    }
  }
  
  warn(
    messageOrObj: string | Record<string, any>,
    ...args: any[]
  ): void {
    this.updateMetrics('warn');
    if (typeof messageOrObj === 'string') {
      this.pino.warn(messageOrObj, ...args);
    } else {
      this.pino.warn(messageOrObj, ...args);
    }
  }
  
  info(
    messageOrObj: string | Record<string, any>,
    ...args: any[]
  ): void {
    this.updateMetrics('info');
    if (typeof messageOrObj === 'string') {
      this.pino.info(messageOrObj, ...args);
    } else {
      this.pino.info(messageOrObj, ...args);
    }
  }
  
  debug(
    messageOrObj: string | Record<string, any>,
    ...args: any[]
  ): void {
    this.updateMetrics('debug');
    if (typeof messageOrObj === 'string') {
      this.pino.debug(messageOrObj, ...args);
    } else {
      this.pino.debug(messageOrObj, ...args);
    }
  }
  
  trace(
    messageOrObj: string | Record<string, any>,
    ...args: any[]
  ): void {
    this.updateMetrics('trace');
    if (typeof messageOrObj === 'string') {
      this.pino.trace(messageOrObj, ...args);
    } else {
      this.pino.trace(messageOrObj, ...args);
    }
  }
  
  time(label: string): void {
    this.timers.set(label, Date.now());
  }
  
  timeEnd(label: string): void {
    const startTime = this.timers.get(label);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.timers.delete(label);
      this.info({ duration, unit: 'ms' }, `Timer "${ label }" completed`);
    }
  }
  
  log(
    level: LogLevel,
    obj: Record<string, any>,
    message?: string
  ): void {
    this.updateMetrics(this.levelToString(level));
    const levelName = this.levelToString(level);
    if (this.pino.isLevelEnabled(levelName)) {
      if (message) {
        (this.pino as any)[levelName](obj, message);
      } else {
        (this.pino as any)[levelName](obj);
      }
    }
  }
  
  async flush(): Promise<void> {
    return Promise.resolve();
  }
  
  getMetrics(): LoggerMetrics {
    return { ...this.metrics };
  }
  
  private levelToString(level: LogLevel): string {
    switch (level) {
      case LogLevel.FATAL:
        return 'fatal';
      case LogLevel.ERROR:
        return 'error';
      case LogLevel.WARN:
        return 'warn';
      case LogLevel.INFO:
        return 'info';
      case LogLevel.DEBUG:
        return 'debug';
      case LogLevel.TRACE:
        return 'trace';
      default:
        return 'info';
    }
  }
  
  private updateMetrics(level?: string): void {
    // Update total message count
    (this.metrics as any).messagesLogged++;
    
    // Update level-specific counts
    if (level) {
      if (!this.metrics.logLevelCounts[level]) {
        (this.metrics.logLevelCounts as any)[level] = 0;
      }
      (this.metrics.logLevelCounts as any)[level]++;
      
      // Update error and warning counts
      if (level === 'error' || level === 'fatal') {
        (this.metrics as any).errorCount++;
      } else if (level === 'warn') {
        (this.metrics as any).warningCount++;
      }
    }
    
    // Update last log time
    (this.metrics as any).lastLogTime = new Date();
  }
}
