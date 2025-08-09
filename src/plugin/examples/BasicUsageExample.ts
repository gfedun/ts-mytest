/**
 * @fileoverview Basic XPlugin Usage Example
 *
 * Demonstrates how to use the refactored xplugin system with:
 * - PluginEngineBuilder for core engine configuration
 * - ContextBridge for integration with context orchestration
 * - ServiceHooks for extension points
 * - Basic plugin creation and lifecycle management
 */

import { Either } from '@/either';
import { ServiceRegistry } from '@/service';

// Core xplugin imports
import { createPluginEngineBuilder } from '../builder/PluginEngineBuilder';
import { IPluginEngine } from '../core/IPluginEngine';
import { PluginError } from '../errors/PluginError';
import { createContextBridge } from '../integration/ContextBridge';
import {
  createServiceHooks,
  HookPriority
} from '../integration/ServiceHooks';
import { FocusedPluginRegistry } from '../registry/PluginRegistry';
import {
  Plugin,
  PluginConfig,
  PluginHealth,
  PluginMetadata,
  PluginState
} from '../types/CoreTypes';
import { LifecyclePhase } from '../types/LifecycleTypes';

/**
 * Example Plugin Implementation
 */
class ExamplePlugin
  implements Plugin {
  public readonly metadata: PluginMetadata = {
    id: 'example-plugin',
    name: 'Example Plugin',
    version: '1.0.0',
    description: 'A simple example plugin for demonstration'
  };
  
  public readonly id: string = 'example-plugin';
  private currentState: PluginState = PluginState.Registered;
  private isInitialized = false;
  private isStarted = false;
  
  get state(): PluginState {
    return this.currentState;
  }
  
  async initialize(): Promise<Either<PluginError, void>> {
    console.log(`[${ this.metadata.name }] Initializing...`);
    // Simulate some async initialization work
    await new Promise(resolve => setTimeout(resolve, 100));
    this.isInitialized = true;
    this.currentState = PluginState.Loaded;
    console.log(`[${ this.metadata.name }] Initialized successfully`);
    return Either.right(undefined as void);
  }
  
  async start(): Promise<Either<PluginError, void>> {
    if (!this.isInitialized) {
      return Either.left(new PluginError(
        'PLUGIN_LIFECYCLE_ERROR' as any,
        'Plugin must be initialized before starting',
        { pluginId: this.id, engineState: 'starting', timestamp: new Date(), module: "AA" }
      ));
    }
    console.log(`[${ this.metadata.name }] Starting...`);
    this.isStarted = true;
    this.currentState = PluginState.Active;
    console.log(`[${ this.metadata.name }] Started successfully`);
    return Either.right(undefined as void);
  }
  
  async stop(): Promise<Either<PluginError, void>> {
    console.log(`[${ this.metadata.name }] Stopping...`);
    this.isStarted = false;
    this.currentState = PluginState.Suspended;
    console.log(`[${ this.metadata.name }] Stopped successfully`);
    return Either.right(undefined as void);
  }
  
  async destroy(): Promise<void> {
    console.log(`[${ this.metadata.name }] Destroying...`);
    this.isInitialized = false;
    this.isStarted = false;
    this.currentState = PluginState.Unloaded;
    console.log(`[${ this.metadata.name }] Destroyed successfully`);
  }
  
  async getHealth(): Promise<PluginHealth> {
    return {
      status: this.isStarted ? 'healthy' : 'unhealthy',
      timestamp: new Date(),
      healthy: this.isStarted,
    };
  }
  
  async cleanup(): Promise<void> {
    await this.destroy();
  }
}

/**
 * Basic Usage Example
 */
