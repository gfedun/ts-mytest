/**
 * @fileoverview Simplified Dependency Resolver
 *
 * Focused dependency resolver that handles only core topological sorting
 * for plugin loading order. Complex dependency analysis, circular dependency
 * detection, and advanced dependency management are handled by context services.
 */

import { Either } from '@/either';
import { BasicPluginConfig } from '../config/PluginConfig';
import { PluginError as PluginError } from '../errors/PluginError';

/**
 * Simple dependency resolution result
 */
export interface DependencyResolutionResult {
  /** Plugins sorted in dependency order for startup */
  startupOrder: string[];
  /** Plugins sorted in reverse dependency order for shutdown */
  shutdownOrder: string[];
  /** Total number of plugins processed */
  totalPlugins: number;
}

/**
 * Internal node for dependency graph traversal
 */
interface DependencyNode {
  /** Plugin configuration */
  config: BasicPluginConfig;
  /** Direct dependencies (plugin IDs) */
  dependencies: string[];
  /** Whether this node has been visited */
  visited: boolean;
  /** Whether this node is currently being processed (for basic cycle detection) */
  processing: boolean;
}

/**
 * Simplified Dependency Resolver
 *
 * Handles ONLY essential dependency resolution for the core engine:
 * - Topological sorting for plugin load order
 * - Basic circular dependency detection (fails fast)
 * - Simple missing dependency handling
 *
 * Does NOT handle:
 * - Complex circular dependency analysis and reporting (context services)
 * - Optional dependency resolution (context services)
 * - Dependency conflict resolution (context services)
 * - Dependency version compatibility (context services)
 * - Advanced dependency graphs and visualization (context services)
 * - Dependency hot-swapping (context services)
 */
export class SimpleDependencyResolver {
  
  /**
   * Resolve plugin dependencies and determine load order
   *
   * Uses Kahn's algorithm for topological sorting with basic cycle detection.
   * Fails fast on circular dependencies or missing dependencies.
   *
   * @param configs Array of plugin configurations
   * @returns Either resolution result or error
   */
  public static resolve(configs: BasicPluginConfig[]): Either<PluginError, DependencyResolutionResult> {
    if (configs.length === 0) {
      return Either.right({
        startupOrder: [] as string[],
        shutdownOrder: [] as string[],
        totalPlugins: 0
      });
    }
    
    try {
      // Build dependency graph
      const nodes = this.buildDependencyGraph(configs);
      
      // Check for missing dependencies
      const missingDeps = this.findMissingDependencies(nodes);
      if (missingDeps.length > 0) {
        return Either.left(PluginError.dependencyFailed(
          'multiple',
          'missing',
          missingDeps,
          { operation: 'resolve', missingDependencies: missingDeps }
        ));
      }
      
      // Perform topological sort
      const sortResult = this.topologicalSort(nodes);
      if (Either.isLeft(sortResult)) {
        return Either.left(sortResult.left);
      }
      
      const startupOrder = sortResult.right;
      const shutdownOrder = [...startupOrder].reverse();
      
      return Either.right({
        startupOrder,
        shutdownOrder,
        totalPlugins: configs.length
      });
      
    } catch (error) {
      return Either.left(PluginError.dependencyFailed(
        'multiple',
        'resolution',
        [],
        {
          operation: 'resolve',
          error: error instanceof Error ? error.message : String(error)
        }
      ));
    }
  }
  
  /**
   * Quick validation of dependencies without full resolution
   * Useful for early validation in configuration loading
   */
  public static validateDependencies(configs: BasicPluginConfig[]): Either<PluginError, void> {
    if (configs.length === 0) {
      return Either.right(undefined as void);
    }
    
    const pluginIds = new Set(configs.map(c => c.id));
    const missingDeps: string[] = [];
    
    for (const config of configs) {
      if (config.dependencies) {
        for (const depId of config.dependencies) {
          if (!pluginIds.has(depId)) {
            missingDeps.push(`${ config.id } -> ${ depId }`);
          }
        }
      }
    }
    
    if (missingDeps.length > 0) {
      return Either.left(PluginError.dependencyFailed(
        'multiple',
        'missing',
        missingDeps,
        { operation: 'validateDependencies', missingDependencies: missingDeps }
      ));
    }
    
    return Either.right(undefined as void);
  }
  
