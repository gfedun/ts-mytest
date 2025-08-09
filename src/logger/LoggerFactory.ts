/**
 * @fileoverview Logger Factory with Pluggable Backends
 *
 * This module provides a factory for creating logger instances
 * with pluggable backends (Pino, NoOp, or any other implementation).
 *
 * @author
 * @version 1.0.0
 */

import { Either } from '@/either';
import { ConsoleLoggerFactoryImpl } from "@/logger/ConsoleLoggerFactory";
import {
  Logger,
  LoggerBackendFactory,
} from "@/logger/Logger";
import {
  LoggerConfig,
  LogLevel
} from "@/logger/types";
import { Maybe } from '@/maybe';
import { Resolve } from "@/utils";
import { NoOpLoggerFactoryImpl } from './NoOpLoggerFactory';
import { PinoLoggerFactoryImpl } from './PinoLoggerFactory';

// Additional factory types
export abstract class LoggerFactory {
  
  static create(initialBackend: LoggerBackendFactory): LoggerFactory {
    return new LoggerFactoryImpl(initialBackend)
  }
  
  static createNoOp(): LoggerFactory {
    return LoggerFactory.create(new NoOpLoggerFactoryImpl())
  }
  
  static createConsole(): LoggerFactory {
    return LoggerFactory.create(new ConsoleLoggerFactoryImpl())
  }
  
  static createPino(): LoggerFactory {
    return LoggerFactory.create(new PinoLoggerFactoryImpl())
  }
  
  abstract createLogger(config?: LoggerConfig): Logger;
  abstract getLogger(name: string): Logger;
  abstract setGlobalDefaults(defaults: Partial<LoggerConfig>): void;
  
  // abstract setBackend(backend: LoggerBackendFactory): void;
  // abstract getBackend(): LoggerBackendFactory;
  // abstract createLoggerWithBackend(
  //   backendName: string,
  //   config?: LoggerConfig
  // ): Either<string, Logger>;
  // abstract clearCache(): void;
  // abstract getRegistry(): any;
}

type MandatoryLoggerConfigFields = "name" | "level"

type DefaultLoggerConfigType =
  Resolve<Omit<LoggerConfig, MandatoryLoggerConfigFields> &
    Required<Pick<LoggerConfig, MandatoryLoggerConfigFields>>>

const DEFAULT_LOGGER_CONFIG: DefaultLoggerConfigType = {
  name: "app",
  level: LogLevel.INFO,
  messageKey: 'msg',
  timestamp: {
    timezone: 'America/Chicago'
  },
}

/**
 * Logger factory implementation with pluggable backends
 */
class LoggerFactoryImpl
  extends LoggerFactory {
  
  private backend: LoggerBackendFactory;
  private readonly loggers = new Map<string, Logger>();
  private globalDefaults: DefaultLoggerConfigType = {
    ...DEFAULT_LOGGER_CONFIG
  };
  
  constructor(initialBackend?: LoggerBackendFactory) {
    super()
    this.backend = initialBackend || new ConsoleLoggerFactoryImpl();
  }
  
  setBackend(backend: LoggerBackendFactory): void {
    this.backend = backend;
    this.loggers.clear();
  }
  
  getBackend(): LoggerBackendFactory {
    return this.backend;
  }
  
  createLogger(config?: LoggerConfig): Logger {
    const mergedConfig = { ...this.globalDefaults, ...config };
    const logger = this.backend.createLogger(mergedConfig);
    this.loggers.set(this.createLoggerName(mergedConfig.name), logger);
    return logger
  }
  
  createLoggerWithBackend(
    backendName: string,
    config?: LoggerConfig
  ): Either<string, Logger> {
    const availableBackends = Backends as Record<string, LoggerBackendFactory>;
    const backend = Object.values(availableBackends).find(b => b.name === backendName);
    if (!backend) {
      return Either.left(`Backend '${ backendName }' not found`);
    }
    try {
      const mergedConfig = { ...this.globalDefaults, ...config };
      const logger = backend.createLogger(mergedConfig);
      this.loggers.set(this.createLoggerName(mergedConfig.name), logger);
      return Either.right(logger);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return Either.left(`Failed to create logger with backend '${ backendName }': ${ message }`);
    }
  }
  
  setGlobalDefaults(defaults: Partial<LoggerConfig>): void {
    this.globalDefaults = { ...this.globalDefaults, ...defaults };
  }
  
  // getLogger(name: string): Option.Option<Logger> {
  //   const key = `${ this.backend.name }:${ name }`;
  //   const logger = this.loggers.get(key);
  //   return logger ? Option.some(logger) : Option.none();
  // }
  
  getLogger(name: string): Logger {
    const key = `${ this.backend.name }:${ name }`;
    const logger = this.loggers.get(key);
    return logger ? logger : this.createLogger({ name: key });
    
  }
  
  clearCache(): void {
    this.loggers.clear();
  }
  
  getRegistry(): any {
    // Simple registry implementation
    return {
      register: (
        name: string,
        factory: LoggerBackendFactory
      ) => {
        (Backends as any)[name] = factory;
      },
      get: (name: string) => {
        const backend = Object.values(Backends).find(b => b.name === name);
        return backend ? Maybe.just(backend) : Maybe.nothing();
      },
      has: (name: string) => {
        return Object.values(Backends).some(b => b.name === name);
      },
      list: () => {
        return Object.values(Backends).map(b => b.name);
      },
      unregister: (name: string) => {
        const key = Object.keys(Backends).find(k => (Backends as any)[k].name === name);
        if (key) {
          delete (Backends as any)[key];
          return true;
        }
        return false;
      }
    };
  }
  
  // Legacy methods for backward compatibility
  create(config: LoggerConfig = {}): Logger {
    return this.createLogger(config);
  }
  
  private createLoggerName(name?: string) {
    if (name != undefined) {
      return `${ this.backend.name }:${ name }`;
    } else {
      return `${ this.backend.name }:#`;
    }
  }
}

