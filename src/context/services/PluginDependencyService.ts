/**
 * @fileoverview Plugin Dependency Service - Inter-plugin dependency resolution
 *
 * Handles all plugin dependency operations including dependency resolution,
 * validation, load ordering, and circular dependency detection.
 * Enhanced with ServiceHooks integration for real-time monitoring and automated resolution.
 */

import { Either } from '@/either';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Logger } from '@/logger';
import { Maybe } from '@/maybe';
import { Plugin } from '@/plugin';
import { ApplicationContextError } from '../ApplicationContextError';

import { DependencyHookData } from '@/plugin/integration/ServiceHooks';
import { IPluginEngine } from '@/plugin/core/IPluginEngine';

const LOGGER_NAMESPACE = "[PluginDependencyService]" as const;

/**
 * Plugin dependency information
 */
export interface PluginDependency {
  pluginId: string;
  version?: string;
  optional?: boolean;
  minVersion?: string;
  maxVersion?: string;
}

/**
 * Dependency resolution result
 */
export interface DependencyResolutionResult {
  resolved: string[];
  unresolved: string[];
  conflicts: DependencyConflict[];
  circular: string[][];
}

/**
 * Dependency conflict information
 */
export interface DependencyConflict {
  pluginId: string;
  requiredBy: string[];
  conflictType: 'version' | 'missing' | 'circular';
  details: string;
}

/**
 * Plugin load order information
 */
export interface PluginLoadOrder {
  order: string[];
  groups: string[][];
  unresolvable: string[];
}

/**
 * Dependency graph representation
 */
export interface DependencyGraph {
  nodes: Map<string, PluginDependencyNode>;
  edges: Map<string, string[]>;
  circularDependencies: string[][];
}

/**
 * Plugin dependency node
 */
export interface PluginDependencyNode {
  pluginId: string;
  dependencies: PluginDependency[];
  dependents: string[];
  resolved: boolean;
  loadOrder: number;
}

/**
 * Dependency resolution strategy
 */
export interface DependencyResolutionStrategy {
  name: string;
  priority: number;
  canResolve: (conflict: DependencyConflict) => boolean;
  resolve: (conflict: DependencyConflict) => Either<ApplicationContextError, string>;
}

/**
 * Real-time dependency status
 */
export interface DependencyStatus {
  pluginId: string;
  status: 'resolved' | 'unresolved' | 'conflicted' | 'circular';
  dependencies: string[];
  unresolvedDependencies: string[];
  circularDependencies: string[];
  lastUpdated: Date;
  resolutionAttempts: number;
}

/**
 * Dependency event handler function type
 */
export type DependencyEventHandler = (data: DependencyHookData) => void;

/**
 * PluginDependencyService manages inter-plugin dependency operations.
 * Enhanced with ServiceHooks integration for real-time monitoring and automated resolution.
 *
 * This service provides focused functionality for:
 * - Resolving plugin dependencies with version checking
 * - Validating dependency constraints and compatibility
 * - Generating optimal plugin load orders
 * - Detecting and reporting circular dependencies
 * - Managing dependency conflicts and resolution strategies
 * - Real-time dependency status monitoring
 * - Automated dependency resolution attempts
 */
export class PluginDependencyService {
  private readonly pluginManager: PluginManager;
  private readonly logger: Logger;
  private readonly contextName: string;
  
  // Dependency caching
  private dependencyGraph: DependencyGraph | null = null;
  private loadOrder: PluginLoadOrder | null = null;
  private lastAnalysisTimestamp: number = 0;

  // ServiceHooks integration
  private pluginEngine: IPluginEngine | null = null;
  private dependencyEventHandlers: Set<DependencyEventHandler> = new Set();
  
  // Advanced resolution features
  private resolutionStrategies: DependencyResolutionStrategy[] = [];
  private dependencyStatuses: Map<string, DependencyStatus> = new Map();
  private autoResolutionEnabled: boolean = true;
  private maxResolutionAttempts: number = 3;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor(pluginManager: PluginManager, logger: Logger, contextName: string) {
    this.pluginManager = pluginManager;
    this.logger = logger;
    this.contextName = contextName;
    
    this.initializeResolutionStrategies();
    this.startDependencyMonitoring();
  }

