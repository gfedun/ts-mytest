import {
  QueueConfig,
  TopicConfig
} from "@/eventhub";
import { EventHub } from '@/eventhub/EventHub';
import { Logger } from "@/logger";
import {
  IPluginEngine,
  Plugin,
  PluginSourceLoader,
} from '@/plugin';

/**
 * ApplicationContext phases representing the complete lifecycle
 * Matches existing phases but enhanced for PluginManager integration
 */
export enum ApplicationContextPhase {
  /** Initial state before any initialization */
  Uninitialized = 'uninitialized',
  
  /** Loading application configuration files */
  ConfigurationLoading = 'configuration_loading',
  
  /** Processing plugin configurations from loaded files */
  PluginConfigurationProcessing = 'plugin_configuration_processing',
  
  /** Setting up PluginManager with combined configuration sources */
  PluginManagerSetup = 'plugin_manager_setup',
  
  /** PluginManager loading and registering plugins */
  PluginLoading = 'plugin_loading',
  
  /** PluginManager initializing loaded plugins */
  PluginInitialization = 'plugin_initialization',
  
  /** PluginManager starting initialized plugins */
  PluginStarting = 'plugin_starting',
  
  /** All plugins loaded and application context is ready */
  Ready = 'ready',
  
  /** Application context is running */
  Running = 'running',
  
  /** Beginning graceful shutdown */
  ShuttingDown = 'shutting_down',
  
  /** PluginManager stopping plugins */
  PluginStopping = 'plugin_stopping',
  
  /** Cleanup and resource disposal */
  Cleanup = 'cleanup',
  
  /** System is fully stopped */
  Stopped = 'stopped',
  
  /** Error occurred during lifecycle */
  Failed = 'failed'
}

/**
 * ApplicationContext events for monitoring and integration
 * Enhanced to bridge PluginManager events with ApplicationContext events
 */
export interface ApplicationContextEvents {
  /** Phase transition event */
  'phase:changed': {
    fromPhase: ApplicationContextPhase;
    toPhase: ApplicationContextPhase;
    timestamp: Date;
    contextName: string;
    error?: string | undefined;
    metadata?: Record<string, unknown> | undefined;
  };
  
  /** Configuration loaded successfully */
  'configuration:loaded': {
    contextName: string;
    configPaths: string[];
    timestamp: Date;
    pluginCount: number;
  };
  
  /** Configuration loading failed */
  'configuration:failed': {
    contextName: string;
    error: string;
    timestamp: Date;
  };
  
  /** PluginManager setup completed */
  'pluginManager:setup': {
    contextName: string;
    externalSources: number;
    appConfigPlugins: number;
    timestamp: Date;
  };
  
  /** Plugin registered (bridged from PluginManager) */
  'plugin:registered': {
    plugin: Plugin;
    contextName: string;
    timestamp: Date;
  };
  
  /** Plugin initialized (bridged from PluginManager) */
  'plugin:initialized': {
    plugin: Plugin;
    contextName: string;
    timestamp: Date;
    duration?: number | undefined;
  };
  
  /** Plugin started (bridged from PluginManager) */
  'plugin:started': {
    plugin: Plugin;
    contextName: string;
    timestamp: Date;
    duration?: number;
  };
  
  /** Plugin stopped (bridged from PluginManager) */
  'plugin:stopped': {
    pluginId: string;
    contextName: string;
    timestamp: Date;
    duration?: number;
  };
  
  /** Plugin failed (bridged from PluginManager) */
  'plugin:failed': {
    plugin: Plugin;
    error: string;
    contextName: string;
    timestamp: Date;
  };
  
  /** Context started and ready for operation */
  'context:started': {
    contextName: string;
    phase: ApplicationContextPhase;
    timestamp: Date;
  };
  
  /** Context stopped */
  'context:stopped': {
    contextName: string;
    timestamp: Date;
    uptime: number;
  };
  
  /** Context ready (all plugins started successfully) */
  'context:ready': {
    contextName: string;
    phase: ApplicationContextPhase;
    timestamp: Date;
  };
  
  /** Health check result */
  'health:checked': {
    contextName: string;
    healthy: boolean;
    timestamp: Date;
  };
  
  // ====================================================================================
  // QUEUE EVENTS - Point-to-Point Messaging Events
  // ====================================================================================
  
