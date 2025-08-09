export enum LoggerFeature {
  PRETTY_PRINT = 'prettyPrint',
  STRUCTURED_LOGGING = 'structuredLogging',
  ASYNC_LOGGING = 'asyncLogging',
  LOG_ROTATION = 'logRotation',
  CUSTOM_SERIALIZERS = 'customSerializers',
  HOOKS = 'hooks',
  CHILD_LOGGERS = 'childLoggers',
  PERFORMANCE_TIMING = 'performanceTiming',
  METRICS = 'metrics'
}

/**
 * Log levels supported by the logger abstraction
 */
export enum LogLevel {
  FATAL = 60,
  ERROR = 50,
  WARN = 40,
  INFO = 30,
  DEBUG = 20,
  TRACE = 10
}

/**
 * Type that allows both uppercase and lowercase log level names
 */
export type LogLevelName = keyof typeof LogLevel | Lowercase<keyof typeof LogLevel>;

export function parseLogLevel(level: string): LogLevel {
  const upperLevel = level.toUpperCase() as keyof typeof LogLevel;
  if (upperLevel in LogLevel) {
    return LogLevel[upperLevel];
  }
  return LogLevel.INFO;
}

/**
 * Timestamp configuration options
 */
export interface TimestampConfig {
  /** Whether to include timestamp */
  enabled?: boolean;
  /** Timezone to use (IANA timezone string like 'America/New_York', 'Europe/London', 'UTC') */
  timezone?: string;
  /** Custom timestamp format function */
  format?: () => string;
  /** ISO string format options */
  iso?: {
    /** Include milliseconds in ISO string */
    milliseconds?: boolean;
  };
}

/**
 * Configuration for the smart logger
 */
export interface LoggerConfig {
  readonly name?: string;
  readonly namespace?: string;
  readonly level?: LogLevel | LogLevelName;
  readonly prettyPrint?: boolean;
  readonly redact?: string[];
  readonly serializers?: Record<string, (obj: any) => any>;
  readonly formatters?: Record<string, (obj: any) => any>;
  readonly hooks?: {
    logMethod?: (
      inputArgs: any[],
      method: any,
      level: number
    ) => void;
  };
  readonly base?: Record<string, any>;
  /** Timestamp configuration - supports boolean, function, or detailed config */
  readonly timestamp?: boolean | (() => string) | TimestampConfig;
  readonly messageKey?: string;
  readonly nestedKey?: string;
  readonly mixin?: () => Record<string, any>;
  readonly customLevels?: Record<string, number>;
}

/**
 * Logger metrics for monitoring and debugging
 */
export interface LoggerMetrics {
  readonly messagesLogged: number;
  readonly errorCount: number;
  readonly warningCount: number;
  readonly lastLogTime: Date | undefined;
  readonly logLevelCounts: Record<string, number>;
}

/**
 * Request context for web application logging
 */
export interface RequestContext {
  readonly id?: string;
  readonly method?: string;
  readonly url?: string;
  readonly headers?: Record<string, any>;
  readonly userAgent?: string;
  readonly ip?: string;
}