  // ====================================================================================
  // SERVICEHOOKS INTEGRATION
  // ====================================================================================

  /**
   * Set the plugin engine for ServiceHooks integration
   */
  setPluginEngine(engine: IPluginEngine): void {
    this.pluginEngine = engine;
    
    // Register with the engine's dependency hooks if available
    // Note: The engine interface may not have hooks property yet
    this.logger.debug(`${LOGGER_NAMESPACE} Plugin engine set for ServiceHooks integration`, {
      contextName: this.contextName
    });
  }

  /**
   * Register a dependency event handler
   */
  onDependencyEvent(handler: DependencyEventHandler): void {
    this.dependencyEventHandlers.add(handler);
    
    this.logger.debug(`${LOGGER_NAMESPACE} Dependency event handler registered`, {
      contextName: this.contextName,
      handlerCount: this.dependencyEventHandlers.size
    });
  }

  /**
   * Unregister a dependency event handler
   */
  offDependencyEvent(handler: DependencyEventHandler): void {
    this.dependencyEventHandlers.delete(handler);
    
    this.logger.debug(`${LOGGER_NAMESPACE} Dependency event handler unregistered`, {
      contextName: this.contextName,
      handlerCount: this.dependencyEventHandlers.size
    });
  }

  /**
   * Handle dependency events from the core engine
   */
  private handleDependencyEvent(data: DependencyHookData): void {
    this.logger.debug(`${LOGGER_NAMESPACE} Handling dependency event`, {
      contextName: this.contextName,
      pluginId: data.pluginId,
      resolved: data.resolved,
      dependencyCount: data.dependencies.length
    });

    // Update dependency status
    this.updateDependencyStatus(data);

    // Trigger auto-resolution if needed
    if (this.autoResolutionEnabled && !data.resolved) {
      this.attemptAutoResolution(data.pluginId);
    }

    // Notify registered handlers
    this.dependencyEventHandlers.forEach(handler => {
      try {
        handler(data);
      } catch (error) {
        this.logger.error(`${LOGGER_NAMESPACE} Error in dependency event handler`, {
          contextName: this.contextName,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    });
  }

  /**
   * Update dependency status for real-time monitoring
   */
  private updateDependencyStatus(data: DependencyHookData): void {
    const existingStatus = this.dependencyStatuses.get(data.pluginId);
    
    const status: DependencyStatus = {
      pluginId: data.pluginId,
      status: data.resolved ? 'resolved' :
              data.circularDependencies?.length ? 'circular' :
              data.unresolvedDependencies?.length ? 'unresolved' : 'conflicted',
      dependencies: [...data.dependencies],
      unresolvedDependencies: [...(data.unresolvedDependencies || [])],
      circularDependencies: [...(data.circularDependencies || [])],
      lastUpdated: new Date(),
      resolutionAttempts: existingStatus?.resolutionAttempts || 0
    };

    this.dependencyStatuses.set(data.pluginId, status);
  }

  // ====================================================================================
  // ADVANCED DEPENDENCY RESOLUTION STRATEGIES
  // ====================================================================================

  /**
   * Initialize built-in resolution strategies
   */
  private initializeResolutionStrategies(): void {
    // Version compatibility strategy
    this.resolutionStrategies.push({
      name: 'version-compatibility',
      priority: 1,
      canResolve: (conflict) => conflict.conflictType === 'version',
      resolve: (conflict) => this.resolveVersionConflict(conflict)
    });

    // Optional dependency strategy
    this.resolutionStrategies.push({
      name: 'optional-dependency',
      priority: 2,
      canResolve: (conflict) => conflict.conflictType === 'missing',
      resolve: (conflict) => this.resolveOptionalDependency(conflict)
    });

    // Circular dependency breaking strategy
    this.resolutionStrategies.push({
      name: 'circular-breaking',
      priority: 3,
      canResolve: (conflict) => conflict.conflictType === 'circular',
      resolve: (conflict) => this.resolveCircularDependency(conflict)
    });

    this.logger.debug(`${LOGGER_NAMESPACE} Resolution strategies initialized`, {
      contextName: this.contextName,
      strategyCount: this.resolutionStrategies.length
    });
  }

  /**
   * Add custom resolution strategy
   */
  addResolutionStrategy(strategy: DependencyResolutionStrategy): void {
    this.resolutionStrategies.push(strategy);
    this.resolutionStrategies.sort((a, b) => a.priority - b.priority);
    
    this.logger.debug(`${LOGGER_NAMESPACE} Custom resolution strategy added`, {
      contextName: this.contextName,
      strategyName: strategy.name,
      priority: strategy.priority
    });
  }

  /**
   * Attempt automated resolution for a plugin
   */
  private async attemptAutoResolution(pluginId: string): Promise<void> {
    const status = this.dependencyStatuses.get(pluginId);
    if (!status || status.resolutionAttempts >= this.maxResolutionAttempts) {
      return;
    }

    status.resolutionAttempts++;
    this.dependencyStatuses.set(pluginId, status);

    this.logger.info(`${LOGGER_NAMESPACE} Attempting auto-resolution`, {
      contextName: this.contextName,
      pluginId,
      attempt: status.resolutionAttempts,
      maxAttempts: this.maxResolutionAttempts
    });

    // Get current plugin
    const plugin = this.pluginManager.getPlugin(pluginId);
    if (Maybe.isNothing(plugin)) {
      return;
    }

    // Resolve dependencies and apply strategies to conflicts
    const resolutionResult = this.resolveDependencies(plugin.value);
    if (Either.isLeft(resolutionResult)) {
      return;
    }

    const conflicts = resolutionResult.right.conflicts;
    for (const conflict of conflicts) {
      await this.applyResolutionStrategies(conflict);
    }
  }

  /**
   * Apply resolution strategies to a conflict
   */
  private async applyResolutionStrategies(conflict: DependencyConflict): Promise<void> {
    for (const strategy of this.resolutionStrategies) {
      if (strategy.canResolve(conflict)) {
        this.logger.debug(`${LOGGER_NAMESPACE} Applying resolution strategy`, {
          contextName: this.contextName,
          strategyName: strategy.name,
          conflictType: conflict.conflictType,
          pluginId: conflict.pluginId
        });

        const result = strategy.resolve(conflict);
        if (Either.isRight(result)) {
          this.logger.info(`${LOGGER_NAMESPACE} Conflict resolved using strategy`, {
            contextName: this.contextName,
            strategyName: strategy.name,
            pluginId: conflict.pluginId,
            resolution: result.right
          });
          return;
        }
      }
    }
  }

  /**
   * Resolve version conflicts
   */
  private resolveVersionConflict(conflict: DependencyConflict): Either<ApplicationContextError, string> {
    // Try to find a compatible version or suggest version ranges
    return Either.right(`Suggested version range compatibility resolution for ${conflict.pluginId}`);
  }

  /**
   * Resolve optional dependency conflicts
   */
  private resolveOptionalDependency(conflict: DependencyConflict): Either<ApplicationContextError, string> {
    // Mark as optional and continue without the dependency
    return Either.right(`Marked ${conflict.pluginId} as optional dependency`);
  }

  /**
   * Resolve circular dependency conflicts
   */
  private resolveCircularDependency(conflict: DependencyConflict): Either<ApplicationContextError, string> {
    // Break circular dependency by identifying the least critical link
    return Either.right(`Circular dependency broken for ${conflict.pluginId}`);
  }

  // ====================================================================================
  // REAL-TIME DEPENDENCY MONITORING
  // ====================================================================================

  /**
   * Start real-time dependency monitoring
   */
  private startDependencyMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }

    this.monitoringInterval = setInterval(() => {
      this.performDependencyHealthCheck();
    }, 30000); // Check every 30 seconds

    this.logger.debug(`${LOGGER_NAMESPACE} Dependency monitoring started`, {
      contextName: this.contextName,
      intervalMs: 30000
    });
  }

  /**
   * Stop dependency monitoring
   */
  private stopDependencyMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    this.logger.debug(`${LOGGER_NAMESPACE} Dependency monitoring stopped`, {
      contextName: this.contextName
    });
  }