  /** Queue created successfully */
  'queue:created': {
    queueName: string;
    contextName: string;
    timestamp: Date;
    config: any; // QueueConfig
  };
  
  /** Queue deleted successfully */
  'queue:deleted': {
    queueName: string;
    contextName: string;
    timestamp: Date;
  };
  
  /** Message sent to queue */
  'message:sent': {
    queueName: string;
    messageId?: string | undefined;
    contextName: string;
    timestamp: Date;
    messageType?: string | undefined;
  };
  
  /** Message received from queue */
  'message:received': {
    queueName: string;
    messageId?: string | undefined;
    contextName: string;
    timestamp: Date;
    messageType?: string | undefined;
  };
  
  // ====================================================================================
  // TOPIC EVENTS - Publish-Subscribe Messaging Events
  // ====================================================================================
  
  /** Topic created successfully */
  'topic:created': {
    topicName: string;
    contextName: string;
    timestamp: Date;
    config: any; // TopicConfig
  };
  
  /** Topic deleted successfully */
  'topic:deleted': {
    topicName: string;
    contextName: string;
    timestamp: Date;
  };
  
  /** Message published to topic */
  'message:published': {
    topicName: string;
    messageId?: string | undefined;
    contextName: string;
    timestamp: Date;
    messageType?: string | undefined;
    subscriberCount?: number | undefined;
  };
  
  /** Subscription to topic created */
  'subscription:created': {
    topicName: string;
    subscriptionId: string;
    contextName: string;
    timestamp: Date;
  };
  
  /** Subscription to topic removed */
  'subscription:cancelled': {
    topicName: string;
    subscriptionId: string;
    contextName: string;
    timestamp: Date;
  };
  
  /** Subscription to topic created */
  'topic:subscribed': {
    topicName: string;
    subscriptionId: string;
    contextName: string;
    timestamp: Date;
  };
  
  /** Subscription to topic removed */
  'topic:unsubscribed': {
    topicName: string;
    subscriptionId: string;
    contextName: string;
    timestamp: Date;
  };
  
  // ====================================================================================
  // PORT EVENTS - External Broker Integration Events
  // ====================================================================================
  
  /** EventBrokerPort registered successfully */
  'port:registered': {
    portName: string;
    portType: string;
    contextName: string;
    timestamp: Date;
  };
  
  /** EventBrokerPort unregistered successfully */
  'port:unregistered': {
    portName: string;
    contextName: string;
    timestamp: Date;
  };
  
  /** External broker connected */
  'broker:connected': {
    brokerId: string;
    brokerType?: string | undefined;
    contextName: string;
    timestamp: Date;
    connectionConfig?: any | undefined;
  };
  
  /** External broker disconnected */
  'broker:disconnected': {
    brokerId: string;
    contextName: string;
    timestamp: Date;
    reason?: string | undefined;
  };
  
  /** External broker connection failed */
  'broker:connection_failed': {
    brokerId: string;
    error: string;
    contextName: string;
    timestamp: Date;
  };
}

/**
 * Configuration interface for ApplicationContext
 */
export interface ApplicationContextConfig {
  name: string;
  logger: Logger;
  eventHub: EventHub;
  pluginManager: IPluginEngine;
  metadata?: Record<string, unknown>;
  eventHubConfig?: {
    defaultQueueConfig?: QueueConfig;
    defaultTopicConfig?: TopicConfig;
    enableMetrics?: boolean;
    maxQueues?: number;
    maxTopics?: number;
    maxPorts?: number;
  };
}

// ====================================================================================
// METRICS INTERFACES - EventHub Metrics Support
// ====================================================================================

/**
 * Metrics for individual queues
 */
export interface QueueMetrics {
  /** Name of the queue */
  readonly name: string;
  /** Current number of messages in the queue */
  readonly messageCount: number;
  /** Total messages sent to this queue */
  readonly totalMessagesSent: number;
  /** Total messages received from this queue */
  readonly totalMessagesReceived: number;
  /** Number of active consumers */
  readonly consumerCount: number;
  /** Queue creation timestamp */
  readonly createdAt: Date;
  /** Last activity timestamp */
  readonly lastActivity: Date;
  /** Queue configuration */
  readonly config: QueueConfig;
  /** Queue status */
  readonly status: 'active' | 'inactive' | 'error';
  /** Average message processing time in milliseconds */
  readonly avgProcessingTime?: number | undefined;
  /** Error count */
  readonly errorCount: number;
}

