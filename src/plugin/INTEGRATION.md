# XPlugin Integration with PluginManagerContext

## Overview

This document describes how the refactored **plugin** package integrates with the **PluginManagerContext** in the context package, following the Phase 4 architectural improvements that established clear integration points and service extension patterns.

## Architecture Pattern

The integration follows a **layered orchestration pattern** where:

- **XPlugin Package (Core Layer)**: Handles essential plugin operations
- **Context Package (Orchestration Layer)**: Coordinates specialized services and provides higher-level abstractions
- **Integration Layer**: Clean interfaces that connect the two layers without tight coupling

## Integration Points

### 1. PluginEngineBuilder → PluginManagerContext

The `PluginEngineBuilder` creates the core plugin engine that gets wrapped by `PluginManagerContext`:

```typescript
// In PluginManagerContext constructor
export class PluginManagerContext {
  constructor(
    pluginManager: PluginManager,  // This will be replaced with IPluginEngine
    eventHub: EventHub,
    logger: Logger,
    contextName: string = 'PluginManagerContext'
  ) {
    // Current implementation uses old PluginManager
    // Future integration will use:
    const pluginEngine = createPluginEngineBuilder()
      .withLogger(logger)
      .withServiceRegistry(serviceRegistry)
      .withPluginRegistry(new FocusedPluginRegistry())
      .build();
  }
}
```

### 2. ContextBridge Integration

The `ContextBridge` provides event emission and metrics collection that the `PluginManagerContext` can consume:

```typescript
// PluginManagerContext integration with ContextBridge
export class PluginManagerContext {
  private contextBridge: ContextBridge;

  constructor(...) {
    // ...existing code...
    
    // Set up context bridge for core engine integration
    this.contextBridge = createContextBridge({
      logger: this.logger,
      eventEmitter: (event) => this.handlePluginEvent(event),
      metricsCollector: (metrics) => this.metricsService.collectMetrics(metrics),
      configurationInjector: (pluginId) => this.getPluginConfiguration(pluginId)
    });
  }

  private handlePluginEvent(event: PluginEngineEvent): void {
    // Broadcast to EventHub
    this.broadcastContextEvent(`plugin.${event.eventType}`, {
      pluginId: event.pluginId,
      phase: event.phase,
      data: event.data,
      error: event.error
    });
  }
}
```

### 3. ServiceHooks Integration

The `ServiceHooks` system allows context services to extend core plugin operations:

```typescript
// PluginManagerContext service integration
export class PluginManagerContext {
  private serviceHooks: ServiceHooks;

  constructor(...) {
    // ...existing code...
    
    this.serviceHooks = createServiceHooks(this.logger);
    
    // Register context service hooks
    this.registerContextServiceHooks();
  }

  private registerContextServiceHooks(): void {
    // Configuration service hook
    this.serviceHooks.registerConfigurationHook(
      'plugin-configuration-service',
      async (data) => {
        await this.configurationService.handleConfigurationEvent(data);
      },
      HookPriority.HIGH
    );

    // Dependency service hook
    this.serviceHooks.registerDependencyHook(
      'plugin-dependency-service',
      async (data) => {
        await this.dependencyService.handleDependencyEvent(data);
      },
      HookPriority.HIGH
    );

    // Metrics service hook
    this.serviceHooks.registerMetricsHook(
      'plugin-metrics-service',
      async (data) => {
        await this.metricsService.handleMetricsEvent(data);
      },
      HookPriority.NORMAL
    );
  }
}
```

## Migration Strategy

### Phase 1: Core Engine Replacement

Replace the existing `PluginManager` usage in `PluginManagerContext` with the new `IPluginEngine`:

```typescript
export class PluginManagerContext {
  private readonly pluginEngine: IPluginEngine;  // Replace pluginManager
  private readonly contextBridge: ContextBridge;
  private readonly serviceHooks: ServiceHooks;

  constructor(
    pluginEngineConfig: PluginEngineBuilderConfig,  // New parameter
    eventHub: EventHub,
    logger: Logger,
    contextName: string = 'PluginManagerContext'
  ) {
    // Build core engine
    this.pluginEngine = createPluginEngineBuilder()
      .fromConfig(pluginEngineConfig)
      .withDefaults()
      .build();

    // Set up integration bridges
    this.setupIntegrationBridges();
  }
}
```

### Phase 2: Service Integration

Update the orchestrated services to work with the new integration points:

