/**
 * @fileoverview Service Extension Points
 *
 * Clear extension points for context package services using Observer/Hook pattern.
 * Provides a structured way for context services to integrate with the core plugin engine
 * without creating tight coupling between the packages.
 */

import { Logger } from '@/logger';

import { Plugin } from '../types/CoreTypes';
import { LifecyclePhase } from '../types/LifecycleTypes';
import { PluginError } from '../errors/PluginError';

/**
 * Plugin lifecycle hook data
 */
export interface LifecycleHookData {
  readonly pluginId: string;
  readonly plugin?: Plugin;
  readonly phase: LifecyclePhase;
  readonly previousPhase?: LifecyclePhase;
  readonly timestamp: Date;
  readonly metadata?: Record<string, any>;
}

/**
 * Plugin loading hook data
 */
export interface LoadingHookData {
  readonly pluginId: string;
  readonly loadPath?: string;
  readonly success: boolean;
  readonly loadTimeMs: number;
  readonly error?: PluginError;
  readonly timestamp: Date;
  readonly metadata?: Record<string, any>;
}

/**
 * Plugin dependency hook data
 */
export interface DependencyHookData {
  readonly pluginId: string;
  readonly dependencies: readonly string[];
  readonly resolved: boolean;
  readonly unresolvedDependencies?: readonly string[];
  readonly circularDependencies?: readonly string[];
  readonly timestamp: Date;
  readonly metadata?: Record<string, any>;
}

/**
 * Plugin configuration hook data
 */
export interface ConfigurationHookData {
  readonly pluginId: string;
  readonly configurationKeys: readonly string[];
  readonly success: boolean;
  readonly error?: PluginError;
  readonly timestamp: Date;
  readonly metadata?: Record<string, any>;
}

/**
 * Plugin registry hook data
 */
export interface RegistryHookData {
  readonly pluginId: string;
  readonly operation: 'register' | 'unregister' | 'update';
  readonly success: boolean;
  readonly error?: PluginError;
  readonly timestamp: Date;
  readonly metadata?: Record<string, any>;
}

/**
 * Plugin error hook data
 */
export interface ErrorHookData {
  readonly pluginId?: string;
  readonly error: PluginError;
  readonly context: string;
  readonly recoverable: boolean;
  readonly timestamp: Date;
  readonly metadata?: Record<string, any>;
}

/**
 * Plugin performance metrics hook data
 */
export interface MetricsHookData {
  readonly pluginId?: string;
  readonly metricName: string;
  readonly value: number;
  readonly unit: string;
  readonly tags?: Record<string, string>;
  readonly timestamp: Date;
  readonly metadata?: Record<string, any>;
}

/**
 * Service hook callback types
 */
export type LifecycleHook = (data: LifecycleHookData) => Promise<void> | void;
export type LoadingHook = (data: LoadingHookData) => Promise<void> | void;
export type DependencyHook = (data: DependencyHookData) => Promise<void> | void;
export type ConfigurationHook = (data: ConfigurationHookData) => Promise<void> | void;
export type RegistryHook = (data: RegistryHookData) => Promise<void> | void;
export type ErrorHook = (data: ErrorHookData) => Promise<void> | void;
export type MetricsHook = (data: MetricsHookData) => Promise<void> | void;

/**
 * Hook priority levels for ordered execution
 */
export enum HookPriority {
  CRITICAL = 1000,    // System-critical hooks (e.g., error handling)
  HIGH = 750,         // High priority hooks (e.g., lifecycle management)
  NORMAL = 500,       // Normal priority hooks (e.g., configuration)
  LOW = 250,          // Low priority hooks (e.g., metrics collection)
  BACKGROUND = 0      // Background hooks (e.g., logging, cleanup)
}

/**
 * Hook registration interface
 */
interface HookRegistration<T> {
  readonly id: string;
  readonly hook: T;
  readonly priority: HookPriority;
  readonly description: string | undefined;
}

/**
 * Service Extension Points Manager
 *
 * Manages hooks and extension points for context package services.
 * Provides a clean Observer pattern implementation for service integration.
 */
export class ServiceHooks {
  private readonly logger: Logger;
  private readonly lifecycleHooks = new Map<string, HookRegistration<LifecycleHook>>();
  private readonly loadingHooks = new Map<string, HookRegistration<LoadingHook>>();
  private readonly dependencyHooks = new Map<string, HookRegistration<DependencyHook>>();
  private readonly configurationHooks = new Map<string, HookRegistration<ConfigurationHook>>();
  private readonly registryHooks = new Map<string, HookRegistration<RegistryHook>>();
  private readonly errorHooks = new Map<string, HookRegistration<ErrorHook>>();
  private readonly metricsHooks = new Map<string, HookRegistration<MetricsHook>>();
  private isEnabled = true;

