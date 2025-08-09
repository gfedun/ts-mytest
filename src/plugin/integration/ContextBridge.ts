/**
 * @fileoverview Context Integration Bridge
 *
 * Clean interface between core plugin engine and context orchestration.
 * Provides event emission, metrics hooks, and configuration injection
 * while maintaining clear separation of concerns.
 */

import { Logger } from '@/logger';

import { Plugin } from '../types/CoreTypes';
import { LifecyclePhase } from '../types/LifecycleTypes';
import { PluginError } from '../errors/PluginError';

/**
 * Event data structure for plugin engine events
 */
export interface PluginEngineEvent {
  readonly timestamp: Date;
  readonly eventType: string;
  readonly pluginId?: string;
  readonly phase?: LifecyclePhase;
  readonly data?: Record<string, any>;
  readonly error?: PluginError;
}

/**
 * Metrics data structure for plugin engine metrics
 */
export interface PluginEngineMetrics {
  readonly timestamp: Date;
  readonly metricType: string;
  readonly pluginId?: string;
  readonly value: number;
  readonly unit: string;
  readonly tags?: Record<string, string>;
}

/**
 * Configuration injection callback
 */
export type ConfigurationInjector = (pluginId: string) => Promise<Record<string, any>>;

/**
 * Event emission callback
 */
export type EventEmitter = (event: PluginEngineEvent) => void;

/**
 * Metrics collection callback
 */
export type MetricsCollector = (metrics: PluginEngineMetrics) => void;

/**
 * Context bridge configuration
 */
export interface ContextBridgeConfig {
  readonly eventEmitter?: EventEmitter;
  readonly metricsCollector?: MetricsCollector;
  readonly configurationInjector?: ConfigurationInjector;
  readonly logger?: Logger;
}

/**
 * Context Integration Bridge
 *
 * Provides a clean interface between the core plugin engine and the context
 * orchestration layer. Handles event emission, metrics collection, and
 * configuration injection without creating tight coupling.
 */
export class ContextBridge {
  private readonly logger: Logger;
  private readonly eventEmitter: EventEmitter | undefined;
  private readonly metricsCollector: MetricsCollector | undefined;
  private readonly configurationInjector: ConfigurationInjector | undefined;
  private readonly eventBuffer: PluginEngineEvent[] = [];
  private readonly metricsBuffer: PluginEngineMetrics[] = [];
  private isEnabled = false;

  constructor(config: ContextBridgeConfig = {}) {
    this.logger = config.logger || console as any; // Fallback logger
    this.eventEmitter = config.eventEmitter;
    this.metricsCollector = config.metricsCollector;
    this.configurationInjector = config.configurationInjector;
  }

  /**
   * Enable the context bridge
   */
  enable(): void {
    this.isEnabled = true;
    this.flushBuffers();
    this.logger.debug('[ContextBridge] Bridge enabled');
  }

  /**
   * Disable the context bridge
   */
  disable(): void {
    this.isEnabled = false;
    this.logger.debug('[ContextBridge] Bridge disabled');
  }

  /**
   * Emit a plugin engine event
   */
  emitEvent(eventType: string, pluginId?: string, phase?: LifecyclePhase, data?: Record<string, any>, error?: PluginError): void {
    const event: PluginEngineEvent = {
      timestamp: new Date(),
      eventType
    };

    // Only add optional properties if they have values
    if (pluginId !== undefined) {
      (event as any).pluginId = pluginId;
    }
    if (phase !== undefined) {
      (event as any).phase = phase;
    }
    if (data !== undefined) {
      (event as any).data = data;
    }
    if (error !== undefined) {
      (event as any).error = error;
    }

    if (this.isEnabled && this.eventEmitter) {
      try {
        this.eventEmitter(event);
      } catch (err) {
        this.logger.warn('[ContextBridge] Event emission failed', { error: err, event });
      }
    } else {
      // Buffer events when bridge is not enabled or no emitter configured
      this.eventBuffer.push(event);
      this.trimBuffer(this.eventBuffer, 1000); // Keep last 1000 events
    }
  }

  /**
   * Collect plugin engine metrics
   */
  collectMetrics(metricType: string, value: number, unit: string, pluginId?: string, tags?: Record<string, string>): void {
    const metrics: PluginEngineMetrics = {
      timestamp: new Date(),
      metricType,
      value,
      unit
    };

    // Only add optional properties if they have values
    if (pluginId !== undefined) {
      (metrics as any).pluginId = pluginId;
    }
    if (tags !== undefined) {
      (metrics as any).tags = tags;
    }

    if (this.isEnabled && this.metricsCollector) {
      try {
        this.metricsCollector(metrics);
      } catch (err) {
        this.logger.warn('[ContextBridge] Metrics collection failed', { error: err, metrics });
      }
    } else {
      // Buffer metrics when bridge is not enabled or no collector configured
      this.metricsBuffer.push(metrics);
      this.trimBuffer(this.metricsBuffer, 500); // Keep last 500 metrics
    }
  }