export async function basicXPluginExample(): Promise<void> {
  console.log('\n=== XPlugin Basic Usage Example ===\n');
  
  // Step 1: Create a logger (you can use any logger that implements the Logger interface)
  const logger = console as any; // Simplified logger for this example
  
  // Step 2: Create service registry (in real usage, this would be provided by your application)
  const serviceRegistry = ServiceRegistry.create(logger);
  
  // Step 3: Create and configure the plugin engine using the builder
  console.log('1. Building plugin engine...');
  const pluginEngine = createPluginEngineBuilder()
    .withLogger(logger)
    .withServiceRegistry(serviceRegistry)
    .withPluginRegistry(new FocusedPluginRegistry())
    .build();
  
  // Step 4: Set up integration bridges for context orchestration
  console.log('2. Setting up integration bridges...');
  
  // Context bridge for event emission and metrics collection
  const contextBridge = createContextBridge({
    logger,
    eventEmitter: (event) => {
      console.log(`[ContextBridge] Event: ${ event.eventType }`, {
        pluginId: event.pluginId,
        phase: event.phase,
        timestamp: event.timestamp
      });
    },
    metricsCollector: (metrics) => {
      console.log(`[ContextBridge] Metrics: ${ metrics.metricType }`, {
        value: metrics.value,
        unit: metrics.unit,
        pluginId: metrics.pluginId
      });
    },
    configurationInjector: async (pluginId) => {
      // Example configuration injection
      return {
        environment: 'development',
        debugMode: true,
        customSetting: `Config for ${ pluginId }`
      };
    }
  });
  
  // Service hooks for extension points
  const serviceHooks = createServiceHooks(logger);
  
  // Register some example hooks
  serviceHooks.registerLifecycleHook(
    'lifecycle-logger',
    async (data) => {
      console.log(`[ServiceHook] Lifecycle: ${ data.phase } for plugin ${ data.pluginId }`);
    },
    HookPriority.HIGH,
    'Logs all plugin lifecycle events'
  );
  
  serviceHooks.registerMetricsHook(
    'performance-monitor',
    async (data) => {
      if (data.metricName === 'performance' && data.value > 1000) {
        console.log(`[ServiceHook] Performance warning: ${ data.pluginId } took ${ data.value }ms`);
      }
    },
    HookPriority.NORMAL,
    'Monitors plugin performance metrics'
  );
  
  // Enable the bridges
  contextBridge.enable();
  serviceHooks.enable();
  
  // Step 5: Create plugin configurations
  console.log('3. Creating plugin configurations...');
  const pluginConfigs: PluginConfig[] = [
    {
      id: 'example-plugin',
      enabled: true,
      type: 'user' as any, // PluginType.User
      priority: 100,
      dependencies: [],
      config: {
        customSetting: 'example-value'
      }
    }
  ];
  
  // Step 6: Initialize and start the plugin engine
  console.log('4. Initializing plugin engine...');
  
  // Set up lifecycle hook for integration
  pluginEngine.setLifecycleHook(async (
    phase,
    pluginId,
    plugin,
    error
  ) => {
    // Emit events through context bridge
    contextBridge.emitLifecycleEvent(phase as LifecyclePhase, pluginId, plugin, error as any);
    
    // Execute service hooks - only if plugin is defined
    if (plugin) {
      await serviceHooks.executeLifecycleHooks({
        pluginId,
        plugin,
        phase: phase as LifecyclePhase,
        timestamp: new Date(),
        metadata: { source: 'basic-example' }
      });
    } else {
      // Handle case where plugin is undefined (e.g., during error scenarios)
      await serviceHooks.executeLifecycleHooks({
        pluginId,
        phase: phase as LifecyclePhase,
        timestamp: new Date(),
        metadata: { source: 'basic-example', error: 'plugin-undefined' }
      });
    }
    
    // Collect performance metrics
    contextBridge.collectPerformanceMetrics(pluginId, `phase-${ phase }`, Math.random() * 500);
  });
  
  // Initialize with plugin configurations
  const initResult = await pluginEngine.initialize(pluginConfigs);
  if (initResult.isLeft()) {
    console.error('Failed to initialize plugin engine:', initResult.left);
    return;
  }
  console.log('✓ Plugin engine initialized successfully');
  
  // Step 7: Start the plugins
  console.log('5. Starting plugins...');
  const startResult = await pluginEngine.start();
  if (startResult.isLeft()) {
    console.error('Failed to start plugins:', startResult.left);
    return;
  }
  console.log('✓ Plugins started successfully');
  
  // Step 8: Demonstrate plugin information access
  console.log('6. Checking plugin status...');
  const loadedPlugins = pluginEngine.getAllLoadedPlugins();
  console.log(`Loaded plugins: ${ loadedPlugins.size }`);
  
  for (const [pluginId, pluginInfo] of loadedPlugins) {
    console.log(`- ${ pluginId }: ${ pluginInfo.plugin?.metadata?.name } (v${ pluginInfo.plugin?.metadata?.version })`);
    
    // Check plugin health if available
    if (pluginInfo.plugin && 'getHealth' in pluginInfo.plugin) {
      const health = await (pluginInfo.plugin as ExamplePlugin).getHealth();
      console.log(`  Health: ${ health.status } - ${ health?.details }`);
    }
  }
  
  // Step 9: Demonstrate metrics collection
  console.log('7. Collecting metrics...');
  contextBridge.collectMetrics('memory', 45.2, 'megabytes', 'example-plugin');
  contextBridge.collectPerformanceMetrics('example-plugin', 'example-operation', 150);
  
  // Step 10: Show integration bridge status
  console.log('8. Integration status...');
  console.log('Context Bridge Status:', contextBridge.getStatus());
  console.log('Service Hooks Stats:', serviceHooks.getHookStats());
  
  // Step 11: Clean shutdown
  console.log('9. Shutting down...');
  
  const stopResult = await pluginEngine.stop();
  if (stopResult.isLeft()) {
    console.error('Failed to stop plugins:', stopResult.left);
    return;
  }
  console.log('✓ Plugins stopped successfully');
  
  await pluginEngine.cleanup();
  console.log('✓ Plugin engine cleaned up successfully');
  
  // Disable bridges
  contextBridge.disable();
  serviceHooks.disable();
  
  console.log('\n=== Example completed successfully ===\n');
}

