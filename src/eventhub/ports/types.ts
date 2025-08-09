/**
 * Configuration for event broker connections
 */
export interface EventBrokerConfig {
  /** Connection string or configuration object */
  readonly connection: string | Record<string, any>;
  /** Topics or channels to subscribe to */
  readonly subscriptions?: string[];
  /** Topic mapping for publishing */
  readonly topicMapping?: Record<string, string>;
  /** Serialization format */
  readonly serialization?: 'json' | 'avro' | 'protobuf' | 'custom';
  /** Enable compression */
  readonly compression?: boolean;
  /** Connection timeout in milliseconds */
  readonly connectionTimeout?: number;
  /** Retry configuration */
  readonly retry?: {
    readonly maxAttempts: number;
    readonly delay: number;
  };
  /** Additional broker-specific options */
  readonly options?: Record<string, any>;
}

/**
 * Metrics for event broker operations
 */
export interface EventBrokerMetrics {
  readonly brokerName: string;
  readonly type: string;
  readonly connected: boolean;
  readonly totalPublished: number;
  readonly totalReceived: number;
  readonly totalFailed: number;
  readonly averageLatency: number;
  readonly lastActivity: Date;
  readonly uptime: number;
}
