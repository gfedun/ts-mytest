/**
 * @fileoverview Service Registry Service - Dedicated Service Management
 *
 * Handles all service registry operations by delegating to the PluginManager.
 * Provides service registration, resolution, and availability checking functionality.
 * Enhanced with ServiceHooks integration for service lifecycle monitoring.
 */

import { Either } from '@/either';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Logger } from '@/logger';
import { ServiceLifetime } from '@/service';
import {
  getServiceName,
  Service,
  ServiceDescriptor
} from '@/service';
import { ApplicationContextError } from '../ApplicationContextError';

import { IPluginEngine } from '@/plugin/core/IPluginEngine';

const LOGGER_NAMESPACE = "[ServiceRegistryService]" as const;

/**
 * Service registration statistics
 */
export interface ServiceRegistryStats {
  totalServices: number;
  singletonServices: number;
  transientServices: number;
  scopedServices: number;
  failedRegistrations: number;
  successfulRegistrations: number;
}

/**
 * ServiceRegistryService manages service registration and resolution operations.
 * Enhanced with ServiceHooks integration for service lifecycle monitoring.
 */
export class ServiceRegistryService {
  private readonly pluginManager: PluginManager;
  private readonly logger: Logger;
  private readonly contextName: string;

  // ServiceHooks integration
  private pluginEngine: IPluginEngine | null = null;
  
  // Service monitoring
  private serviceStats: ServiceRegistryStats;

  constructor(pluginManager: PluginManager, logger: Logger, contextName: string) {
    this.pluginManager = pluginManager;
    this.logger = logger;
    this.contextName = contextName;
    
    this.serviceStats = {
      totalServices: 0,
      singletonServices: 0,
      transientServices: 0,
      scopedServices: 0,
      failedRegistrations: 0,
      successfulRegistrations: 0
    };
  }

  // ====================================================================================
  // SERVICEHOOKS INTEGRATION
  // ====================================================================================

  /**
   * Set the plugin engine for ServiceHooks integration
   */
  setPluginEngine(engine: IPluginEngine): void {
    this.pluginEngine = engine;
    
    this.logger.debug(`${LOGGER_NAMESPACE} Plugin engine set for ServiceHooks integration`, {
      contextName: this.contextName
    });
  }

  // ====================================================================================
  // SERVICE REGISTRY OPERATIONS
  // ====================================================================================

  async registerService<T>(
    serviceDescriptor: ServiceDescriptor<T>,
    implementation?: new (...args: any[]) => T
  ): Promise<Either<ApplicationContextError, void>> {
    try {
      this.logger.debug(`${LOGGER_NAMESPACE} Registering service`, {
        contextName: this.contextName,
        serviceName: getServiceName(serviceDescriptor),
        lifetime: serviceDescriptor.lifetime
      });

      const registerResult = await this.pluginManager.registerService(serviceDescriptor, implementation);
      
      if (Either.isLeft(registerResult)) {
        this.serviceStats.failedRegistrations++;
        return Either.left(ApplicationContextError.create(
          UnifiedErrorCode.SERVICE_REGISTRATION_FAILED,
          `Failed to register service '${getServiceName(serviceDescriptor)}': ${registerResult.left.message}`,
          'registerService',
          { contextName: this.contextName, serviceName: getServiceName(serviceDescriptor) }
        ));
      }

      // Update statistics
      this.serviceStats.successfulRegistrations++;
      this.serviceStats.totalServices++;
      this.updateLifetimeStats(serviceDescriptor.lifetime, 1);

      this.logger.info(`${LOGGER_NAMESPACE} Service registered successfully`, {
        contextName: this.contextName,
        serviceName: getServiceName(serviceDescriptor),
        lifetime: serviceDescriptor.lifetime
      });

      return Either.right(undefined as void);

    } catch (error) {
      this.serviceStats.failedRegistrations++;
      return Either.left(ApplicationContextError.create(
        UnifiedErrorCode.SERVICE_REGISTRATION_FAILED,
        `Service registration failed: ${error instanceof Error ? error.message : String(error)}`,
        'registerService',
        { contextName: this.contextName }
      ));
    }
  }

  resolveService<T>(serviceDescriptor: ServiceDescriptor<T>): Either<ApplicationContextError, T> {
    try {
      const serviceName = getServiceName(serviceDescriptor);
      
      this.logger.debug(`${LOGGER_NAMESPACE} Resolving service`, {
        contextName: this.contextName,
        serviceName
      });

      const resolveResult = this.pluginManager.resolveService(serviceDescriptor);
      
      if (Either.isLeft(resolveResult)) {
        return Either.left(ApplicationContextError.create(
          UnifiedErrorCode.SERVICE_NOT_FOUND,
          `Failed to resolve service '${serviceName}': ${resolveResult.left.message}`,
          'resolveService',
          { contextName: this.contextName, serviceName }
        ));
      }

      return Either.right(resolveResult.right);

    } catch (error) {
      return Either.left(ApplicationContextError.create(
        UnifiedErrorCode.SERVICE_RESOLUTION_FAILED,
        `Service resolution failed: ${error instanceof Error ? error.message : String(error)}`,
        'resolveService',
        { contextName: this.contextName }
      ));
    }
  }

  hasService<T>(serviceDescriptor: ServiceDescriptor<T>): boolean {
    return this.pluginManager.hasService(serviceDescriptor);
  }

  getServiceStats(): ServiceRegistryStats {
    return { ...this.serviceStats };
  }

  /**
   * Update lifetime statistics
   */
  private updateLifetimeStats(lifetime: ServiceLifetime, delta: number): void {
    switch (lifetime) {
      case ServiceLifetime.Singleton:
        this.serviceStats.singletonServices += delta;
        break;
      case ServiceLifetime.Transient:
        this.serviceStats.transientServices += delta;
        break;
      case ServiceLifetime.Scoped:
        this.serviceStats.scopedServices += delta;
        break;
    }
  }

  /**
   * Clean up resources
   */
  dispose(): void {
    this.logger.debug(`${LOGGER_NAMESPACE} Service disposed`, {
      contextName: this.contextName
    });
  }
}
