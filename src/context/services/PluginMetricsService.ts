/**
 * @fileoverview Plugin Metrics Service - Dedicated Plugin Performance and Health Metrics
 *
 * Handles all plugin metrics operations including collection, performance tracking,
 * health monitoring, and operation timing.
 */

import { Either } from '@/either';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Logger } from '@/logger';
import { Maybe } from '@/maybe';
import { Plugin } from '@/plugin';
import { PluginMetrics, PluginState } from '@/plugin/types';
import { ApplicationContextError } from '../ApplicationContextError';

const LOGGER_NAMESPACE = "[PluginMetricsService]" as const;

/**
 * Plugin performance statistics
 */
export interface PluginPerformanceStats {
  pluginId: string;
  pluginName: string;
  operationCount: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  minExecutionTime: number;
  maxExecutionTime: number;
  lastOperationTime: Date;
  errorCount: number;
  successRate: number;
}

/**
 * Plugin health status
 */
export interface PluginHealthStatus {
  pluginId: string;
  pluginName: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  state: PluginState;
  uptime: number;
  lastActivity: Date;
  errorRate: number;
  performanceScore: number;
  issues: string[];
  recommendations: string[];
}

/**
 * Plugin operation record
 */
interface PluginOperationRecord {
  operation: string;
  startTime: Date;
  endTime: Date;
  duration: number;
  success: boolean;
  error?: string;
}

/**
 * Plugin metrics management operations
 */
export interface PluginMetricsOperations {
  collectPluginMetrics(pluginId?: string): Promise<Either<ApplicationContextError, PluginMetrics>>;
  getPluginPerformanceStats(pluginId: string): Either<ApplicationContextError, PluginPerformanceStats>;
  trackPluginOperation(pluginId: string, operation: string, duration: number, success?: boolean): Either<ApplicationContextError, void>;
  getPluginHealthStatus(pluginId: string): Either<ApplicationContextError, PluginHealthStatus>;
}

/**
 * PluginMetricsService manages plugin performance and health metrics.
 *
 * This service provides focused functionality for:
 * - Collecting comprehensive plugin metrics
 * - Tracking plugin operation performance
 * - Monitoring plugin health and status
 * - Generating performance statistics and reports
 * - Identifying performance bottlenecks and issues
 */
export class PluginMetricsService implements PluginMetricsOperations {
  private readonly pluginManager: PluginManager;
  private readonly logger: Logger;
  private readonly contextName: string;
  
  // Performance tracking data
  private readonly operationHistory = new Map<string, PluginOperationRecord[]>();
  private readonly pluginStartTimes = new Map<string, Date>();
  private readonly pluginActivityTimes = new Map<string, Date>();
  
  // Health monitoring thresholds
  private static readonly HEALTH_THRESHOLDS = {
    ERROR_RATE_WARNING: 0.1, // 10%
    ERROR_RATE_CRITICAL: 0.25, // 25%
    RESPONSE_TIME_WARNING: 5000, // 5 seconds
    RESPONSE_TIME_CRITICAL: 10000, // 10 seconds
    INACTIVITY_WARNING: 300000, // 5 minutes
    INACTIVITY_CRITICAL: 600000, // 10 minutes
  } as const;

  constructor(pluginManager: PluginManager, logger: Logger, contextName: string) {
    this.pluginManager = pluginManager;
    this.logger = logger;
    this.contextName = contextName;
  }

  // ====================================================================================
  // METRICS COLLECTION OPERATIONS
  // ====================================================================================

