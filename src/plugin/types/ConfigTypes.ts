/**
 * @fileoverview Configuration Types
 *
 * Types related to plugin configuration management, validation,
 * and advanced configuration features. These are primarily used
 * by the context package services, not the core engine.
 */

import { Either } from '@/either';
import { Logger } from '@/logger';
import { ServiceRegistry } from '@/service';
import { Plugin, PluginConfig } from './CoreTypes';
import { CoreLifecycleHooks } from './LifecycleTypes';
import { PluginConfigSource, PluginLoader } from './LoaderTypes';

// Forward declaration to avoid circular dependencies
export interface PluginRegistry {
  register(plugin: Plugin): Either<any, void>;
  getPlugin(id: string): any;
}

/**
 * Extended lifecycle hooks for context package services
 * (More comprehensive than core engine hooks)
 */
export interface PluginLifecycleHooks {
  /** Called before plugin loading */
  beforePluginLoad?(pluginId: string, config: PluginConfig): Promise<void>;
  /** Called after plugin loading */
  afterPluginLoad?(plugin: Plugin): Promise<void>;
  /** Called before plugin initialization */
  beforePluginInit?(plugin: Plugin): Promise<void>;
  /** Called after plugin initialization */
  afterPluginInit?(plugin: Plugin): Promise<void>;
  /** Called before plugin start */
  beforePluginStart?(plugin: Plugin): Promise<void>;
  /** Called after plugin start */
  afterPluginStart?(plugin: Plugin): Promise<void>;
  /** Called before plugin stop */
  beforePluginStop?(plugin: Plugin): Promise<void>;
  /** Called after plugin stop */
  afterPluginStop?(plugin: Plugin): Promise<void>;
  /** Called before plugin cleanup */
  beforePluginCleanup?(plugin: Plugin): Promise<void>;
  /** Called after plugin cleanup */
  afterPluginCleanup?(plugin: Plugin): Promise<void>;
}

/**
 * Configuration for the plugin manager (used by context services)
 */
export interface PluginManagerConfig {
  /** Logger instance for plugin operations */
  logger: Logger;
  /** Plugin registry for managing plugin instances */
  pluginRegistry: PluginRegistry;
  /** Service registry for dependency injection */
  serviceRegistry: ServiceRegistry;
  /** Plugin configuration sources */
  pluginConfigSources: PluginConfigSource[];
  /** Plugin loaders for different plugin types */
  pluginLoaders: PluginLoader[];
  /** Optional lifecycle hooks */
  lifecycleHooks?: PluginLifecycleHooks;
}

/**
 * Plugin grouping and sorting configuration
 */
export interface PluginGrouping {
  /** System plugins (highest priority) */
  system: PluginConfig[];
  /** Library plugins (medium priority) */
  library: PluginConfig[];
  /** User plugins (lowest priority) */
  user: PluginConfig[];
}

/**
 * Configuration validation options
 */
export interface ConfigValidationOptions {
  /** Whether to validate plugin configurations */
  validateConfigs?: boolean;
  /** Whether to validate dependencies */
  validateDependencies?: boolean;
  /** Whether to check for circular dependencies */
  checkCircularDeps?: boolean;
  /** Maximum dependency depth to check */
  maxDepth?: number;
  /** Whether to fail on validation warnings */
  failOnWarnings?: boolean;
}

/**
 * Configuration validation result
 */
export interface ConfigValidationResult {
  /** Whether configuration is valid */
  isValid: boolean;
  /** Validation errors */
  errors: ConfigValidationError[];
  /** Validation warnings */
  warnings: ConfigValidationWarning[];
  /** Valid configurations */
  validConfigs: PluginConfig[];
  /** Invalid configurations */
  invalidConfigs: PluginConfig[];
}

/**
 * Configuration validation error
 */
export interface ConfigValidationError {
  /** Plugin ID with error */
  pluginId: string;
  /** Error message */
  message: string;
  /** Error code */
  code: string;
  /** Additional error details */
  details?: Record<string, any>;
}

/**
 * Configuration validation warning
 */
export interface ConfigValidationWarning {
  /** Plugin ID with warning */
  pluginId: string;
  /** Warning message */
  message: string;
  /** Warning code */
  code: string;
  /** Additional warning details */
  details?: Record<string, any>;
}

/**
 * Dependency resolution configuration
 */
export interface DependencyResolutionOptions {
  /** Whether to include optional dependencies */
  includeOptional?: boolean;
  /** Maximum recursion depth */
  maxDepth?: number;
  /** Whether to fail fast on first error */
  failFast?: boolean;
  /** Whether to resolve in parallel where possible */
  parallel?: boolean;
}

/**
 * Dependency resolution result (used by context services)
 */
