/**
 * @fileoverview Logger Package Index
 *
 * This module provides consolidated exports for the logger package,
 * implementing structured logging capabilities.
 *
 * Only exports essential public API elements used by other packages.
 *
 * @author
 * @version 1.0.0
 */

// Core logger interfaces and types
import { NoOpLogger } from "@/logger/LoggerFactory";

export type {
  Logger,
} from './Logger';

export type {
  Loggable
} from "./Loggable"

export type {
  LoggerConfig,
  RequestContext,
} from './types'

export {
  LoggerFactory,
  PinoLoggerFactory,
  ConsoleLoggerFactory,
  ConsoleLogger,
  NoOpLoggerFactory,
  NoOpLogger,
} from "./LoggerFactory"

export { AbstractLoggable } from './Loggable';

export {
  symbolLoggable,
  isLoggable,
  isRedacted,
  redacted
} from './Loggable';

export {
  LogLevel
} from './types'