/**
 * Advanced Usage Example with Custom Loader
 */
export async function advancedXPluginExample(): Promise<void> {
  console.log('\n=== XPlugin Advanced Usage Example ===\n');
  
  const logger = console as any;
  const serviceRegistry = ServiceRegistry.create(logger);
  
  // Create a custom plugin loader that provides the example plugin
  class ExamplePluginLoader {
    readonly name = 'example-loader';
    
    canLoad(
      pluginId: string,
      config: PluginConfig
    ): boolean {
      return pluginId === 'example-plugin';
    }
    
    async loadPlugin(
      pluginId: string,
      config: PluginConfig
    ) {
      if (pluginId === 'example-plugin') {
        return { isRight: () => true, value: new ExamplePlugin() } as any;
      }
      return { isRight: () => false, value: new Error('Plugin not found') } as any;
    }
  }
  
  // Build engine with custom loader
  const pluginEngine = createPluginEngineBuilder()
    .withLogger(logger)
    .withServiceRegistry(serviceRegistry)
    .withPluginRegistry(new FocusedPluginRegistry())
    .withLoaders([new ExamplePluginLoader() as any])
    .build();
  
  console.log('Plugin engine built with custom loader');
  
  // Set up advanced integration with error handling
  const contextBridge = createContextBridge({
    logger,
    eventEmitter: (event) => {
      if (event.error) {
        console.error(`[ContextBridge] Error Event: ${ event.eventType }`, event.error);
      } else {
        console.log(`[ContextBridge] Event: ${ event.eventType } for ${ event.pluginId }`);
      }
    },
    metricsCollector: (metrics) => {
      // Advanced metrics processing
      if (metrics.metricType === 'performance' && metrics.value > 200) {
        console.warn(`[ContextBridge] Slow operation detected: ${ metrics.value }${ metrics.unit }`);
      }
    }
  });
  
  contextBridge.enable();
  
  // Set up lifecycle hook with error handling
  pluginEngine.setLifecycleHook(async (
    phase,
    pluginId,
    plugin,
    error
  ) => {
    if (error) {
      contextBridge.emitLifecycleEvent(phase as LifecyclePhase, pluginId, plugin, error as any);
    } else {
      contextBridge.emitLifecycleEvent(phase as LifecyclePhase, pluginId, plugin);
    }
  });
  
  // Initialize and run
  const pluginConfigs: PluginConfig[] = [
    {
      id: 'example-plugin',
      enabled: true,
      type: 'user' as any,
      priority: 100,
      dependencies: [],
      config: { advanced: true }
    }
  ];
  
  console.log('Initializing with advanced configuration...');
  const initResult = await pluginEngine.initialize(pluginConfigs);
  
  if (initResult.isRight()) {
    console.log('✓ Advanced initialization successful');
    
    const startResult = await pluginEngine.start();
    if (startResult.isRight()) {
      console.log('✓ Advanced startup successful');
      
      // Clean shutdown
      await pluginEngine.stop();
      await pluginEngine.cleanup();
    }
  }
  
  contextBridge.disable();
  console.log('\n=== Advanced example completed ===\n');
}

/**
 * Run the examples
 */
export async function runXPluginExamples(): Promise<void> {
  try {
    await basicXPluginExample();
    await advancedXPluginExample();
  } catch (error) {
    console.error('Example execution failed:', error);
  }
}

// Export for module usage
export { ExamplePlugin };

// Self-executing example if run directly
if (require.main === module) {
  runXPluginExamples().catch(console.error);
}
