import { Logger } from "@/logger";
import { BaseRegistry } from "./BaseRegistry";
import {
  getServiceDescriptorInfo,
  Service,
  ServiceDescriptor
} from "./Service";
import {
  RegistryConfig,
  ServiceRegistryConfig
} from "./types";

/**
 * ServiceRegistry
 */
export abstract class ServiceRegistry
  extends BaseRegistry<Service, ServiceDescriptor> {
  
  public static create(
    logger: Logger,
    config: ServiceRegistryConfig = {}
  ): ServiceRegistry {
    return new ServiceRegistryImpl(logger, config)
  }
  
  protected constructor(
    config: ServiceRegistryConfig = {}
  ) {
    super(config)
  }
}

const LOGGER_NAMESPACE = "[ServiceRegistry]" as const

class ServiceRegistryImpl
  extends ServiceRegistry {
  
  constructor(
    private readonly _logger: Logger,
    config: RegistryConfig<Service, ServiceDescriptor> = {}
  ) {
    super(config)
  }
  
  protected getRegistryEntryInfo(
    descriptor: ServiceDescriptor
  ): [symbol, string] {
    return getServiceDescriptorInfo(descriptor)
  }
  
  protected createRegistry(): ServiceRegistry {
    return new ServiceRegistryImpl(this._logger, this._config)
  }
  
  protected debug(
    message: string,
    ...args: any[]
  ): void {
    this._logger.debug(`${ LOGGER_NAMESPACE } ${ message }`, ...args);
  }
  
  protected info(
    message: string,
    ...args: any[]
  ): void {
    this._logger.info(`${ LOGGER_NAMESPACE } ${ message }`, ...args);
  }
  
  protected warn(
    message: string,
    ...args: any[]
  ): void {
    this._logger.warn(`${ LOGGER_NAMESPACE } ${ message }`, ...args);
  }
  
  protected error(
    message: string,
    ...args: any[]
  ): void {
    this._logger.error(`${ LOGGER_NAMESPACE } ${ message }`, ...args);
  }
  
}