```typescript
// Enhanced service integration
private setupIntegrationBridges(): void {
  // Context bridge for core engine events
  this.contextBridge = createContextBridge({
    logger: this.logger,
    eventEmitter: (event) => this.handlePluginEngineEvent(event),
    metricsCollector: (metrics) => this.handlePluginMetrics(metrics),
    configurationInjector: (pluginId) => this.injectPluginConfiguration(pluginId)
  });

  // Service hooks for extension points
  this.serviceHooks = createServiceHooks(this.logger);
  this.registerAllServiceHooks();

  // Connect core engine with bridges
  this.pluginEngine.setLifecycleHook((phase, pluginId, plugin, error) => {
    // Emit through context bridge
    this.contextBridge.emitLifecycleEvent(phase, pluginId, plugin, error);
    
    // Execute service hooks
    this.serviceHooks.executeLifecycleHooks({
      pluginId,
      plugin,
      phase,
      timestamp: new Date()
    });
  });

  // Enable bridges
  this.contextBridge.enable();
  this.serviceHooks.enable();
}
```

### Phase 3: Method Delegation

Update `PluginManagerContext` methods to delegate to the core engine:

```typescript
export class PluginManagerContext {
  // Lifecycle operations delegate to core engine
  public async initialize(): Promise<Either<ApplicationContextError, void>> {
    try {
      this.phase = ApplicationContextPhase.PluginManagerSetup;
      
      // Use core engine instead of old PluginManager
      const result = await this.pluginEngine.initialize(this.getPluginConfigs());
      if (result.isLeft()) {
        this.phase = ApplicationContextPhase.Failed;
        return Either.left(this.convertToContextError(result.value));
      }

      this.phase = ApplicationContextPhase.PluginInitialization;
      this.broadcastContextEvent('context.initialized', { phase: this.phase });
      
      return Either.right(undefined);
    } catch (error) {
      // ...existing error handling...
    }
  }

  public async start(): Promise<Either<ApplicationContextError, void>> {
    try {
      this.phase = ApplicationContextPhase.PluginStarting;
      
      const result = await this.pluginEngine.start();
      if (result.isLeft()) {
        this.phase = ApplicationContextPhase.Failed;
        return Either.left(this.convertToContextError(result.value));
      }

      this.phase = ApplicationContextPhase.Running;
      this.broadcastContextEvent('context.started', { phase: this.phase });
      
      return Either.right(undefined);
    } catch (error) {
      // ...existing error handling...
    }
  }

  // Plugin information delegates to core engine
  public getLoadedPlugins(): ReadonlyMap<string, PluginLoadInfo> {
    return this.pluginEngine.getAllLoadedPlugins();
  }

  public getPlugin(pluginId: string): Maybe<PluginLoadInfo> {
    return this.pluginEngine.getLoadedPlugin(pluginId);
  }
}
```

## Service Enhancement

### Enhanced Configuration Service

```typescript
export class PluginConfigurationService {
  constructor(
    private pluginEngine: IPluginEngine,  // Use core engine
    private logger: Logger,
    private contextName: string
  ) {}

  async handleConfigurationEvent(data: ConfigurationHookData): Promise<void> {
    // Process configuration events from core engine
    this.logger.debug('Processing configuration event', {
      pluginId: data.pluginId,
      success: data.success,
      keys: data.configurationKeys
    });

    if (!data.success && data.error) {
      // Handle configuration errors
      await this.handleConfigurationError(data.pluginId, data.error);
    }
  }

  async injectConfiguration(pluginId: string): Promise<Record<string, any>> {
    // Enhanced configuration injection with validation
    const config = await this.loadPluginConfig(pluginId);
    const validatedConfig = await this.validateConfiguration(pluginId, config);
    return validatedConfig;
  }
}
```

### Enhanced Dependency Service

```typescript
export class PluginDependencyService {
  async handleDependencyEvent(data: DependencyHookData): Promise<void> {
    // Process dependency resolution events
    if (!data.resolved) {
      this.logger.warn('Dependency resolution failed', {
        pluginId: data.pluginId,
        unresolvedDependencies: data.unresolvedDependencies,
        circularDependencies: data.circularDependencies
      });

      // Implement dependency resolution strategies
      await this.attemptDependencyResolution(data);
    }
  }
}
```

### Enhanced Metrics Service

```typescript
export class MetricsService {
  async handleMetricsEvent(data: MetricsHookData): Promise<void> {
    // Collect and process metrics from core engine
    await this.recordMetric({
      name: data.metricName,
      value: data.value,
      unit: data.unit,
      pluginId: data.pluginId,
      tags: data.tags,
      timestamp: data.timestamp
    });

    // Trigger alerts if needed
    if (this.shouldTriggerAlert(data)) {
      await this.triggerAlert(data);
    }
  }
}
```

## Benefits of Integration

### 1. Clean Separation of Concerns
- **Core Engine**: Focuses only on essential plugin operations
- **Context Layer**: Provides orchestration and specialized services
- **Integration Layer**: Maintains loose coupling through well-defined interfaces