export interface DependencyResolutionResult {
  /** Plugins that can be processed */
  resolved: Plugin[];
  /** Plugins with missing dependencies */
  missing: Array<{ plugin: Plugin; missingDependencies: string[] }>;
  /** Plugins with circular dependencies */
  circular: Array<{ plugin: Plugin; cyclePath: string[] }>;
}

/**
 * Detailed dependency resolution result (used by context services)
 */
export interface DetailedResolutionResult {
  /** Successfully resolved plugins in order */
  resolved: PluginConfig[];
  /** Plugins with missing dependencies */
  missing: MissingDependency[];
  /** Circular dependencies detected */
  circular: CircularDependency[];
  /** Complete dependency graph */
  dependencyGraph: Map<string, DependencyNode>;
  /** Resolution order for startup */
  startupOrder: string[];
  /** Resolution order for shutdown (reverse) */
  shutdownOrder: string[];
}

/**
 * Dependency graph node for detailed dependency analysis
 */
export interface DependencyNode {
  /** Plugin configuration */
  config: PluginConfig;
  /** Plugin instance if loaded */
  plugin?: Plugin;
  /** Direct dependencies (plugin IDs) */
  dependencies: string[];
  /** Reverse dependencies (plugins that depend on this one) */
  dependents: string[];
  /** Resolution state */
  state: DependencyState;
  /** Visit state for cycle detection */
  visitState: VisitState;
}

/**
 * Circular dependency information
 */
export interface CircularDependency {
  /** Plugin that starts the cycle */
  pluginId: string;
  /** Complete cycle path */
  cycle: string[];
  /** Error message */
  message: string;
}

/**
 * Missing dependency information
 */
export interface MissingDependency {
  /** Plugin that has missing dependencies */
  pluginId: string;
  /** List of missing dependency IDs */
  missingDeps: string[];
  /** Error message */
  message: string;
}

// Import dependency states from lifecycle types
import { DependencyState, VisitState } from './LifecycleTypes';

/**
 * Plugin metrics and performance data (for context services)
 */
export interface PluginMetrics {
  /** Total number of plugins */
  totalPluginCount: number;
  /** Number of active plugins */
  activePluginCount: number;
  /** Number of failed plugins */
  failedPluginCount: number;
  /** List of failed plugin IDs */
  failedPlugins?: string[] | undefined;
}

/**
 * Performance statistics for plugin operations (for context services)
 */
export interface PerformanceStats {
  /** Average plugin load time in milliseconds */
  averageLoadTime: number;
  /** Average plugin initialization time in milliseconds */
  averageInitTime: number;
  /** Average plugin start time in milliseconds */
  averageStartTime: number;
  /** Average plugin stop time in milliseconds */
  averageStopTime: number;
  /** Slowest plugins during operations */
  slowestPlugins: Array<{ pluginId: string; phase: any; duration: number }>;
  /** Fastest plugins during operations */
  fastestPlugins: Array<{ pluginId: string; phase: any; duration: number }>;
  /** Total number of operations performed */
  totalOperations: number;
}

/**
 * Plugin health status (for context monitoring services)
 */
export interface PluginHealthStatus {
  /** Plugin ID */
  pluginId: string;
  /** Overall health status */
  healthy: boolean;
  /** Last health check timestamp */
  lastCheck: Date;
  /** Health check duration */
  checkDuration: number;
  /** Health details or error message */
  details?: string;
  /** Health score (0-100) */
  score: number;
  /** Performance metrics */
  metrics?: Record<string, number>;
}

/**
 * Aggregated performance statistics for a plugin (for context services)
 */
export interface PluginPerformanceStats {
  /** Plugin ID */
  pluginId: string;
  /** Total operations performed */
  totalOperations: number;
  /** Successful operations */
  successfulOperations: number;
  /** Failed operations */
  failedOperations: number;
  /** Success rate (0-1) */
  successRate: number;
  /** Average operation duration */
  averageDuration: number;
  /** Minimum operation duration */
  minDuration: number;
  /** Maximum operation duration */
  maxDuration: number;
  /** Operation durations by phase */
  durationsByPhase: Map<any, number[]>;
  /** Latest operation result */
  lastOperation?: any;
  /** First operation timestamp */
  firstOperation?: Date;
  /** Last operation timestamp */
  lastOperationTime?: Date;
}

/**
 * System-wide performance summary (for context monitoring services)
 */
export interface SystemPerformanceSummary {
  /** Total plugins managed */
  totalPlugins: number;
  /** Active plugins */
  activePlugins: number;
  /** Failed plugins */
  failedPlugins: number;
  /** Success rate across all operations */
  overallSuccessRate: number;
  /** Average operation duration across all plugins */
  averageOperationDuration: number;
  /** Total operations performed */
  totalOperations: number;
  /** Operations per second */
  operationsPerSecond: number;
  /** System uptime */
  systemUptime: number;
  /** Performance trend (improving/degrading/stable) */
  performanceTrend: 'improving' | 'degrading' | 'stable';
}