  async collectPluginMetrics(pluginId?: string): Promise<Either<ApplicationContextError, PluginMetrics>> {
    this.logger.debug(`${LOGGER_NAMESPACE} Collecting plugin metrics`, {
      contextName: this.contextName,
      pluginId,
      scope: pluginId ? 'single' : 'all'
    });

    try {
      let metrics: PluginMetrics;

      if (pluginId) {
        // Collect metrics for specific plugin
        const plugin = this.pluginManager.getPlugin(pluginId);
        if (Maybe.isNothing(plugin)) {
          return Either.left(this.createPluginNotFoundError(pluginId, 'collectPluginMetrics'));
        }

        metrics = await this.collectSinglePluginMetrics(plugin.value);
      } else {
        // Collect metrics for all plugins
        metrics = await this.collectAllPluginMetrics();
      }

      this.logger.info(`${LOGGER_NAMESPACE} Plugin metrics collected successfully`, {
        contextName: this.contextName,
        pluginId,
        totalPlugins: metrics.totalPluginCount,
        activePlugins: metrics.activePluginCount,
        failedPlugins: metrics.failedPluginCount
      });

      return Either.right(metrics);

    } catch (error) {
      return Either.left(this.createMetricsError(
        'collectPluginMetrics',
        `Failed to collect plugin metrics: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      ));
    }
  }

  private async collectSinglePluginMetrics(plugin: Plugin): Promise<PluginMetrics> {
    const performanceStats = this.calculatePerformanceStats(plugin.id);
    const healthStatus = this.calculateHealthStatus(plugin);

    return {
      totalPluginCount: 1,
      activePluginCount: plugin.state === PluginState.Active ? 1 : 0,
      failedPluginCount: plugin.state === PluginState.Failed ? 1 : 0,
      failedPlugins: plugin.state === PluginState.Failed ? [plugin.id] : []
    };
  }

  private async collectAllPluginMetrics(): Promise<PluginMetrics> {
    try {
      // Get base metrics from PluginManager
      const baseMetrics = this.pluginManager.getPluginMetrics();
      const allPlugins = this.pluginManager.getAllPlugins();

      // Enhance with our detailed metrics
      const individual: Record<string, any> = {};
      
      for (const plugin of allPlugins) {
        const performanceStats = this.calculatePerformanceStats(plugin.id);
        const healthStatus = this.calculateHealthStatus(plugin);

        individual[plugin.id] = {
          id: plugin.id,
          name: plugin.metadata.name,
          state: plugin.state,
          version: plugin.metadata.version,
          uptime: this.calculateUptime(plugin.id),
          performance: performanceStats,
          health: healthStatus,
          lastActivity: this.pluginActivityTimes.get(plugin.id) || new Date()
        };
      }

      return baseMetrics;

    } catch (error) {
      this.logger.error(`${LOGGER_NAMESPACE} Failed to collect all plugin metrics`, {
        contextName: this.contextName,
        error: error instanceof Error ? error.message : String(error)
      });

      // Return default metrics on error
      return {
        totalPluginCount: 0,
        activePluginCount: 0,
        failedPluginCount: 0,
        failedPlugins: []
      };
    }
  }

  // ====================================================================================
  // PERFORMANCE STATISTICS OPERATIONS
  // ====================================================================================

  getPluginPerformanceStats(pluginId: string): Either<ApplicationContextError, PluginPerformanceStats> {
    this.logger.debug(`${LOGGER_NAMESPACE} Getting plugin performance stats`, {
      contextName: this.contextName,
      pluginId
    });

    try {
      const plugin = this.pluginManager.getPlugin(pluginId);
      if (Maybe.isNothing(plugin)) {
        return Either.left(this.createPluginNotFoundError(pluginId, 'getPluginPerformanceStats'));
      }

      const stats = this.calculatePerformanceStats(pluginId);
      
      this.logger.debug(`${LOGGER_NAMESPACE} Plugin performance stats retrieved`, {
        contextName: this.contextName,
        pluginId,
        operationCount: stats.operationCount,
        averageExecutionTime: stats.averageExecutionTime,
        successRate: stats.successRate
      });

      return Either.right(stats);

    } catch (error) {
      return Either.left(this.createMetricsError(
        'getPluginPerformanceStats',
        `Failed to get performance stats: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      ));
    }
  }

  private calculatePerformanceStats(pluginId: string): PluginPerformanceStats {
    const plugin = this.pluginManager.getPlugin(pluginId);
    const pluginName = Maybe.isJust(plugin) ? plugin.value.metadata.name : pluginId;
    
    const operations = this.operationHistory.get(pluginId) || [];
    
    if (operations.length === 0) {
      return {
        pluginId,
        pluginName,
        operationCount: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
        minExecutionTime: 0,
        maxExecutionTime: 0,
        lastOperationTime: new Date(),
        errorCount: 0,
        successRate: 1.0
      };
    }

    const durations = operations.map(op => op.duration);
    const totalExecutionTime = durations.reduce((sum, duration) => sum + duration, 0);
    const errorCount = operations.filter(op => !op.success).length;

    return {
      pluginId,
      pluginName,
      operationCount: operations.length,
      totalExecutionTime,
      averageExecutionTime: totalExecutionTime / operations.length,
      minExecutionTime: Math.min(...durations),
      maxExecutionTime: Math.max(...durations),
      lastOperationTime: operations[operations.length - 1].endTime,
      errorCount,
      successRate: (operations.length - errorCount) / operations.length
    };
  }

