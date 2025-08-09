/**
 * @fileoverview Console Logger Implementation
 *
 * This module provides a console-based logger implementation that outputs to the console.
 * Useful for development environments and simple logging scenarios.
 *
 * @author
 * @version 1.0.0
 */

import { Logger } from "@/logger/Logger";
import {
  LoggerConfig,
  LoggerMetrics,
  LogLevel,
  parseLogLevel,
  RequestContext
} from "./types";

const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
  name: "console",
  level: LogLevel.INFO,
  prettyPrint: true,
  messageKey: 'msg',
  timestamp: {
    timezone: 'America/Chicago'
  },
}

/**
 * Console logger implementation that outputs to the browser/Node.js console
 *
 * This logger implements the Logger interface using the native console API.
 * It provides colored output and structured logging capabilities.
 */
export class ConsoleLogger
  implements Logger {
  
  readonly config: LoggerConfig;
  private readonly timers = new Map<string, number>();
  private metrics: LoggerMetrics = {
    messagesLogged: 0,
    errorCount: 0,
    warningCount: 0,
    lastLogTime: undefined,
    logLevelCounts: {
      'FATAL': 0,
      'ERROR': 0,
      'WARN': 0,
      'INFO': 0,
      'DEBUG': 0,
      'TRACE': 0
    }
  };
  private readonly context: Record<string, any> = {};
  
  constructor(config: LoggerConfig = {}) {
    this.config = {
      ...DEFAULT_LOGGER_CONFIG,
      ...config
    };
  }
  
  child(
    bindings?: Record<string, any>,
    options?: LoggerConfig
  ): Logger {
    const childConfig = { ...this.config, ...options };
    const child = new ConsoleLogger(childConfig);
    // Always inherit parent context, then add new bindings
    Object.assign(child.context, this.context);
    if (bindings) {
      Object.assign(child.context, bindings);
    }
    return child;
  }
  
  isLevelEnabled(level: LogLevel): boolean {
    const configLevel = typeof this.config.level === 'string'
      ? parseLogLevel(this.config.level)
      : this.config.level || LogLevel.INFO;
    return level >= configLevel;
  }
  
  withContext(context: Record<string, any>): Logger {
    return this.child(context);
  }
  
  withError(error: Error): Logger {
    return this.child({
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack
      }
    });
  }
  
  withRequest(req: RequestContext): Logger {
    return this.child({ request: req });
  }
  
  private formatMessage(
    level: LogLevel,
    obj?: Record<string, any>,
    message?: string,
    ...args: any[]
  ): string {
    const timestamp = this.config.timestamp ? new Date().toISOString() : '';
    const levelName = LogLevel[level] || 'UNKNOWN';
    const name = this.config.name ? `[${ this.config.name }]` : '';
    const namespace = this.config.namespace ? `[${ this.config.namespace }]` : '';
    
    let formatted = '';
    if (timestamp) formatted += `${ timestamp } `;
    formatted += `${ levelName }`;
    if (name) formatted += ` ${ name }`;
    if (namespace) formatted += ` ${ namespace }`;
    formatted += ':';
    
    if (message) {
      formatted += ` ${ message }`;
      if (args.length > 0) {
        formatted += ` ${ args.map(arg => typeof arg === 'object' ? JSON.stringify(arg) : String(arg)).join(' ') }`;
      }
    }
    
    // Always include context data if available, combining instance context with passed object
    const contextData = { ...this.context, ...obj };
    if (Object.keys(contextData).length > 0) {
      if (this.config.prettyPrint) {
        formatted += `\n${ JSON.stringify(contextData, null, 2) }`;
      } else {
        formatted += ` ${ JSON.stringify(contextData) }`;
      }
    }
    
    return formatted;
  }
  
  private logToConsole(
    level: LogLevel,
    obj?: Record<string, any>,
    message?: string,
    ...args: any[]
  ): void {
    if (!this.isLevelEnabled(level)) return;
    
    const formatted = this.formatMessage(level, obj, message, ...args);
    
    // Update metrics by creating a new object
    const levelName = LogLevel[level];
    this.metrics = {
      messagesLogged: this.metrics.messagesLogged + 1,
      errorCount: this.metrics.errorCount + (level >= LogLevel.ERROR ? 1 : 0),
      warningCount: this.metrics.warningCount + (level >= LogLevel.WARN ? 1 : 0),
      lastLogTime: new Date(),
      logLevelCounts: {
        ...this.metrics.logLevelCounts,
        [levelName]: (this.metrics.logLevelCounts[levelName] || 0) + 1
      }
    };
    
    // Output to console with appropriate method
    switch (level) {
      case LogLevel.FATAL:
      case LogLevel.ERROR:
        console.error(formatted);
        break;
      case LogLevel.WARN:
        console.warn(formatted);
        break;
      case LogLevel.INFO:
        console.info(formatted);
        break;
      case LogLevel.DEBUG:
      case LogLevel.TRACE:
        console.debug(formatted);
        break;
      default:
        console.log(formatted);
    }
  }
  
  fatal(
    messageOrObj: string | Record<string, any>,
    message?: string,
    ...args: any[]
  ): void {
    if (typeof messageOrObj === 'string') {
      this.logToConsole(LogLevel.FATAL, undefined, messageOrObj, ...args);
    } else {
      this.logToConsole(LogLevel.FATAL, messageOrObj, message, ...args);
    }
  }
  
  error(
    messageOrObjOrError: string | Record<string, any> | Error,
    message?: string,
    ...args: any[]
  ): void {
    if (messageOrObjOrError instanceof Error) {
      const errorObj = {
        error: {
          name: messageOrObjOrError.name,
          message: messageOrObjOrError.message,
          stack: messageOrObjOrError.stack
        }
      };
      this.logToConsole(LogLevel.ERROR, errorObj, message, ...args);
    } else if (typeof messageOrObjOrError === 'string') {
      this.logToConsole(LogLevel.ERROR, undefined, messageOrObjOrError, ...args);
    } else {
      this.logToConsole(LogLevel.ERROR, messageOrObjOrError, message, ...args);
    }
  }
  
  warn(
    messageOrObj: string | Record<string, any>,
    message?: string,
    ...args: any[]
  ): void {
    if (typeof messageOrObj === 'string') {
      this.logToConsole(LogLevel.WARN, undefined, messageOrObj, ...args);
    } else {
      this.logToConsole(LogLevel.WARN, messageOrObj, message, ...args);
    }
  }
  
  info(
    messageOrObj: string | Record<string, any>,
    message?: string,
    ...args: any[]
  ): void {
    if (typeof messageOrObj === 'string') {
      this.logToConsole(LogLevel.INFO, undefined, messageOrObj, ...args);
    } else {
      this.logToConsole(LogLevel.INFO, messageOrObj, message, ...args);
    }
  }
  
  debug(
    messageOrObj: string | Record<string, any>,
    message?: string,
    ...args: any[]
  ): void {
    if (typeof messageOrObj === 'string') {
      this.logToConsole(LogLevel.DEBUG, undefined, messageOrObj, ...args);
    } else {
      this.logToConsole(LogLevel.DEBUG, messageOrObj, message, ...args);
    }
  }
  
  trace(
    messageOrObj: string | Record<string, any>,
    message?: string,
    ...args: any[]
  ): void {
    if (typeof messageOrObj === 'string') {
      this.logToConsole(LogLevel.TRACE, undefined, messageOrObj, ...args);
    } else {
      this.logToConsole(LogLevel.TRACE, messageOrObj, message, ...args);
    }
  }
  
  time(label: string): void {
    this.timers.set(label, Date.now());
    if (this.isLevelEnabled(LogLevel.DEBUG)) {
      console.time(label);
    }
  }
  
  timeEnd(label: string): void {
    const startTime = this.timers.get(label);
    if (startTime) {
      const duration = Date.now() - startTime;
      this.timers.delete(label);
      this.debug({ duration }, `Timer ${ label } finished`);
    }
    if (this.isLevelEnabled(LogLevel.DEBUG)) {
      console.timeEnd(label);
    }
  }
  
  log(
    level: LogLevel,
    obj: Record<string, any>,
    message?: string
  ): void {
    this.logToConsole(level, obj, message);
  }
  
  async flush(): Promise<void> {
    // Console logging is synchronous, no buffering to flush
    return Promise.resolve();
  }
  
  getMetrics(): LoggerMetrics {
    return { ...this.metrics };
  }
}

// export const consoleLogger: Logger = new ConsoleLogger()