  constructor(logger?: Logger) {
    this.logger = logger || console as any;
  }

  /**
   * Register a lifecycle hook
   */
  registerLifecycleHook(
    id: string,
    hook: LifecycleHook,
    priority: HookPriority = HookPriority.NORMAL,
    description?: string
  ): void {
    this.lifecycleHooks.set(id, {
      id,
      hook,
      priority,
      description: description ?? undefined
    });
    this.logger.debug('[ServiceHooks] Lifecycle hook registered', { id, priority, description });
  }

  /**
   * Register a loading hook
   */
  registerLoadingHook(
    id: string,
    hook: LoadingHook,
    priority: HookPriority = HookPriority.NORMAL,
    description?: string
  ): void {
    this.loadingHooks.set(id, {
      id,
      hook,
      priority,
      description: description ?? undefined
    });
    this.logger.debug('[ServiceHooks] Loading hook registered', { id, priority, description });
  }

  /**
   * Register a dependency hook
   */
  registerDependencyHook(
    id: string,
    hook: DependencyHook,
    priority: HookPriority = HookPriority.NORMAL,
    description?: string
  ): void {
    this.dependencyHooks.set(id, {
      id,
      hook,
      priority,
      description: description ?? undefined
    });
    this.logger.debug('[ServiceHooks] Dependency hook registered', { id, priority, description });
  }

  /**
   * Register a configuration hook
   */
  registerConfigurationHook(
    id: string,
    hook: ConfigurationHook,
    priority: HookPriority = HookPriority.NORMAL,
    description?: string
  ): void {
    this.configurationHooks.set(id, {
      id,
      hook,
      priority,
      description: description ?? undefined
    });
    this.logger.debug('[ServiceHooks] Configuration hook registered', { id, priority, description });
  }

  /**
   * Register a registry hook
   */
  registerRegistryHook(
    id: string,
    hook: RegistryHook,
    priority: HookPriority = HookPriority.NORMAL,
    description?: string
  ): void {
    this.registryHooks.set(id, {
      id,
      hook,
      priority,
      description: description ?? undefined
    });
    this.logger.debug('[ServiceHooks] Registry hook registered', { id, priority, description });
  }

  /**
   * Register an error hook
   */
  registerErrorHook(
    id: string,
    hook: ErrorHook,
    priority: HookPriority = HookPriority.CRITICAL,
    description?: string
  ): void {
    this.errorHooks.set(id, {
      id,
      hook,
      priority,
      description: description ?? undefined
    });
    this.logger.debug('[ServiceHooks] Error hook registered', { id, priority, description });
  }

  /**
   * Register a metrics hook
   */
  registerMetricsHook(
    id: string,
    hook: MetricsHook,
    priority: HookPriority = HookPriority.LOW,
    description?: string
  ): void {
    this.metricsHooks.set(id, {
      id,
      hook,
      priority,
      description: description ?? undefined
    });
    this.logger.debug('[ServiceHooks] Metrics hook registered', { id, priority, description });
  }

  /**
   * Unregister a hook by ID and type
   */
  unregisterHook(id: string, type?: 'lifecycle' | 'loading' | 'dependency' | 'configuration' | 'registry' | 'error' | 'metrics'): boolean {
    let removed = false;
    
    if (!type || type === 'lifecycle') {
      removed = this.lifecycleHooks.delete(id) || removed;
    }
    if (!type || type === 'loading') {
      removed = this.loadingHooks.delete(id) || removed;
    }
    if (!type || type === 'dependency') {
      removed = this.dependencyHooks.delete(id) || removed;
    }
    if (!type || type === 'configuration') {
      removed = this.configurationHooks.delete(id) || removed;
    }
    if (!type || type === 'registry') {
      removed = this.registryHooks.delete(id) || removed;
    }
    if (!type || type === 'error') {
      removed = this.errorHooks.delete(id) || removed;
    }
    if (!type || type === 'metrics') {
      removed = this.metricsHooks.delete(id) || removed;
    }

    if (removed) {
      this.logger.debug('[ServiceHooks] Hook unregistered', { id, type });
    }

    return removed;
  }

  /**
   * Execute lifecycle hooks
   */
  async executeLifecycleHooks(data: LifecycleHookData): Promise<void> {
    if (!this.isEnabled) return;

    const hooks = this.getSortedHooks(this.lifecycleHooks);
    await this.executeHooks('lifecycle', hooks, data);
  }