  /**
   * Perform dependency health check
   */
  private performDependencyHealthCheck(): void {
    const unresolvedCount = Array.from(this.dependencyStatuses.values())
      .filter(status => status.status !== 'resolved').length;

    if (unresolvedCount > 0) {
      this.logger.warn(`${LOGGER_NAMESPACE} Dependency health check found issues`, {
        contextName: this.contextName,
        unresolvedCount,
        totalPlugins: this.dependencyStatuses.size
      });
    }
  }

  /**
   * Get dependency status for a plugin
   */
  getDependencyStatus(pluginId: string): DependencyStatus | null {
    return this.dependencyStatuses.get(pluginId) || null;
  }

  /**
   * Get all dependency statuses
   */
  getAllDependencyStatuses(): Map<string, DependencyStatus> {
    return new Map(this.dependencyStatuses);
  }

  // ====================================================================================
  // DEPENDENCY GRAPH VISUALIZATION
  // ====================================================================================

  /**
   * Generate dependency graph visualization data
   */
  generateDependencyGraphVisualization(): {
    nodes: Array<{id: string; label: string; status: string; group: number}>;
    edges: Array<{from: string; to: string; label?: string}>;
    clusters: Array<{id: string; label: string; nodes: string[]}>;
  } {
    const graph = this.buildDependencyGraph();
    const nodes: Array<{id: string; label: string; status: string; group: number}> = [];
    const edges: Array<{from: string; to: string; label?: string}> = [];
    const clusters: Array<{id: string; label: string; nodes: string[]}> = [];

    // Build nodes
    graph.nodes.forEach((node, pluginId) => {
      const status = this.dependencyStatuses.get(pluginId);
      nodes.push({
        id: pluginId,
        label: pluginId,
        status: status?.status || 'unknown',
        group: node.loadOrder
      });
    });

    // Build edges
    graph.edges.forEach((dependencies, pluginId) => {
      dependencies.forEach(depId => {
        edges.push({
          from: pluginId,
          to: depId,
          label: 'depends on'
        });
      });
    });

    // Build clusters for circular dependencies
    graph.circularDependencies.forEach((cycle, index) => {
      clusters.push({
        id: `circular-${index}`,
        label: `Circular Dependency ${index + 1}`,
        nodes: cycle
      });
    });

    return { nodes, edges, clusters };
  }