### 2. Extensibility
- New services can easily integrate via `ServiceHooks`
- Core engine can be enhanced without affecting context services
- Context services can be added/removed without core engine changes

### 3. Testability
- Core engine can be tested in isolation
- Context services can be tested with mock integration bridges
- Integration can be tested separately from business logic

### 4. Maintainability
- Clear boundaries between layers
- Focused responsibilities for each component
- Easier to debug and trace issues

### 5. Performance
- Core engine handles essential operations efficiently
- Context services run asynchronously where possible
- Event-driven architecture reduces blocking operations

## Error Handling Strategy

### Error Conversion and Propagation

```typescript
export class PluginManagerContext {
  private convertToContextError(coreError: CorePluginError): ApplicationContextError {
    return ApplicationContextError.create(
      UnifiedErrorCode.PLUGIN_LIFECYCLE_ERROR,
      `Core engine error: ${coreError.message}`,
      'plugin-engine-operation',
      {
        contextName: this.contextName,
        pluginId: coreError.context.pluginId,
        engineState: coreError.context.engineState
      },
      undefined,
      coreError
    );
  }

  private async handlePluginEngineError(error: CorePluginError): Promise<void> {
    // Log error with context
    this.logger.error('Plugin engine error occurred', {
      contextName: this.contextName,
      error: error.message,
      pluginId: error.context.pluginId,
      phase: error.context.lifecyclePhase
    });

    // Broadcast error event
    this.broadcastContextEvent('plugin.error', {
      error: error.message,
      pluginId: error.context.pluginId,
      recoverable: error.recovery.canRetry
    });

    // Attempt recovery if possible
    if (error.recovery.canRetry) {
      await this.attemptErrorRecovery(error);
    }
  }
}
```

## Configuration Integration

### Plugin Configuration Flow

```typescript
// Configuration flow from context to core
export class PluginManagerContext {
  private async getPluginConfigs(): Promise<PluginConfig[]> {
    // Get configurations from context services
    const configs = await this.configurationService.getAllPluginConfigs();
    
    // Transform to core engine format
    return configs.map(config => ({
      id: config.id,
      enabled: config.enabled ?? true,
      type: config.type ?? PluginType.User,
      priority: config.priority ?? 0,
      dependencies: config.dependencies ?? [],
      config: config.pluginSpecificConfig ?? {}
    }));
  }

  private async injectPluginConfiguration(pluginId: string): Promise<Record<string, any>> {
    // Called by ContextBridge when core engine requests configuration
    const config = await this.configurationService.getPluginConfiguration(pluginId);
    return config.isRight() ? config.value : {};
  }
}
```

## Monitoring and Observability

### Integrated Monitoring

```typescript
export class PluginManagerContext {
  private setupMonitoring(): void {
    // Monitor core engine state
    setInterval(() => {
      const engineState = this.pluginEngine.getState();
      const loadedPlugins = this.pluginEngine.getAllLoadedPlugins();
      
      this.metricsService.recordGauge('plugin_engine_state', 1, {
        state: engineState,
        plugin_count: loadedPlugins.size.toString()
      });
    }, 30000); // Every 30 seconds

    // Monitor bridge health
    setInterval(() => {
      const bridgeStatus = this.contextBridge.getStatus();
      const hooksStats = this.serviceHooks.getHookStats();
      
      this.metricsService.recordGauge('integration_bridge_health', 1, {
        bridge_enabled: bridgeStatus.enabled.toString(),
        bridge_configured: bridgeStatus.configured.toString(),
        hooks_enabled: hooksStats.enabled.toString(),
        total_hooks: hooksStats.totalHooks.toString()
      });
    }, 60000); // Every minute
  }
}
```

## Future Enhancements

### 1. Dynamic Plugin Loading
- Context services can trigger dynamic plugin loading through core engine
- Hot-reloading capabilities with proper state management

### 2. Advanced Dependency Resolution
- Circular dependency detection and resolution strategies
- Plugin version compatibility checking

### 3. Enhanced Error Recovery
- Automatic plugin restart on failure
- Fallback plugin loading strategies

### 4. Performance Optimization
- Plugin loading prioritization based on usage patterns
- Resource usage monitoring and optimization

## Conclusion

The integration between the refactored xplugin package and PluginManagerContext follows clean architectural principles while maintaining the flexibility and power of the original system. The layered approach with well-defined integration points ensures that both packages can evolve independently while working together seamlessly.

The key to successful integration is the **separation of essential operations** (handled by the core engine) from **orchestration and specialized services** (handled by the context layer), connected through **clean, event-driven interfaces** that maintain loose coupling and high testability.
