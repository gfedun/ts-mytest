/**
 * @fileoverview Core Plugin Error System - Unified Edition
 *
 * Comprehensive error handling for the plugin system using the unified
 * error code system with complete error aggregation and information preservation.
 */

import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import {
  ErrorContext,
  Exception
} from '@/exception/Exception';
import { ExceptionFactory } from '@/exception/ExceptionFactory';
import { symbolLoggable } from "@/logger/Loggable";

/**
 * Plugin-specific context information extending the base ErrorContext
 */
export interface PluginErrorContext
  extends ErrorContext {
  pluginId?: string | undefined;
  pluginName?: string | undefined;
  pluginVersion?: string | undefined;
  pluginPath?: string | undefined;
  dependencies?: string[] | undefined;
  resolutionChain?: string[] | undefined;
  engineState?: string | undefined;
  lifecyclePhase?: string | undefined;
  configurationErrors?: string[] | undefined;
  performanceMetrics?: Record<string, number> | undefined;
}

/**
 * Recovery suggestions for plugin errors
 */
export interface PluginErrorRecovery {
  canRetry: boolean;
  retryDelay?: number;
  maxRetries?: number;
  suggestions: string[];
  alternativeActions?: string[];
}

/**
 * Enhanced CorePluginError using the unified exception system
 */