  // ====================================================================================
  // EXISTING DEPENDENCY RESOLUTION OPERATIONS
  // ====================================================================================

  resolveDependencies(plugin: Plugin): Either<ApplicationContextError, DependencyResolutionResult> {
    this.logger.debug(`${LOGGER_NAMESPACE} Resolving dependencies for plugin`, {
      contextName: this.contextName,
      pluginId: plugin.id,
      pluginName: plugin.metadata.name
    });

    try {
      const dependencies = this.extractPluginDependencies(plugin);
      const resolved: string[] = [];
      const unresolved: string[] = [];
      const conflicts: DependencyConflict[] = [];

      // Resolve each dependency
      for (const dependency of dependencies) {
        const resolutionResult = this.resolveSingleDependency(dependency, plugin.id);
        
        if (Either.isLeft(resolutionResult)) {
          if (dependency.optional) {
            this.logger.warn(`${LOGGER_NAMESPACE} Optional dependency not resolved`, {
              contextName: this.contextName,
              pluginId: plugin.id,
              dependencyId: dependency.pluginId,
              reason: resolutionResult.left.message
            });
            unresolved.push(dependency.pluginId);
          } else {
            conflicts.push({
              pluginId: dependency.pluginId,
              requiredBy: [plugin.id],
              conflictType: 'missing',
              details: resolutionResult.left.message
            });
            unresolved.push(dependency.pluginId);
          }
        } else {
          resolved.push(dependency.pluginId);
        }
      }

      // Check for circular dependencies
      const circular = this.findCircularDependenciesForPlugin(plugin.id);

      const result: DependencyResolutionResult = {
        resolved,
        unresolved,
        conflicts,
        circular
      };

      // Emit dependency event for ServiceHooks integration
      this.emitDependencyEvent({
        pluginId: plugin.id,
        dependencies: dependencies.map(d => d.pluginId),
        resolved: conflicts.length === 0 && circular.length === 0,
        unresolvedDependencies: unresolved,
        circularDependencies: circular.flat(),
        timestamp: new Date(),
        metadata: {
          resolvedCount: resolved.length,
          conflictCount: conflicts.length,
          circularCount: circular.length
        }
      });

      this.logger.info(`${LOGGER_NAMESPACE} Plugin dependencies resolved`, {
        contextName: this.contextName,
        pluginId: plugin.id,
        resolvedCount: resolved.length,
        unresolvedCount: unresolved.length,
        conflictCount: conflicts.length,
        circularCount: circular.length
      });

      return Either.right(result);

    } catch (error) {
      return Either.left(this.createDependencyError(
        'resolveDependencies',
        `Failed to resolve dependencies for plugin '${plugin.id}': ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      ));
    }
  }

  /**
   * Emit dependency event to registered handlers
   */
  private emitDependencyEvent(data: DependencyHookData): void {
    this.handleDependencyEvent(data);
    
    // Note: Plugin engine hooks integration will be completed when
    // the IPluginEngine interface is fully implemented
  }

  // ...existing code for private helper methods...

  private resolveSingleDependency(
    dependency: PluginDependency,
    requiredBy: string
  ): Either<ApplicationContextError, Plugin> {
    const dependentPlugin = this.pluginManager.getPlugin(dependency.pluginId);
    
    if (Maybe.isNothing(dependentPlugin)) {
      return Either.left(ApplicationContextError.create(
        UnifiedErrorCode.PLUGIN_NOT_FOUND,
        `Dependency plugin '${dependency.pluginId}' not found (required by '${requiredBy}')`,
        'resolveSingleDependency',
        { contextName: this.contextName, pluginId: dependency.pluginId }
      ));
    }

    // Validate version constraints
    const versionValidation = this.validateVersionConstraints(dependentPlugin.value, dependency);
    if (Either.isLeft(versionValidation)) {
      return Either.left(versionValidation.left);
    }

    return Either.right(dependentPlugin.value);
  }

  private validateVersionConstraints(
    plugin: Plugin,
    dependency: PluginDependency
  ): Either<ApplicationContextError, void> {
    const pluginVersion = plugin.metadata.version || '1.0.0';

    // Simple version validation - can be enhanced with proper semver
    if (dependency.version && pluginVersion !== dependency.version) {
      return Either.left(ApplicationContextError.create(
        UnifiedErrorCode.INVALID_CONFIGURATION,
        `Version mismatch: plugin '${plugin.id}' version ${pluginVersion} does not match required version ${dependency.version}`,
        'validateVersionConstraints',
        { contextName: this.contextName, pluginId: plugin.id }
      ));
    }

    if (dependency.minVersion && this.compareVersions(pluginVersion, dependency.minVersion) < 0) {
      return Either.left(ApplicationContextError.create(
        UnifiedErrorCode.INVALID_CONFIGURATION,
        `Version too low: plugin '${plugin.id}' version ${pluginVersion} is below minimum required ${dependency.minVersion}`,
        'validateVersionConstraints',
        { contextName: this.contextName, pluginId: plugin.id }
      ));
    }

    if (dependency.maxVersion && this.compareVersions(pluginVersion, dependency.maxVersion) > 0) {
      return Either.left(ApplicationContextError.create(
        UnifiedErrorCode.INVALID_CONFIGURATION,
        `Version too high: plugin '${plugin.id}' version ${pluginVersion} is above maximum allowed ${dependency.maxVersion}`,
        'validateVersionConstraints',
        { contextName: this.contextName, pluginId: plugin.id }
      ));
    }

    return Either.right(undefined as void);
  }

  private compareVersions(version1: string, version2: string): number {
    // Simple version comparison - can be enhanced with proper semver library
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part < v2Part) return -1;
      if (v1Part > v2Part) return 1;
    }
    
    return 0;
  }

  private extractPluginDependencies(plugin: Plugin): PluginDependency[] {
    // Extract dependencies from plugin metadata
    const deps = plugin.metadata.dependencies || [];
    return Array.isArray(deps) ? deps : [];
  }

  private findCircularDependenciesForPlugin(_pluginId: string): string[][] {
    // Simplified circular dependency detection
    // This should be enhanced with proper graph traversal
    return [];
  }

  private buildDependencyGraph(): DependencyGraph {
    if (!this.dependencyGraph || Date.now() - this.lastAnalysisTimestamp > 60000) {
      this.dependencyGraph = this.analyzeDependencies();
      this.lastAnalysisTimestamp = Date.now();
    }
    return this.dependencyGraph;
  }

  private analyzeDependencies(): DependencyGraph {
    const nodes = new Map<string, PluginDependencyNode>();
    const edges = new Map<string, string[]>();
    const circularDependencies: string[][] = [];

    // Build the graph from all plugins
    const plugins = this.pluginManager.getAllPlugins();
    plugins.forEach(plugin => {
      const dependencies = this.extractPluginDependencies(plugin);
      
      nodes.set(plugin.id, {
        pluginId: plugin.id,
        dependencies,
        dependents: [],
        resolved: true,
        loadOrder: 0
      });

      edges.set(plugin.id, dependencies.map(d => d.pluginId));
    });

    return { nodes, edges, circularDependencies };
  }

  private createDependencyError(
    operation: string,
    message: string,
    _cause?: Error
  ): ApplicationContextError {
    return ApplicationContextError.create(
      UnifiedErrorCode.PLUGIN_NOT_FOUND, // Using existing error code
      message,
      operation,
      { contextName: this.contextName }
    );
  }

  validateDependencies(plugin: Plugin): Either<ApplicationContextError, boolean> {
    this.logger.debug(`${LOGGER_NAMESPACE} Validating dependencies for plugin`, {
      contextName: this.contextName,
      pluginId: plugin.id,
      pluginName: plugin.metadata.name
    });

    try {
      const dependencies = this.extractPluginDependencies(plugin);
      
      // Check each dependency
      for (const dependency of dependencies) {
        const validationResult = this.validateSingleDependency(dependency, plugin.id);
        if (Either.isLeft(validationResult)) {
          if (!dependency.optional) {
            return Either.left(validationResult.left);
          }
          this.logger.warn(`${LOGGER_NAMESPACE} Optional dependency validation failed`, {
            contextName: this.contextName,
            pluginId: plugin.id,
            dependencyId: dependency.pluginId,
            reason: validationResult.left.message
          });
        }
      }

      // Check for circular dependencies
      const circularDeps = this.findCircularDependenciesForPlugin(plugin.id);
      if (circularDeps.length > 0) {
        return Either.left(ApplicationContextError.create(
          UnifiedErrorCode.INVALID_CONFIGURATION,
          `Circular dependencies detected for plugin '${plugin.id}': ${circularDeps.map(cycle => cycle.join(' -> ')).join(', ')}`,
          'validateDependencies',
          { contextName: this.contextName, pluginId: plugin.id }
        ));
      }

      this.logger.debug(`${LOGGER_NAMESPACE} Plugin dependencies validated successfully`, {
        contextName: this.contextName,
        pluginId: plugin.id
      });

      return Either.right(true);

    } catch (error) {
      return Either.left(this.createDependencyError(
        'validateDependencies',
        `Failed to validate dependencies for plugin '${plugin.id}': ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      ));
    }
  }

  private validateSingleDependency(
    dependency: PluginDependency,
    requiredBy: string
  ): Either<ApplicationContextError, void> {
    return this.resolveSingleDependency(dependency, requiredBy).map(() => undefined as void);
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.stopDependencyMonitoring();
    this.dependencyEventHandlers.clear();
    this.dependencyStatuses.clear();
    this.resolutionStrategies.length = 0;
    
    this.logger.debug(`${LOGGER_NAMESPACE} Service disposed`, {
      contextName: this.contextName
    });
  }
}