  /**
   * Execute loading hooks
   */
  async executeLoadingHooks(data: LoadingHookData): Promise<void> {
    if (!this.isEnabled) return;

    const hooks = this.getSortedHooks(this.loadingHooks);
    await this.executeHooks('loading', hooks, data);
  }

  /**
   * Execute dependency hooks
   */
  async executeDependencyHooks(data: DependencyHookData): Promise<void> {
    if (!this.isEnabled) return;

    const hooks = this.getSortedHooks(this.dependencyHooks);
    await this.executeHooks('dependency', hooks, data);
  }

  /**
   * Execute configuration hooks
   */
  async executeConfigurationHooks(data: ConfigurationHookData): Promise<void> {
    if (!this.isEnabled) return;

    const hooks = this.getSortedHooks(this.configurationHooks);
    await this.executeHooks('configuration', hooks, data);
  }

  /**
   * Execute registry hooks
   */
  async executeRegistryHooks(data: RegistryHookData): Promise<void> {
    if (!this.isEnabled) return;

    const hooks = this.getSortedHooks(this.registryHooks);
    await this.executeHooks('registry', hooks, data);
  }

  /**
   * Execute error hooks
   */
  async executeErrorHooks(data: ErrorHookData): Promise<void> {
    if (!this.isEnabled) return;

    const hooks = this.getSortedHooks(this.errorHooks);
    await this.executeHooks('error', hooks, data);
  }

  /**
   * Execute metrics hooks
   */
  async executeMetricsHooks(data: MetricsHookData): Promise<void> {
    if (!this.isEnabled) return;

    const hooks = this.getSortedHooks(this.metricsHooks);
    await this.executeHooks('metrics', hooks, data);
  }

  /**
   * Enable hook execution
   */
  enable(): void {
    this.isEnabled = true;
    this.logger.debug('[ServiceHooks] Hook execution enabled');
  }

  /**
   * Disable hook execution
   */
  disable(): void {
    this.isEnabled = false;
    this.logger.debug('[ServiceHooks] Hook execution disabled');
  }

  /**
   * Get hook statistics
   */
  getHookStats(): {
    enabled: boolean;
    totalHooks: number;
    hookCounts: Record<string, number>;
  } {
    return {
      enabled: this.isEnabled,
      totalHooks: this.getTotalHookCount(),
      hookCounts: {
        lifecycle: this.lifecycleHooks.size,
        loading: this.loadingHooks.size,
        dependency: this.dependencyHooks.size,
        configuration: this.configurationHooks.size,
        registry: this.registryHooks.size,
        error: this.errorHooks.size,
        metrics: this.metricsHooks.size
      }
    };
  }

  /**
   * Clear all hooks
   */
  clearAllHooks(): void {
    this.lifecycleHooks.clear();
    this.loadingHooks.clear();
    this.dependencyHooks.clear();
    this.configurationHooks.clear();
    this.registryHooks.clear();
    this.errorHooks.clear();
    this.metricsHooks.clear();
    this.logger.debug('[ServiceHooks] All hooks cleared');
  }

  /**
   * Get hooks sorted by priority (highest first)
   */
  private getSortedHooks<T>(hookMap: Map<string, HookRegistration<T>>): HookRegistration<T>[] {
    return Array.from(hookMap.values()).sort((a, b) => b.priority - a.priority);
  }

  /**
   * Execute hooks with error handling
   */
  private async executeHooks<T>(
    type: string,
    hooks: HookRegistration<any>[],
    data: T
  ): Promise<void> {
    for (const registration of hooks) {
      try {
        const result = registration.hook(data);
        if (result && typeof result.then === 'function') {
          await result;
        }
      } catch (error) {
        this.logger.warn(`[ServiceHooks] ${type} hook execution failed`, {
          hookId: registration.id,
          error,
          data
        });
        // Continue executing other hooks even if one fails
      }
    }
  }

  /**
   * Get total hook count across all types
   */
  private getTotalHookCount(): number {
    return this.lifecycleHooks.size +
           this.loadingHooks.size +
           this.dependencyHooks.size +
           this.configurationHooks.size +
           this.registryHooks.size +
           this.errorHooks.size +
           this.metricsHooks.size;
  }
}

/**
 * Default service hooks instance
 */
export const defaultServiceHooks = new ServiceHooks();

/**
 * Factory function for creating service hooks
 */
export function createServiceHooks(logger?: Logger): ServiceHooks {
  return new ServiceHooks(logger);
}
