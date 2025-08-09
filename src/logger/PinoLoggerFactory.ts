/**
 * @fileoverview Pino Logger Factory Implementation
 *
 * This module provides a factory for creating PinoLogger instances with
 * proper Pino configuration handling.
 *
 * @author
 * @version 1.0.0
 */

import {
  Logger,
  LoggerBackendFactory
} from "@/logger/Logger";
import {
  LoggerConfig,
  LoggerFeature,
  LogLevel,
  parseLogLevel
} from "@/logger/types";
import pino, { LoggerOptions } from 'pino';
import { PinoLogger } from './PinoLogger';

/**
 * Factory-specific types that belong here
 */
/**
 * Pino logger factory implementation that creates PinoLogger instances
 * with all necessary Pino configurations
 */
export class PinoLoggerFactoryImpl
  implements LoggerBackendFactory {
  readonly name = 'pino';
  
  createLogger(config: LoggerConfig = {}): Logger {
    const pinoOptions = this.configToPinoOptions(config);
    const pinoInstance = pino(pinoOptions);
    return new PinoLogger(pinoInstance, config);
  }
  
  supportsFeature(feature: LoggerFeature): boolean {
    switch (feature) {
      case LoggerFeature.PRETTY_PRINT:
      case LoggerFeature.STRUCTURED_LOGGING:
      case LoggerFeature.CHILD_LOGGERS:
      case LoggerFeature.CUSTOM_SERIALIZERS:
      case LoggerFeature.PERFORMANCE_TIMING:
      case LoggerFeature.HOOKS:
      case LoggerFeature.METRICS:
        return true;
      case LoggerFeature.ASYNC_LOGGING:
        return false; // Pino handles this internally
      case LoggerFeature.LOG_ROTATION:
        return false; // Requires external transport
      default:
        return false;
    }
  }
  
  getConfigSchema(): Record<string, any> {
    return {
      name: { type: 'string', description: 'Logger name' },
      level: { type: 'string|number', description: 'Log level' },
      prettyPrint: { type: 'boolean', description: 'Enable pretty printing' },
      redact: { type: 'array', description: 'Fields to redact' },
      serializers: { type: 'object', description: 'Custom serializers' },
      timestamp: { type: 'boolean|function', description: 'Timestamp configuration' },
      base: { type: 'object', description: 'Base context object' },
      hooks: { type: 'object', description: 'Lifecycle hooks' },
      formatters: { type: 'object', description: 'Custom formatters' },
      transport: { type: 'object', description: 'Transport configuration' }
    };
  }
  
  async initialize?(globalConfig?: Record<string, any>): Promise<void> {
    // Optional initialization logic for global Pino settings
    if (globalConfig?.pinoGlobals) {
      // Apply any global Pino configurations if needed
    }
  }
  
  /**
   * Convert LoggerConfig to Pino-specific options
   */
  private configToPinoOptions(config: LoggerConfig): LoggerOptions {
    const options: LoggerOptions = {};
    
    // Basic configuration
    if (config.name) options.name = config.name;
    
    // Namespace configuration with brackets formatting
    if (config.namespace) {
      // Add namespace to base context with brackets
      options.base = {
        ...config.base,
        namespace: `[${ config.namespace }]`
      };
      
      // Configure formatters to include namespace in message output
      options.formatters = {
        ...config.formatters,
        log: (object: any) => {
          // Add namespace to the log object for structured output
          if (config.namespace) {
            object.ns = `[${ config.namespace }]`;
          }
          return object;
        }
      };
      
      // For pretty print, configure to show namespace
      if (config.prettyPrint) {
        const prettyOptions = typeof config.prettyPrint === 'object' ? config.prettyPrint : {};
        options.transport = {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            messageFormat: '{ns} {msg}',
            ...prettyOptions
          }
        };
      }
    }
    
    // Log level configuration with proper string parsing
    if (config.level !== undefined) {
      if (typeof config.level === 'number') {
        options.level = this.numberToLevel(config.level);
      } else if (typeof config.level === 'string') {
        // Use parseLogLevel to handle both uppercase and lowercase strings
        const parsedLevel = parseLogLevel(config.level);
        options.level = this.numberToLevel(parsedLevel);
      } else {
        // LogLevel enum value
        options.level = this.numberToLevel(config.level);
      }
    }
    
    // Pretty print configuration
    if (config.prettyPrint === true) {
      options.transport = {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname'
        }
      };
    } else if (typeof config.prettyPrint === 'object') {
      options.transport = {
        target: 'pino-pretty',
        options: config.prettyPrint
      };
    }
    
    // Redaction configuration
    if (config.redact && Array.isArray(config.redact)) {
      options.redact = config.redact;
    }
    
    // Custom serializers
    if (config.serializers) {
      options.serializers = config.serializers;
    }
    
    // Enhanced timestamp configuration with timezone support
    if (config.timestamp !== undefined) {
      if (typeof config.timestamp === 'boolean') {
        options.timestamp = config.timestamp;
      } else if (typeof config.timestamp === 'function') {
        options.timestamp = config.timestamp;
      } else if (typeof config.timestamp === 'object') {
        // Handle TimestampConfig
        const timestampConfig = config.timestamp;
        if (timestampConfig.enabled === false) {
          options.timestamp = false;
        } else if (timestampConfig.format) {
          // Use custom format function
          options.timestamp = timestampConfig.format;
        } else if (timestampConfig.timezone) {
          // Create timezone-aware timestamp function
          options.timestamp = () => {
            const now = new Date();
            const timeZone = timestampConfig.timezone!;
            
            try {
              // Use Intl.DateTimeFormat for timezone conversion (without fractionalSecondDigits)
              const formatter = new Intl.DateTimeFormat('en-CA', {
                timeZone,
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
              });
              
              const parts = formatter.formatToParts(now);
              const partsMap = parts.reduce((
                acc,
                part
              ) => {
                acc[part.type] = part.value;
                return acc;
              }, {} as Record<string, string>);
              
              // Build ISO-like string with timezone
              const isoString = `${ partsMap.year }-${ partsMap.month }-${ partsMap.day }T${ partsMap.hour }:${ partsMap.minute }:${ partsMap.second }`;
              
              // Handle milliseconds manually for better compatibility
              const millisPart = timestampConfig.iso?.milliseconds !== false
                ? `.${ now.getMilliseconds().toString().padStart(3, '0') }`
                : '';
              
              // Get timezone offset for the specified timezone
              const offsetFormatter = new Intl.DateTimeFormat('en', {
                timeZone,
                timeZoneName: 'longOffset'
              });
              const offsetPart = offsetFormatter.formatToParts(now).find(
                part => part.type === 'timeZoneName')?.value || 'Z';
              
              return `,"time":"${ isoString }${ millisPart }${ offsetPart === 'GMT' ? 'Z' : offsetPart }"`;
            } catch (error) {
              // Fallback to UTC if timezone is invalid
              console.warn(`Invalid timezone '${ timeZone }', falling back to UTC`);
              return `,"time":"${ now.toISOString() }"`;
            }
          };
        } else {
          // Default enabled timestamp
          options.timestamp = true;
        }
      }
    }
    
    // Base context
    if (config.base) {
      options.base = config.base;
    }
    
    // Hooks
    if (config.hooks) {
      options.hooks = config.hooks;
    }
    
    return options;
  }
  
  /**
   * Convert numeric log level to Pino level string
   */
  private numberToLevel(level: number): string {
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
}
