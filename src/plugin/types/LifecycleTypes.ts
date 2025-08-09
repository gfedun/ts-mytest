/**
 * @fileoverview Lifecycle Types
 *
 * Types related to plugin lifecycle management, state transitions,
 * and lifecycle events. Used by the core engine for orchestrating
 * plugin lifecycle operations.
 */

import { Plugin } from './CoreTypes';

/**
 * Plugin lifecycle phases
 */
export enum LifecyclePhase {
  LOAD = 'load',
  REGISTER = 'register',
  INITIALIZE = 'initialize',
  START = 'start',
  STOP = 'stop',
  CLEANUP = 'cleanup'
}

/**
 * Basic lifecycle hooks for core engine integration
 * (Simplified version - advanced hooks handled by context services)
 */
export interface CoreLifecycleHooks {
  /** Called before plugin loading */
  beforeLoad?(pluginId: string): Promise<void>;
  /** Called after plugin loading */
  afterLoad?(
    pluginId: string,
    plugin: Plugin
  ): Promise<void>;
  /** Called before plugin initialization */
  beforeInitialize?(
    pluginId: string,
    plugin: Plugin
  ): Promise<void>;
  /** Called after plugin initialization */
  afterInitialize?(
    pluginId: string,
    plugin: Plugin
  ): Promise<void>;
  /** Called before plugin start */
  beforeStart?(
    pluginId: string,
    plugin: Plugin
  ): Promise<void>;
  /** Called after plugin start */
  afterStart?(
    pluginId: string,
    plugin: Plugin
  ): Promise<void>;
  /** Called before plugin stop */
  beforeStop?(
    pluginId: string,
    plugin: Plugin
  ): Promise<void>;
  /** Called after plugin stop */
  afterStop?(
    pluginId: string,
    plugin: Plugin
  ): Promise<void>;
  /** Called on lifecycle errors */
  onError?(
    pluginId: string,
    phase: LifecyclePhase,
    error: Error
  ): Promise<void>;
}

/**
 * Individual operation timing data for lifecycle operations
 */
export interface OperationTiming {
  /** Operation phase */
  phase: LifecyclePhase;
  /** Plugin ID */
  pluginId: string;
  /** Start time */
  startTime: number;
  /** End time */
  endTime: number;
  /** Duration in milliseconds */
  duration: number;
  /** Whether operation succeeded */
  success: boolean;
  /** Error details if failed */
  error?: Error;
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Result of a batch lifecycle operation
 */
export interface BatchOperationResult {
  /** Number of successful operations */
  successCount: number;
  /** Number of failed operations */
  failureCount: number;
  /** Total number of operations */
  totalCount: number;
  /** Total duration of the batch operation in milliseconds */
  duration: number;
  /** Individual operation timings */
  operations?: OperationTiming[];
}

/**
 * Dependency resolution states for lifecycle coordination
 */
export enum DependencyState {
  UNRESOLVED = 'unresolved',
  RESOLVING = 'resolving',
  RESOLVED = 'resolved',
  FAILED = 'failed'
}

/**
 * Visit state for dependency graph traversal during lifecycle
 */
export enum VisitState {
  WHITE = 'white',    // Unvisited
  GRAY = 'gray',      // Currently being processed
  BLACK = 'black'     // Completely processed
}