  /**
   * Request configuration injection for a plugin
   */
  async requestConfiguration(pluginId: string): Promise<Record<string, any>> {
    if (!this.isEnabled || !this.configurationInjector) {
      this.logger.debug('[ContextBridge] Configuration injection not available', { pluginId });
      return {};
    }

    try {
      const config = await this.configurationInjector(pluginId);
      this.logger.debug('[ContextBridge] Configuration injected', { pluginId, configKeys: Object.keys(config) });
      return config;
    } catch (err) {
      this.logger.warn('[ContextBridge] Configuration injection failed', { error: err, pluginId });
      return {};
    }
  }

  /**
   * Emit lifecycle event
   */
  emitLifecycleEvent(phase: LifecyclePhase, pluginId: string, plugin?: Plugin, error?: PluginError): void {
    this.emitEvent('lifecycle', pluginId, phase, {
      pluginName: plugin?.metadata?.name,
      pluginVersion: plugin?.metadata?.version
    }, error);
  }

  /**
   * Emit loading event
   */
  emitLoadingEvent(pluginId: string, success: boolean, loadTimeMs?: number, error?: PluginError): void {
    this.emitEvent('loading', pluginId, undefined, {
      success,
      loadTimeMs
    }, error);
  }

  /**
   * Emit dependency event
   */
  emitDependencyEvent(pluginId: string, dependencies: string[], resolved: boolean, error?: PluginError): void {
    this.emitEvent('dependency', pluginId, undefined, {
      dependencies,
      resolved
    }, error);
  }

  /**
   * Collect performance metrics
   */
  collectPerformanceMetrics(pluginId: string, operation: string, durationMs: number): void {
    this.collectMetrics('performance', durationMs, 'milliseconds', pluginId, {
      operation
    });
  }

  /**
   * Collect memory metrics
   */
  collectMemoryMetrics(pluginId: string, memoryUsageMB: number): void {
    this.collectMetrics('memory', memoryUsageMB, 'megabytes', pluginId);
  }

  /**
   * Get buffered events (for debugging or late initialization)
   */
  getBufferedEvents(): readonly PluginEngineEvent[] {
    return [...this.eventBuffer];
  }

  /**
   * Get buffered metrics (for debugging or late initialization)
   */
  getBufferedMetrics(): readonly PluginEngineMetrics[] {
    return [...this.metricsBuffer];
  }

  /**
   * Clear all buffers
   */
  clearBuffers(): void {
    this.eventBuffer.length = 0;
    this.metricsBuffer.length = 0;
    this.logger.debug('[ContextBridge] Buffers cleared');
  }

  /**
   * Check if the bridge is properly configured
   */
  isConfigured(): boolean {
    return !!(this.eventEmitter || this.metricsCollector || this.configurationInjector);
  }

  /**
   * Get bridge status
   */
  getStatus(): {
    enabled: boolean;
    configured: boolean;
    bufferedEvents: number;
    bufferedMetrics: number;
  } {
    return {
      enabled: this.isEnabled,
      configured: this.isConfigured(),
      bufferedEvents: this.eventBuffer.length,
      bufferedMetrics: this.metricsBuffer.length
    };
  }

  /**
   * Flush buffered events and metrics
   */
  private flushBuffers(): void {
    if (this.eventEmitter && this.eventBuffer.length > 0) {
      const events = [...this.eventBuffer];
      this.eventBuffer.length = 0;
      
      for (const event of events) {
        try {
          this.eventEmitter(event);
        } catch (err) {
          this.logger.warn('[ContextBridge] Failed to flush buffered event', { error: err, event });
        }
      }
    }

    if (this.metricsCollector && this.metricsBuffer.length > 0) {
      const metrics = [...this.metricsBuffer];
      this.metricsBuffer.length = 0;
      
      for (const metric of metrics) {
        try {
          this.metricsCollector(metric);
        } catch (err) {
          this.logger.warn('[ContextBridge] Failed to flush buffered metric', { error: err, metric });
        }
      }
    }
  }

  /**
   * Trim buffer to maximum size
   */
  private trimBuffer<T>(buffer: T[], maxSize: number): void {
    if (buffer.length > maxSize) {
      buffer.splice(0, buffer.length - maxSize);
    }
  }
}

/**
 * Factory function for creating a context bridge
 */
export function createContextBridge(config: ContextBridgeConfig = {}): ContextBridge {
  return new ContextBridge(config);
}

/**
 * Default context bridge instance (can be configured globally)
 */
export const defaultContextBridge = createContextBridge();
