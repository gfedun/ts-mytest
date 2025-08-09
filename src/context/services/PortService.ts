/**
 * @fileoverview Port Service - Dedicated Port Management
 * Enhanced with ServiceHooks integration for port monitoring.
 */

import { Either } from '@/either';
import { EventHub } from '@/eventhub';
import { EventBrokerPort } from '@/eventhub/ports/EventBrokerPort';
import { EventPublisherPort } from '@/eventhub/ports/EventPublisherPort';
import { EventSubscriberPort } from '@/eventhub/ports/EventSubscriberPort';
import { EventBrokerConfig } from '@/eventhub/ports/types';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Logger } from '@/logger';
import { Maybe } from '@/maybe';
import { ApplicationContextError } from '../ApplicationContextError';

// Import plugin integration types
import { IPluginEngine } from '@/plugin/core/IPluginEngine';

const LOGGER_NAMESPACE = "[PortService]" as const;

export class PortService {
  private readonly eventHub: EventHub;
  private readonly logger: Logger;
  private readonly brokerPorts = new Map<string, EventBrokerPort>();
  private readonly externalBrokers = new Map<string, { config: EventBrokerConfig; connected: boolean }>();

  // ServiceHooks integration
  private pluginEngine: IPluginEngine | null = null;

  constructor(eventHub: EventHub, logger: Logger) {
    this.eventHub = eventHub;
    this.logger = logger;
  }

  /**
   * Set the plugin engine for ServiceHooks integration
   */
  setPluginEngine(engine: IPluginEngine): void {
    this.pluginEngine = engine;
    
    this.logger.debug(`${LOGGER_NAMESPACE} Plugin engine set for ServiceHooks integration`);
  }

  registerEventBrokerPort(name: string, port: EventBrokerPort): Either<ApplicationContextError, void> {
    if (this.brokerPorts.has(name)) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_SERVICE_REGISTRATION_FAILED,
          `EventBrokerPort '${name}' is already registered`,
          'registerEventBrokerPort',
          { portName: name }
        )
      );
    }

    this.brokerPorts.set(name, port);
    this.logger.info(`${LOGGER_NAMESPACE} EventBrokerPort registered: ${name}`);
    
    return Either.right(undefined as void);
  }

  unregisterEventBrokerPort(name: string): Either<ApplicationContextError, void> {
    if (!this.brokerPorts.has(name)) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_SERVICE_REGISTRATION_FAILED,
          `EventBrokerPort with name '${name}' is not registered`,
          'unregisterEventBrokerPort'
        )
      );
    }

    this.brokerPorts.delete(name);
    this.logger.info(`EventBrokerPort unregistered: ${name}`);
    
    return Either.right(undefined as void);
  }

  getEventBrokerPort(name: string): Maybe<EventBrokerPort> {
    const port = this.brokerPorts.get(name);
    return port ? Maybe.just(port) : Maybe.nothing();
  }

  getEventPublisherPort(): EventPublisherPort {
    return this.eventHub.getEventPublisherPort();
  }

  getEventSubscriberPort(): EventSubscriberPort {
    return this.eventHub.getEventSubscriberPort();
  }

  async connectToExternalBroker(name: string, config: EventBrokerConfig): Promise<Either<ApplicationContextError, void>> {
    if (!this.eventHub.isRunning()) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_PORT_CONNECTION_FAILED,
          `Cannot connect to external broker '${name}' - EventHub is not running`,
          'connectToExternalBroker'
        )
      );
    }

    try {
      const result = await this.eventHub.connectToExternalBroker(name, config);
      if (Either.isLeft(result)) {
        return Either.left(
          ApplicationContextError.create(
            UnifiedErrorCode.CONTEXT_PORT_CONNECTION_FAILED,
            `Failed to connect to external broker '${name}': ${result.left.message}`,
            'connectToExternalBroker',
            { brokerName: name },
            undefined,
            result.left
          )
        );
      }

      this.externalBrokers.set(name, { config, connected: true });
      this.logger.info(`${LOGGER_NAMESPACE} Connected to external broker: ${name}`);
      
      return Either.right(undefined as void);
    } catch (error) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_PORT_CONNECTION_FAILED,
          `External broker connection failed: ${error instanceof Error ? error.message : String(error)}`,
          'connectToExternalBroker',
          { brokerName: name }
        )
      );
    }
  }

  async disconnectFromExternalBroker(name: string): Promise<Either<ApplicationContextError, void>> {
    const brokerInfo = this.externalBrokers.get(name);
    if (!brokerInfo) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_PORT_DISCONNECTION_FAILED,
          `External broker '${name}' is not registered`,
          'disconnectFromExternalBroker',
          { brokerName: name }
        )
      );
    }

    try {
      const result = await this.eventHub.disconnectFromExternalBroker(name);
      if (Either.isLeft(result)) {
        return Either.left(
          ApplicationContextError.create(
            UnifiedErrorCode.CONTEXT_PORT_DISCONNECTION_FAILED,
            `Failed to disconnect from external broker '${name}': ${result.left.message}`,
            'disconnectFromExternalBroker',
            { brokerName: name },
            undefined,
            result.left
          )
        );
      }

      brokerInfo.connected = false;
      this.logger.info(`${LOGGER_NAMESPACE} Disconnected from external broker: ${name}`);
      
      return Either.right(undefined as void);
    } catch (error) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_PORT_DISCONNECTION_FAILED,
          `External broker disconnection failed: ${error instanceof Error ? error.message : String(error)}`,
          'disconnectFromExternalBroker',
          { brokerName: name }
        )
      );
    }
  }

  async cleanup(): Promise<Either<ApplicationContextError, void>> {
    const errors: string[] = [];
    
    // Disconnect from all external brokers
    for (const [name, brokerInfo] of this.externalBrokers) {
      if (brokerInfo.connected) {
        const result = await this.disconnectFromExternalBroker(name);
        if (Either.isLeft(result)) {
          errors.push(`Failed to disconnect from broker '${name}': ${result.left.message}`);
        }
      }
    }

    // Clear registered ports
    this.brokerPorts.clear();
    this.externalBrokers.clear();

    if (errors.length > 0) {
      return Either.left(
        ApplicationContextError.create(
          UnifiedErrorCode.CONTEXT_INITIALIZATION_FAILED,
          `Port cleanup failed: ${errors.join(', ')}`,
          'cleanup'
        )
      );
    }

    this.logger.info(`${LOGGER_NAMESPACE} Cleanup completed`);
    return Either.right(undefined as void);
  }

  dispose(): void {
    this.brokerPorts.clear();
    this.externalBrokers.clear();
    this.logger.debug(`${LOGGER_NAMESPACE} Service disposed`);
  }
}