/**
 * Metrics for individual topics
 */
export interface TopicMetrics {
  /** Name of the topic */
  readonly name: string;
  /** Number of active subscriptions */
  readonly subscriberCount: number;
  /** Total messages published to this topic */
  readonly totalMessagesPublished: number;
  /** Total messages delivered to all subscribers */
  readonly totalMessagesDelivered: number;
  /** Topic creation timestamp */
  readonly createdAt: Date;
  /** Last activity timestamp */
  readonly lastActivity: Date;
  /** Topic configuration */
  readonly config: TopicConfig;
  /** Topic status */
  readonly status: 'active' | 'inactive' | 'error';
  /** Average message delivery time in milliseconds */
  readonly avgDeliveryTime?: number | undefined;
  /** Error count */
  readonly errorCount: number;
  /** Failed delivery count */
  readonly failedDeliveries: number;
}

/**
 * Metrics for EventBroker ports
 */
export interface PortMetrics {
  /** Name of the port */
  readonly name: string;
  /** Type of the port */
  readonly type: string;
  /** Connection status */
  readonly connectionStatus: 'connected' | 'disconnected' | 'connecting' | 'error';
  /** Port registration timestamp */
  readonly registeredAt: Date;
  /** Last connection attempt timestamp */
  readonly lastConnectionAttempt?: Date | undefined;
  /** Total messages sent through this port */
  readonly totalMessagesSent: number;
  /** Total messages received through this port */
  readonly totalMessagesReceived: number;
  /** Connection uptime in milliseconds */
  readonly uptime?: number | undefined;
  /** Error count */
  readonly errorCount: number;
  /** Retry count */
  readonly retryCount: number;
  /** Average latency in milliseconds */
  readonly avgLatency?: number | undefined;
}

/**
 * Overall EventHub metrics
 */
export interface EventHubMetrics {
  /** Context name */
  readonly contextName: string;
  /** EventHub status */
  readonly status: 'running' | 'stopped' | 'error' | 'initializing';
  /** Metrics collection timestamp */
  readonly timestamp: Date;
  /** EventHub uptime in milliseconds */
  readonly uptime: number;
  /** Current phase */
  readonly phase: ApplicationContextPhase;
  
  /** Queue-related metrics */
  readonly queueMetrics: {
    /** Total number of queues */
    readonly totalQueues: number;
    /** Active queue count */
    readonly activeQueues: number;
    /** Individual queue metrics */
    readonly queues: QueueMetrics[];
    /** Total messages across all queues */
    readonly totalMessages: number;
    /** Total queue errors */
    readonly totalErrors: number;
  };
  
  /** Topic-related metrics */
  readonly topicMetrics: {
    /** Total number of topics */
    readonly totalTopics: number;
    /** Active topic count */
    readonly activeTopics: number;
    /** Individual topic metrics */
    readonly topics: TopicMetrics[];
    /** Total subscriptions across all topics */
    readonly totalSubscriptions: number;
    /** Total published messages across all topics */
    readonly totalPublished: number;
    /** Total topic errors */
    readonly totalErrors: number;
  };
  
  /** Port-related metrics */
  readonly portMetrics: {
    /** Total number of registered ports */
    readonly totalPorts: number;
    /** Connected port count */
    readonly connectedPorts: number;
    /** Individual port metrics */
    readonly ports: PortMetrics[];
    /** Total external broker connections */
    readonly externalBrokerConnections: number;
    /** Total port errors */
    readonly totalErrors: number;
  };
  
  /** Performance metrics */
  readonly performance: {
    /** Total memory usage estimate in bytes */
    readonly memoryUsage?: number;
    /** Average message processing time across all components */
    readonly avgProcessingTime?: number;
    /** Peak concurrent connections */
    readonly peakConcurrentConnections: number;
    /** Total events processed */
    readonly totalEventsProcessed: number;
  };
  
  /** Error summary */
  readonly errors: {
    /** Total error count across all components */
    readonly totalErrors: number;
    /** Recent errors (last 100) */
    readonly recentErrors: Array<{
      readonly component: 'queue' | 'topic' | 'port' | 'eventhub';
      readonly name: string;
      readonly error: string;
      readonly timestamp: Date;
    }>;
  };
}