  /**
   * Check if dependencies would create a cycle (without full resolution)
   * Simple DFS-based cycle detection
   */
  public static hasCycles(configs: BasicPluginConfig[]): boolean {
    if (configs.length === 0) {
      return false;
    }
    
    const nodes = this.buildDependencyGraph(configs);
    
    // Simple DFS cycle detection
    for (const [pluginId, node] of nodes) {
      if (!node.visited) {
        if (this.hasCycleFromNode(pluginId, nodes, new Set())) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  // ==========================================================================
  // PRIVATE IMPLEMENTATION
  // ==========================================================================
  
  /**
   * Build dependency graph from configurations
   */
  private static buildDependencyGraph(configs: BasicPluginConfig[]): Map<string, DependencyNode> {
    const nodes = new Map<string, DependencyNode>();
    
    // Create nodes for all plugins
    for (const config of configs) {
      nodes.set(config.id, {
        config,
        dependencies: config.dependencies ? [...config.dependencies] : [],
        visited: false,
        processing: false
      });
    }
    
    return nodes;
  }
  
  /**
   * Find missing dependencies
   */
  private static findMissingDependencies(nodes: Map<string, DependencyNode>): string[] {
    const missing: string[] = [];
    const pluginIds = new Set(nodes.keys());
    
    for (const [pluginId, node] of nodes) {
      for (const depId of node.dependencies) {
        if (!pluginIds.has(depId)) {
          missing.push(`${ pluginId } -> ${ depId }`);
        }
      }
    }
    
    return missing;
  }
  
  /**
   * Perform topological sort using Kahn's algorithm
   */
  private static topologicalSort(nodes: Map<string, DependencyNode>): Either<PluginError, string[]> {
    const result: string[] = [];
    const inDegree = new Map<string, number>();
    const queue: string[] = [];
    
    // Calculate in-degrees
    for (const [pluginId] of nodes) {
      inDegree.set(pluginId, 0);
    }
    
    for (const [, node] of nodes) {
      for (const depId of node.dependencies) {
        const currentDegree = inDegree.get(depId) || 0;
        inDegree.set(depId, currentDegree + 1);
      }
    }
    
    // Find nodes with no incoming edges
    for (const [pluginId, degree] of inDegree) {
      if (degree === 0) {
        queue.push(pluginId);
      }
    }
    
    // Process nodes
    while (queue.length > 0) {
      const currentId = queue.shift()!;
      result.push(currentId);
      
      const currentNode = nodes.get(currentId);
      if (currentNode) {
        // For each dependency, reduce in-degree
        for (const depId of currentNode.dependencies) {
          const currentDegree = inDegree.get(depId) || 0;
          const newDegree = currentDegree - 1;
          inDegree.set(depId, newDegree);
          
          if (newDegree === 0) {
            queue.push(depId);
          }
        }
      }
    }
    
    // Check for cycles (remaining nodes with non-zero in-degree)
    if (result.length !== nodes.size) {
      const remainingNodes = Array.from(nodes.keys())
        .filter(id => !result.includes(id));
      
      return Either.left(PluginError.dependencyFailed(
        remainingNodes[0] || 'unknown',
        'circular',
        remainingNodes,
        { operation: 'topologicalSort', involvedPlugins: remainingNodes }
      ));
    }
    
    return Either.right(result);
  }
  
  /**
   * Simple DFS-based cycle detection from a specific node
   */
  private static hasCycleFromNode(
    nodeId: string,
    nodes: Map<string, DependencyNode>,
    path: Set<string>
  ): boolean {
    const node = nodes.get(nodeId);
    if (!node) {
      return false;
    }
    
    if (path.has(nodeId)) {
      // Found cycle
      return true;
    }
    
    if (node.visited) {
      // Already processed this subtree
      return false;
    }
    
    // Add to current path
    path.add(nodeId);
    
    // Check dependencies
    for (const depId of node.dependencies) {
      if (this.hasCycleFromNode(depId, nodes, path)) {
        return true;
      }
    }
    
    // Remove from current path and mark as visited
    path.delete(nodeId);
    node.visited = true;
    
    return false;
  }
}

/**
 * Utility functions for dependency operations
 */
export const DependencyUtils = {
  /**
   * Get all dependencies for a plugin (including transitive)
   * Simple traversal - complex analysis should be done by context services
   */
  getAllDependencies(
    pluginId: string,
    configs: BasicPluginConfig[]
  ): string[] {
    const configMap = new Map(configs.map(c => [c.id, c]));
    const visited = new Set<string>();
    const result: string[] = [];
    
    const traverse = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      
      const config = configMap.get(id);
      if (config?.dependencies) {
        for (const depId of config.dependencies) {
          result.push(depId);
          traverse(depId);
        }
      }
    };
    
    traverse(pluginId);
    return [...new Set(result)]; // Remove duplicates
  },
  
  /**
   * Get plugins that depend on the given plugin
   */
  getDependents(
    pluginId: string,
    configs: BasicPluginConfig[]
  ): string[] {
    return configs
      .filter(c => c.dependencies?.includes(pluginId))
      .map(c => c.id);
  },
  
  /**
   * Check if plugin A depends on plugin B (directly or transitively)
   */
  dependsOn(
    pluginA: string,
    pluginB: string,
    configs: BasicPluginConfig[]
  ): boolean {
    const allDeps = this.getAllDependencies(pluginA, configs);
    return allDeps.includes(pluginB);
  },
  
  /**
   * Get dependency depth for a plugin
   */
  getDependencyDepth(
    pluginId: string,
    configs: BasicPluginConfig[]
  ): number {
    const configMap = new Map(configs.map(c => [c.id, c]));
    
    const getDepth = (
      id: string,
      visited: Set<string> = new Set()
    ): number => {
      if (visited.has(id)) return 0; // Avoid infinite recursion
      visited.add(id);
      
      const config = configMap.get(id);
      if (!config?.dependencies?.length) return 0;
      
      return 1 + Math.max(...config.dependencies.map(depId => getDepth(depId, visited)));
    };
    
    return getDepth(pluginId);
  }
};

/**
 * Type guard to check if an object is a dependency resolution result
 */
export function isDependencyResolutionResult(obj: any): obj is DependencyResolutionResult {
  return obj &&
    typeof obj === 'object' &&
    Array.isArray(obj.startupOrder) &&
    Array.isArray(obj.shutdownOrder) &&
    typeof obj.totalPlugins === 'number';
}