  // ====================================================================================
  // OPERATION TRACKING OPERATIONS
  // ====================================================================================

  trackPluginOperation(
    pluginId: string,
    operation: string,
    duration: number,
    success: boolean = true
  ): Either<ApplicationContextError, void> {
    this.logger.debug(`${LOGGER_NAMESPACE} Tracking plugin operation`, {
      contextName: this.contextName,
      pluginId,
      operation,
      duration,
      success
    });

    try {
      const plugin = this.pluginManager.getPlugin(pluginId);
      if (Maybe.isNothing(plugin)) {
        return Either.left(this.createPluginNotFoundError(pluginId, 'trackPluginOperation'));
      }

      // Create operation record
      const now = new Date();
      const operationRecord: PluginOperationRecord = {
        operation,
        startTime: new Date(now.getTime() - duration),
        endTime: now,
        duration,
        success,
        ...(success ? {} : { error: 'Operation failed' })
      };

      // Store operation record
      if (!this.operationHistory.has(pluginId)) {
        this.operationHistory.set(pluginId, []);
      }
      
      const operations = this.operationHistory.get(pluginId)!;
      operations.push(operationRecord);

      // Maintain operation history size (keep last 100 operations)
      if (operations.length > 100) {
        operations.splice(0, operations.length - 100);
      }

      // Update plugin activity time
      this.pluginActivityTimes.set(pluginId, now);

      // Track plugin start time if not already tracked
      if (!this.pluginStartTimes.has(pluginId)) {
        this.pluginStartTimes.set(pluginId, now);
      }

      this.logger.debug(`${LOGGER_NAMESPACE} Plugin operation tracked successfully`, {
        contextName: this.contextName,
        pluginId,
        operation,
        totalOperations: operations.length
      });

      return Either.right(undefined as void);

    } catch (error) {
      return Either.left(this.createMetricsError(
        'trackPluginOperation',
        `Failed to track plugin operation: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      ));
    }
  }

  // ====================================================================================
  // HEALTH STATUS OPERATIONS
  // ====================================================================================

  getPluginHealthStatus(pluginId: string): Either<ApplicationContextError, PluginHealthStatus> {
    this.logger.debug(`${LOGGER_NAMESPACE} Getting plugin health status`, {
      contextName: this.contextName,
      pluginId
    });

    try {
      const plugin = this.pluginManager.getPlugin(pluginId);
      if (Maybe.isNothing(plugin)) {
        return Either.left(this.createPluginNotFoundError(pluginId, 'getPluginHealthStatus'));
      }

      const healthStatus = this.calculateHealthStatus(plugin.value);
      
      this.logger.debug(`${LOGGER_NAMESPACE} Plugin health status retrieved`, {
        contextName: this.contextName,
        pluginId,
        status: healthStatus.status,
        performanceScore: healthStatus.performanceScore,
        issueCount: healthStatus.issues.length
      });

      return Either.right(healthStatus);

    } catch (error) {
      return Either.left(this.createMetricsError(
        'getPluginHealthStatus',
        `Failed to get health status: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      ));
    }
  }

  private calculateHealthStatus(plugin: Plugin): PluginHealthStatus {
    const pluginId = plugin.id;
    const pluginName = plugin.metadata.name;
    const operations = this.operationHistory.get(pluginId) || [];
    const lastActivity = this.pluginActivityTimes.get(pluginId) || new Date();
    const uptime = this.calculateUptime(pluginId);

    // Calculate error rate
    const errorCount = operations.filter(op => !op.success).length;
    const errorRate = operations.length > 0 ? errorCount / operations.length : 0;

    // Calculate average response time
    const avgResponseTime = operations.length > 0
      ? operations.reduce((sum, op) => sum + op.duration, 0) / operations.length
      : 0;

    // Calculate inactivity period
    const inactivityPeriod = Date.now() - lastActivity.getTime();

    // Determine health status
    const issues: string[] = [];
    const recommendations: string[] = [];
    let status: 'healthy' | 'warning' | 'critical' | 'unknown' = 'healthy';

    // Check plugin state
    if (plugin.state === PluginState.Failed) {
      status = 'critical';
      issues.push('Plugin is in failed state');
      recommendations.push('Restart the plugin or check error logs');
    } else if (plugin.state !== PluginState.Active) {
      status = 'warning';
      issues.push(`Plugin is not active (current state: ${plugin.state})`);
      recommendations.push('Ensure plugin is properly started');
    }

    // Check error rate
    if (errorRate >= PluginMetricsService.HEALTH_THRESHOLDS.ERROR_RATE_CRITICAL) {
      status = status === 'healthy' ? 'critical' : status;
      issues.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
      recommendations.push('Investigate and fix recurring errors');
    } else if (errorRate >= PluginMetricsService.HEALTH_THRESHOLDS.ERROR_RATE_WARNING) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push(`Elevated error rate: ${(errorRate * 100).toFixed(1)}%`);
      recommendations.push('Monitor for recurring issues');
    }

