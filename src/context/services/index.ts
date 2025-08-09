/**
 * @fileoverview Services Index - Exports all PluginManager context services
 */

// Core services for PluginManager context refactoring
export { PluginConfigurationService } from './PluginConfigurationService';
export { PluginDependencyService } from './PluginDependencyService';
export { ServiceRegistryService } from './ServiceRegistryService';
export { MetricsService } from './MetricsService';
export { QueueService } from './QueueService';
export { TopicService } from './TopicService';
export { PortService } from './PortService';

// Export types from services
export type {
  PluginConfiguration,
  ConfigurationValidationResult,
  ConfigurationMergeOptions,
  PluginConfigurationOperations
} from './PluginConfigurationService';

export type {
  PluginDependency,
  DependencyResolutionResult,
  DependencyConflict,
  PluginLoadOrder,
  DependencyGraph,
  PluginDependencyNode
} from './PluginDependencyService';

export type {
  ServiceRegistryStats
} from './ServiceRegistryService';
