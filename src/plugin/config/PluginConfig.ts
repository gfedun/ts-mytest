/**
 * @fileoverview Basic Plugin Configuration
 *
 * Minimal configuration system for the core plugin engine.
 * Handles only essential configuration needed for plugin loading and basic lifecycle.
 * Advanced configuration management is handled by context package services.
 */

import { Either } from '@/either';
import { PluginType } from '../types/CoreTypes';

// Forward declaration to avoid circular dependencies
type PluginError = any;

/**
 * Basic plugin configuration structure
 * Contains only essential information needed by the core engine
 */
export interface BasicPluginConfig {
  /** Unique plugin identifier */
  readonly id: string;
  /** Whether plugin is enabled (defaults to true) */
  readonly enabled?: boolean | undefined;
  /** Plugin type for load ordering */
  readonly type?: PluginType | undefined;
  /** Load priority (higher = earlier, defaults to 0) */
  readonly priority?: number | undefined;
  /** Required dependencies (other plugin IDs) */
  readonly dependencies?: readonly string[] | undefined;
  /** Basic plugin-specific configuration */
  readonly config?: Record<string, any> | undefined;
}

/**
 * Plugin configuration validation result
 */
export interface ConfigValidationResult {
  /** Whether configuration is valid */
  isValid: boolean;
  /** Validation errors if any */
  errors: string[];
  /** Sanitized configuration (with defaults applied) */
  sanitized?: BasicPluginConfig;
}

/**
 * Plugin configuration defaults
 */
export const PLUGIN_CONFIG_DEFAULTS = {
  enabled: true,
  type: PluginType.User,
  priority: 0,
  dependencies: [] as string[],
  config: {} as Record<string, any>
} as const;

/**
 * Basic Plugin Configuration Manager
 *
 * Handles minimal configuration operations needed by the core engine:
 * - Configuration validation
 * - Default value application
 * - Basic sanitization
 *
 * Does NOT handle:
 * - Complex configuration merging (context services)
 * - Configuration persistence (context services)
 * - Schema validation (context services)
 * - Environment variable substitution (context services)
 * - Configuration hot-reloading (context services)
 */
export class BasicPluginConfigManager {
  
  /**
   * Validate a plugin configuration
   */
  public static validateConfig(config: any): ConfigValidationResult {
    const errors: string[] = [];
    
    // Check required fields
    if (!config || typeof config !== 'object') {
      return {
        isValid: false,
        errors: ['Configuration must be an object']
      };
    }
    
    if (!config.id || typeof config.id !== 'string') {
      errors.push('Plugin ID is required and must be a string');
    }
    
    if (config.id && !/^[a-zA-Z0-9_-]+$/.test(config.id)) {
      errors.push('Plugin ID must contain only alphanumeric characters, hyphens, and underscores');
    }
    
    // Validate optional fields
    if (config.enabled !== undefined && typeof config.enabled !== 'boolean') {
      errors.push('enabled must be a boolean');
    }
    
    if (config.type !== undefined && !Object.values(PluginType).includes(config.type)) {
      errors.push(`type must be one of: ${ Object.values(PluginType).join(', ') }`);
    }
    
    if (config.priority !== undefined) {
      if (typeof config.priority !== 'number' || config.priority < 0) {
        errors.push('priority must be a non-negative number');
      }
    }
    
    if (config.dependencies !== undefined) {
      if (!Array.isArray(config.dependencies)) {
        errors.push('dependencies must be an array');
      } else if (!config.dependencies.every((dep: any) => typeof dep === 'string')) {
        errors.push('all dependencies must be strings');
      }
    }
    
    if (config.config !== undefined && (typeof config.config !== 'object' || config.config === null)) {
      errors.push('config must be an object');
    }
    
    if (errors.length > 0) {
      return {
        isValid: false,
        errors
      };
    }
    
    // Apply defaults and return sanitized config
    const sanitized: BasicPluginConfig = {
      id: config.id,
      enabled: config.enabled ?? PLUGIN_CONFIG_DEFAULTS.enabled,
      type: config.type ?? PLUGIN_CONFIG_DEFAULTS.type,
      priority: config.priority ?? PLUGIN_CONFIG_DEFAULTS.priority,
      dependencies: config.dependencies ?? PLUGIN_CONFIG_DEFAULTS.dependencies,
      config: config.config ?? PLUGIN_CONFIG_DEFAULTS.config
    };
    
    return {
      isValid: true,
      errors: [],
      sanitized
    };
  }
  