    // Check response time
    if (avgResponseTime >= PluginMetricsService.HEALTH_THRESHOLDS.RESPONSE_TIME_CRITICAL) {
      status = status === 'healthy' ? 'critical' : status;
      issues.push(`Very slow response time: ${avgResponseTime.toFixed(0)}ms`);
      recommendations.push('Optimize plugin performance or increase resources');
    } else if (avgResponseTime >= PluginMetricsService.HEALTH_THRESHOLDS.RESPONSE_TIME_WARNING) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push(`Slow response time: ${avgResponseTime.toFixed(0)}ms`);
      recommendations.push('Consider performance optimization');
    }

    // Check inactivity
    if (inactivityPeriod >= PluginMetricsService.HEALTH_THRESHOLDS.INACTIVITY_CRITICAL) {
      status = status === 'healthy' ? 'critical' : status;
      issues.push(`Plugin inactive for ${Math.round(inactivityPeriod / 60000)} minutes`);
      recommendations.push('Check if plugin is stuck or needs restart');
    } else if (inactivityPeriod >= PluginMetricsService.HEALTH_THRESHOLDS.INACTIVITY_WARNING) {
      status = status === 'healthy' ? 'warning' : status;
      issues.push(`Plugin inactive for ${Math.round(inactivityPeriod / 60000)} minutes`);
      recommendations.push('Monitor plugin activity');
    }

    // Calculate performance score (0-100)
    let performanceScore = 100;
    if (errorRate > 0) performanceScore -= errorRate * 50;
    if (avgResponseTime > 1000) performanceScore -= Math.min(40, (avgResponseTime - 1000) / 100);
    if (inactivityPeriod > 60000) performanceScore -= Math.min(30, inactivityPeriod / 60000);
    performanceScore = Math.max(0, Math.round(performanceScore));

    return {
      pluginId,
      pluginName,
      status,
      state: plugin.state,
      uptime,
      lastActivity,
      errorRate,
      performanceScore,
      issues,
      recommendations
    };
  }

  // ====================================================================================
  // CLEANUP OPERATIONS
  // ====================================================================================

  async cleanup(): Promise<Either<ApplicationContextError, void>> {
    this.logger.debug(`${LOGGER_NAMESPACE} Cleaning up plugin metrics service`, {
      contextName: this.contextName,
      trackedPlugins: this.operationHistory.size
    });

    try {
      // Clear all tracking data
      this.operationHistory.clear();
      this.pluginStartTimes.clear();
      this.pluginActivityTimes.clear();

      this.logger.info(`${LOGGER_NAMESPACE} Plugin metrics service cleanup completed`, {
        contextName: this.contextName
      });

      return Either.right(undefined as void);

    } catch (error) {
      return Either.left(this.createMetricsError(
        'cleanup',
        `Plugin metrics service cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error : undefined
      ));
    }
  }

  // ====================================================================================
  // UTILITY METHODS
  // ====================================================================================

  private calculateUptime(pluginId: string): number {
    const startTime = this.pluginStartTimes.get(pluginId);
    if (!startTime) {
      return 0;
    }
    return Date.now() - startTime.getTime();
  }

  getTrackedPluginCount(): number {
    return this.operationHistory.size;
  }

  getTotalOperationCount(): number {
    let total = 0;
    for (const operations of this.operationHistory.values()) {
      total += operations.length;
    }
    return total;
  }

  // ====================================================================================
  // ERROR CREATION HELPERS
  // ====================================================================================

  private createPluginNotFoundError(pluginId: string, operation: string): ApplicationContextError {
    return ApplicationContextError.create(
      UnifiedErrorCode.PLUGIN_NOT_FOUND,
      `Plugin '${pluginId}' not found`,
      operation,
      { contextName: this.contextName, pluginId }
    );
  }

  private createMetricsError(operation: string, message: string, cause?: Error): ApplicationContextError {
    return ApplicationContextError.create(
      UnifiedErrorCode.PLUGIN_EXECUTION_FAILED,
      message,
      operation,
      { contextName: this.contextName },
      undefined,
      cause
    );
  }
}