/**
 * Utility functions for logger
 */
export class LoggerUtilsImpl {
  parseLevel(level: string | number): Maybe<LogLevel> {
    if (typeof level === 'number') {
      const found = Object.values(LogLevel).find(l => l === level);
      return found !== undefined ? Maybe.just(found as LogLevel) : Maybe.nothing();
    }
    
    const upperLevel = level.toUpperCase() as keyof typeof LogLevel;
    const logLevel = LogLevel[upperLevel];
    return logLevel !== undefined ? Maybe.just(logLevel) : Maybe.nothing();
  }
  
  errorSerializer(error: Error): Record<string, any> {
    return {
      type: error.name,
      message: error.message,
      stack: error.stack,
      ...(typeof error.cause === 'object' || typeof error.cause === 'string' ? { cause: error.cause } : {})
    };
  }
  
  requestSerializer(req: any): Record<string, any> {
    return {
      id: req.id || req.requestId,
      method: req.method,
      url: req.url || req.originalUrl,
      headers: req.headers,
      remoteAddress: req.connection?.remoteAddress || req.socket?.remoteAddress,
      remotePort: req.connection?.remotePort || req.socket?.remotePort
    };
  }
  
  responseSerializer(res: any): Record<string, any> {
    return {
      statusCode: res.statusCode,
      headers: res.getHeaders ? res.getHeaders() : res.headers,
      responseTime: res.responseTime
    };
  }
  
  createRedactor(paths: string[]): (obj: any) => any {
    return (obj: any) => {
      if (!obj || typeof obj !== 'object') return obj;
      
      const result = { ...obj };
      paths.forEach(path => {
        if (path in result) {
          result[path] = '[REDACTED]';
        }
      });
      
      return result;
    };
  }
  
  formatMessage(
    template: string,
    values: Record<string, any>
  ): string {
    return template.replace(/\{(\w+)\}/g, (
      match,
      key
    ) => {
      return values[key] !== undefined ? String(values[key]) : match;
    });
  }
  
  createCorrelationId(): string {
    return `${ Date.now() }-${ Math.random().toString(36).substring(2, 9) }`;
  }
}

// Export available backends
export const Backends = {
  Pino: new PinoLoggerFactoryImpl(),
  NoOp: new NoOpLoggerFactoryImpl(),
  Console: new ConsoleLoggerFactoryImpl(),
}

export const PinoLoggerFactory: LoggerFactory = LoggerFactory.createPino()
export const ConsoleLoggerFactory: LoggerFactory = LoggerFactory.createConsole()
export const ConsoleLogger: Logger = ConsoleLoggerFactory.createLogger();
export const NoOpLoggerFactory: LoggerFactory = LoggerFactory.createNoOp();
export const NoOpLogger: Logger = NoOpLoggerFactory.createLogger();