  /**
   * Validate multiple plugin configurations
   */
  public static validateConfigs(configs: any[]): Either<string[], BasicPluginConfig[]> {
    if (!Array.isArray(configs)) {
      return Either.left(['Configurations must be an array']);
    }
    
    const validConfigs: BasicPluginConfig[] = [];
    const allErrors: string[] = [];
    
    for (let i = 0; i < configs.length; i++) {
      const result = this.validateConfig(configs[i]);
      
      if (!result.isValid) {
        allErrors.push(...result.errors.map(error => `Config ${ i } (${ configs[i]?.id || 'unknown' }): ${ error }`));
      } else if (result.sanitized) {
        validConfigs.push(result.sanitized);
      }
    }
    
    if (allErrors.length > 0) {
      return Either.left(allErrors);
    }
    
    return Either.right(validConfigs);
  }
  
  /**
   * Check for duplicate plugin IDs
   */
  public static checkForDuplicates(configs: BasicPluginConfig[]): string[] {
    const seen = new Set<string>();
    const duplicates: string[] = [];
    
    for (const config of configs) {
      if (seen.has(config.id)) {
        duplicates.push(config.id);
      } else {
        seen.add(config.id);
      }
    }
    
    return duplicates;
  }
  
  /**
   * Sort configurations by priority and type
   */
  public static sortByPriority(configs: BasicPluginConfig[]): BasicPluginConfig[] {
    return [...configs].sort((
      a,
      b
    ) => {
      // First sort by type (system > library > user)
      const typeOrder = {
        [PluginType.System]: 0,
        [PluginType.Library]: 1,
        [PluginType.User]: 2
      };
      
      const typeDiff = typeOrder[a.type!] - typeOrder[b.type!];
      if (typeDiff !== 0) {
        return typeDiff;
      }
      
      // Then by priority (higher first)
      return b.priority! - a.priority!;
    });
  }
  
  /**
   * Filter enabled configurations
   */
  public static filterEnabled(configs: BasicPluginConfig[]): BasicPluginConfig[] {
    return configs.filter(config => config.enabled);
  }
  
  /**
   * Create a minimal configuration for testing
   */
  public static createMinimal(
    id: string,
    overrides?: Partial<BasicPluginConfig>
  ): BasicPluginConfig {
    return {
      id,
      enabled: PLUGIN_CONFIG_DEFAULTS.enabled,
      type: PLUGIN_CONFIG_DEFAULTS.type,
      priority: PLUGIN_CONFIG_DEFAULTS.priority,
      dependencies: [...PLUGIN_CONFIG_DEFAULTS.dependencies],
      config: { ...PLUGIN_CONFIG_DEFAULTS.config },
      ...overrides
    };
  }
}

/**
 * Configuration utility functions for common operations
 */
export const ConfigUtils = {
  /**
   * Check if a configuration has dependencies
   */
  hasDependencies(config: BasicPluginConfig): boolean {
    return config.dependencies !== undefined && config.dependencies.length > 0;
  },
  
  /**
   * Get configuration dependencies as array
   */
  getDependencies(config: BasicPluginConfig): string[] {
    return config.dependencies ? [...config.dependencies] : [];
  },
  
  /**
   * Check if configuration is enabled
   */
  isEnabled(config: BasicPluginConfig): boolean {
    return config.enabled !== false;
  },
  
  /**
   * Get configuration priority with default
   */
  getPriority(config: BasicPluginConfig): number {
    return config.priority ?? PLUGIN_CONFIG_DEFAULTS.priority;
  },
  
  /**
   * Get configuration type with default
   */
  getType(config: BasicPluginConfig): PluginType {
    return config.type ?? PLUGIN_CONFIG_DEFAULTS.type;
  },
  
  /**
   * Get plugin-specific configuration
   */
  getPluginConfig(config: BasicPluginConfig): Record<string, any> {
    return config.config ?? {};
  },
  
  /**
   * Create a copy of configuration with overrides
   */
  override(
    config: BasicPluginConfig,
    overrides: Partial<BasicPluginConfig>
  ): BasicPluginConfig {
    return {
      ...config,
      ...overrides,
      // Ensure arrays and objects are copied, not referenced
      dependencies: overrides.dependencies
        ? [...overrides.dependencies] as readonly string[]
        : config.dependencies
          ? [...config.dependencies] as readonly string[]
          : undefined,
      config: overrides.config
        ? { ...config.config, ...overrides.config }
        : config.config
          ? { ...config.config }
          : undefined
    };
  }
};

/**
 * Type guard to check if an object is a valid BasicPluginConfig
 */
export function isBasicPluginConfig(obj: any): obj is BasicPluginConfig {
  const result = BasicPluginConfigManager.validateConfig(obj);
  return result.isValid;
}

/**
 * Re-export BasicPluginConfig as PluginConfig for compatibility
 */
export type PluginConfig = BasicPluginConfig;