export class PluginError
  extends Exception {
  public readonly _tag = "PluginError" as const;
  public readonly recovery: PluginErrorRecovery;
  
  constructor(
    code: UnifiedErrorCode,
    message: string,
    context: PluginErrorContext,
    recovery: Partial<PluginErrorRecovery> = {},
    cause?: Error | Exception
  ) {
    const pluginContext: PluginErrorContext = {
      ...context,
      module: 'PLUGIN',
      timestamp: context.timestamp || new Date()
    };
    
    super(code, message, pluginContext, cause);
    // @ts-expect-error
    this[symbolLoggable] = () => this._tag;
    
    this.recovery = {
      canRetry: false,
      suggestions: [],
      alternativeActions: [],
      ...recovery
    };
  }
  
  /**
   * Factory method for easy CorePluginError creation
   */
  static create(
    code: UnifiedErrorCode,
    message: string,
    operation: string,
    pluginContext: Partial<PluginErrorContext> = {},
    recovery?: Partial<PluginErrorRecovery>,
    cause?: Error | Exception
  ): PluginError {
    const context: PluginErrorContext = {
      timestamp: new Date(),
      operation,
      module: 'PLUGIN',
      ...pluginContext
    };
    
    return new PluginError(code, message, context, recovery, cause);
  }
  
  /**
   * Create plugin loading error
   */
  static loadFailed(
    pluginId: string,
    message: string,
    cause?: Error | Exception,
    metadata?: Record<string, any>
  ): PluginError {
    return PluginError.create(
      UnifiedErrorCode.PLUGIN_LOAD_FAILED,
      message,
      'load',
      {
        pluginId,
        ...(metadata && { additionalData: metadata })
      },
      {
        canRetry: true,
        retryDelay: 1000,
        maxRetries: 2,
        suggestions: [
          'Check if plugin file exists and is accessible',
          'Verify plugin format and structure',
          'Check file permissions'
        ]
      },
      cause
    );
  }
  
  /**
   * Create plugin not found error
   */
  static notFound(
    pluginId: string,
    searchPaths?: string[],
    metadata?: Record<string, any>
  ): PluginError {
    return PluginError.create(
      UnifiedErrorCode.PLUGIN_NOT_FOUND,
      `Plugin '${ pluginId }' not found`,
      'load',
      {
        pluginId,
        additionalData: {
          searchPaths,
          ...metadata
        }
      },
      {
        canRetry: false,
        suggestions: [
          'Check plugin ID spelling',
          'Verify plugin is installed in correct location',
          searchPaths?.length ? `Searched in: ${ searchPaths.join(', ') }` : 'No search paths configured'
        ].filter(Boolean)
      }
    );
  }
  
  /**
   * Create plugin registration error
   */
  static registrationFailed(
    pluginId: string,
    message: string,
    cause?: Error | Exception,
    metadata?: Record<string, any>
  ): PluginError {
    return PluginError.create(
      UnifiedErrorCode.PLUGIN_REGISTRATION_FAILED,
      message,
      'register',
      {
        pluginId,
        ...(metadata && { additionalData: metadata })
      },
      {
        canRetry: true,
        retryDelay: 500,
        maxRetries: 1,
        suggestions: [
          'Check if plugin is already registered',
          'Verify plugin implements required interface',
          'Check plugin metadata is valid'
        ]
      },
      cause
    );
  }
  
  /**
   * Create plugin lifecycle error
   */
  static lifecycleFailed(
    pluginId: string,
    operation: 'initialize' | 'start' | 'stop' | 'cleanup',
    message: string,
    cause?: Error | Exception,
    metadata?: Record<string, any>
  ): PluginError {
    const codeMap = {
      initialize: UnifiedErrorCode.PLUGIN_INITIALIZATION_FAILED,
      start: UnifiedErrorCode.INVALID_OPERATION, // Using generic invalid operation since specific codes don't exist
      stop: UnifiedErrorCode.INVALID_OPERATION, // Using generic invalid operation since specific codes don't exist
      cleanup: UnifiedErrorCode.PLUGIN_CLEANUP_FAILED
    };
    
    return PluginError.create(
      codeMap[operation],
      message,
      operation,
      {
        pluginId,
        lifecyclePhase: operation,
        ...(metadata && { additionalData: metadata })
      },
      {
        canRetry: operation === 'start' || operation === 'stop',
        retryDelay: 1000,
        maxRetries: 1,
        suggestions: [
          `Check plugin ${ operation } method implementation`,
          'Verify plugin dependencies are available',
          'Review plugin lifecycle state'
        ]
      },
      cause
    );
  }
  
  /**
   * Create state transition error
   */
  static invalidStateTransition(
    pluginId: string,
    currentState: string,
    targetState: string,
    operation?: string,
    metadata?: Record<string, any>
  ): PluginError {
    return PluginError.create(
      UnifiedErrorCode.INVALID_STATE_TRANSITION,
      `Invalid state transition from ${ currentState } to ${ targetState }`,
      operation || 'state-transition',
      {
        pluginId,
        engineState: currentState,
        additionalData: {
          currentState,
          targetState,
          ...metadata
        }
      },
      {
        canRetry: false,
        suggestions: [
          'Check plugin lifecycle state management',
          'Ensure proper state transition order',
          'Review plugin state machine implementation'
        ]
      }
    );
  }
  
  /**
   * Create dependency error
   */
  static dependencyFailed(
    pluginId: string,
    dependencyType: 'missing' | 'circular' | 'resolution',
    dependencies: string[],
    metadata?: Record<string, any>
  ): PluginError {
    const codeMap = {
      missing: UnifiedErrorCode.MISSING_DEPENDENCIES,
      circular: UnifiedErrorCode.CIRCULAR_DEPENDENCY,
      resolution: UnifiedErrorCode.DEPENDENCY_RESOLUTION_FAILED
    };
    
    const messageMap = {
      missing: `Missing dependencies: ${ dependencies.join(', ') }`,
      circular: `Circular dependency detected involving: ${ dependencies.join(', ') }`,
      resolution: `Dependency resolution failed for: ${ dependencies.join(', ') }`
    };
    
    const recoveryOptions: PluginErrorRecovery = {
      canRetry: dependencyType === 'resolution',
      retryDelay: 1000,
      maxRetries: 1,
      suggestions: {
        missing: [
          'Install missing plugin dependencies',
          'Check dependency configuration',
          'Verify dependency names are correct'
        ],
        circular: [
          'Review plugin dependencies to break circular references',
          'Use lazy initialization for one of the circular dependencies',
          'Refactor plugins to reduce coupling'
        ],
        resolution: [
          'Check dependency resolution order',
          'Verify all dependencies are available',
          'Review dependency graph for conflicts'
        ]
      }[dependencyType]
    };
    
    if (dependencyType === 'circular') {
      recoveryOptions.alternativeActions = [
        'Use dependency injection patterns',
        'Implement plugin interfaces to break dependencies'
      ];
    }
    
    return PluginError.create(
      codeMap[dependencyType],
      messageMap[dependencyType],
      'dependency-resolution',
      {
        pluginId,
        dependencies,
        resolutionChain: dependencies,
        additionalData: { dependencyType, ...metadata }
      },
      recoveryOptions
    );
  }
  
  /**
   * Create configuration error
   */
  static configurationFailed(
    pluginId: string,
    message: string,
    configErrors?: string[],
    metadata?: Record<string, any>
  ): PluginError {
    return PluginError.create(
      UnifiedErrorCode.INVALID_CONFIGURATION,
      message,
      'configuration',
      {
        pluginId,
        ...(configErrors && { configurationErrors: configErrors }),
        additionalData: { configErrors, ...metadata }
      },
      {
        canRetry: false,
        suggestions: [
          'Check plugin configuration format',
          'Verify required configuration properties',
          'Review configuration validation rules',
          ...(configErrors || []).map(error => `Fix: ${ error }`)
        ]
      }
    );
  }
  
  /**
   * Create engine error
   */
  static engineFailed(
    operation: string,
    message: string,
    cause?: Error | Exception,
    metadata?: Record<string, any>
  ): PluginError {
    return PluginError.create(
      UnifiedErrorCode.NOT_INITIALIZED, // Using NOT_INITIALIZED since ENGINE_INITIALIZATION_FAILED doesn't exist
      message,
      operation,
      {
        engineState: 'failed',
        ...(metadata && { additionalData: metadata })
      },
      {
        canRetry: operation !== 'initialize',
        retryDelay: 2000,
        maxRetries: 1,
        suggestions: [
          'Check engine configuration',
          'Verify system resources are available',
          'Review engine initialization sequence'
        ]
      },
      cause
    );
  }
  
  // Enhanced debugging methods following ServiceRegistryError pattern
  
  /**
   * Get plugin-specific short error message
   */
  getShortMessage(): string {
    const pluginContext = this.context as PluginErrorContext;
    let message = `${ this.message }\n`;
    message += `Error Code: ${ this.code }\n`;
    
    if (pluginContext.pluginId) {
      message += `Plugin: ${ pluginContext.pluginId }\n`;
    }
    
    if (pluginContext.operation) {
      message += `Operation: ${ pluginContext.operation }\n`;
    }
    
    return message.trim();
  }
  
  /**
   * Get detailed plugin error information with full chain
   */
  getDetailedMessage(): string {
    const pluginContext = this.context as PluginErrorContext;
    let details = `${ this.message }\n`;
    details += `Error Code: ${ this.code }\n`;
    details += `Chain Depth: ${ this.getChainDepth() }\n`;
    details += `Modules: ${ this.getInvolvedModules().join(' → ') }\n`;
    
    const operations = this.getInvolvedOperations();
    if (operations.length > 0) {
      details += `Operations: ${ operations.join(' → ') }\n`;
    }
    
    // Plugin-specific context
    if (pluginContext.pluginId) details += `Plugin ID: ${ pluginContext.pluginId }\n`;
    if (pluginContext.pluginName) details += `Plugin Name: ${ pluginContext.pluginName }\n`;
    if (pluginContext.pluginVersion) details += `Plugin Version: ${ pluginContext.pluginVersion }\n`;
    if (pluginContext.lifecyclePhase) details += `Lifecycle Phase: ${ pluginContext.lifecyclePhase }\n`;
    if (pluginContext.engineState) details += `Engine State: ${ pluginContext.engineState }\n`;
    if (pluginContext.dependencies) details += `Dependencies: ${ pluginContext.dependencies.join(', ') }\n`;
    if (pluginContext.resolutionChain) details += `Resolution Chain: ${ pluginContext.resolutionChain.join(' → ') }\n`;
    
    // Recovery information
    if (this.recovery.suggestions.length > 0) {
      details += 'Suggestions:\n';
      this.recovery.suggestions.forEach(suggestion => {
        details += `  - ${ suggestion }\n`;
      });
    }
    
    if (this.recovery.alternativeActions?.length) {
      details += 'Alternative Actions:\n';
      this.recovery.alternativeActions.forEach(action => {
        details += `  - ${ action }\n`;
      });
    }
    
    // Error chain messages
    const allMessages = this.getAllMessages();
    if (allMessages.length > 1) {
      details += 'Error Chain:\n';
      allMessages.forEach((
        msg,
        index
      ) => {
        details += `  [${ index }] ${ msg }\n`;
      });
    }
    
    return details.trim();
  }
  
  protected doToDebug(): string {
    return this.getDetailedMessage();
  }
  
  protected doToInfo(): string {
    return this.getShortMessage();
  }
}
