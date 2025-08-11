/**
 * @fileoverview Service Registration Decorators
 *
 * This module provides decorators for automatic service registration and dependency injection,
 * enabling clean, declarative service configuration using TypeScript decorators.
 *
 * @author
 * @version 1.0.0
 */

import { RegistryEntryLifetime } from "@/registry";
import {
  getServiceDescriptorInfo,
  Service,
  ServiceDescriptor
} from "@/service/Service";

/**
 * getServiceName
 *
 * @param descriptor
 */
function getServiceName<T extends Service>(
  descriptor: ServiceDescriptor<T>
): string {
  const [_, serviceName] = getServiceDescriptorInfo(descriptor)
  return serviceName;
}

/**
 * Interface for decorator registry that supports service registration.
 *
 * @interface
 */
export interface DecoratorRegistry {
  /**
   * Registers a service as singleton.
   *
   * @template T - The service type
   * @param {ServiceDescriptor<T>} descriptor - Service descriptor
   * @param {() => T} factory - Factory function
   * @returns {void}
   */
  registerSingleton<T extends Service>(
    descriptor: ServiceDescriptor<T>,
    factory: () => T
  ): void;
  
  /**
   * Registers a service as transient.
   *
   * @template T - The service type
   * @param {ServiceDescriptor<T>} descriptor - Service descriptor
   * @param {() => T} factory - Factory function
   * @returns {void}
   */
  registerTransient<T extends Service>(
    descriptor: ServiceDescriptor<T>,
    factory: () => T
  ): void;
  
  /**
   * Registers a service as scoped.
   *
   * @template T - The service type
   * @param {ServiceDescriptor<T>} descriptor - Service descriptor
   * @param {() => T} factory - Factory function
   * @returns {void}
   */
  registerScoped<T extends Service>(
    descriptor: ServiceDescriptor<T>,
    factory: () => T
  ): void;
}

/**
 * Metadata storage for dependency injection information.
 */
class DependencyMetadataImpl {
  private static metadata = new Map<any, Map<string | symbol, ServiceDescriptor<any>[]>>();
  private static parameterMetadata = new Map<any, Map<number, ServiceDescriptor<any>>>();
  
  /**
   * Stores parameter dependency metadata.
   *
   * @param {any} target - Target constructor
   * @param {number} parameterIndex - Parameter index
   * @param {ServiceDescriptor<any>} descriptor - Service descriptor
   * @returns {void}
   */
  static setParameterMetadata(
    target: any,
    parameterIndex: number,
    descriptor: ServiceDescriptor<any>
  ): void {
    if (!this.parameterMetadata.has(target)) {
      this.parameterMetadata.set(target, new Map());
    }
    this.parameterMetadata.get(target)!.set(parameterIndex, descriptor);
  }
  
  /**
   * Gets parameter dependency metadata.
   *
   * @param {any} target - Target constructor
   * @returns {Map<number, ServiceDescriptor<any>>} Parameter metadata map
   */
  static getParameterMetadata(target: any): Map<number, ServiceDescriptor<any>> {
    return this.parameterMetadata.get(target) || new Map();
  }
  
  /**
   * Stores property dependency metadata.
   *
   * @param {any} target - Target constructor
   * @param {string | symbol} propertyKey - Property key
   * @param {ServiceDescriptor<any>} descriptor - Service descriptor
   * @returns {void}
   */
  static setPropertyMetadata(
    target: any,
    propertyKey: string | symbol,
    descriptor: ServiceDescriptor<any>
  ): void {
    if (!this.metadata.has(target)) {
      this.metadata.set(target, new Map());
    }
    if (!this.metadata.get(target)!.has(propertyKey)) {
      this.metadata.get(target)!.set(propertyKey, []);
    }
    this.metadata.get(target)!.get(propertyKey)!.push(descriptor);
  }
  
  /**
   * Gets property dependency metadata.
   *
   * @param {any} target - Target constructor
   * @param {string | symbol} propertyKey - Property key
   * @returns {ServiceDescriptor<any>[]} Array of service descriptors
   */
  static getPropertyMetadata(
    target: any,
    propertyKey: string | symbol
  ): ServiceDescriptor<any>[] {
    return this.metadata.get(target)?.get(propertyKey) || [];
  }
  
  /**
   * Gets all dependency metadata for a target.
   *
   * @param {any} target - Target constructor
   * @returns {Object} Combined metadata object
   */
  static getAllMetadata(target: any): {
    parameters: Map<number, ServiceDescriptor<any>>;
    properties: Map<string | symbol, ServiceDescriptor<any>[]>;
  } {
    return {
      parameters: this.getParameterMetadata(target),
      properties: this.metadata.get(target) || new Map()
    };
  }
  
  /**
   * Clears all metadata for a target.
   *
   * @param {any} target - Target constructor
   * @returns {void}
   */
  static clearMetadata(target: any): void {
    this.metadata.delete(target);
    this.parameterMetadata.delete(target);
  }
}

/**
 * Global registry reference for decorators.
 */
let decoratorRegistry: DecoratorRegistry | null = null;

/**
 * Sets the registry to use for decorator-based registration.
 *
 * @param {DecoratorRegistry} registry - Registry instance
 * @returns {void}
 */
export function setDecoratorRegistry(registry: DecoratorRegistry): void {
  decoratorRegistry = registry;
}

/**
 * Gets the current decorator registry.
 *
 * @returns {DecoratorRegistry | null} Current registry or null if not set
 */
export function getDecoratorRegistry(): DecoratorRegistry | null {
  return decoratorRegistry;
}

/**
 * Service decorator for automatic registration.
 *
 * @template T - The service type
 * @param {ServiceDescriptor<T>} descriptor - Service descriptor
 * @param {RegistryEntryLifetime} lifetime - Service lifetime (default: Singleton)
 * @returns {ClassDecorator} Class decorator function
 *
 * @example
 * ```typescript
 * @Injectable(UserServiceDescriptor, ServiceLifetime.Singleton)
 * class UserService {
 *   // ...
 * }
 * ```
 */
export function Injectable<T extends Service>(
  descriptor: ServiceDescriptor<T>,
  lifetime: RegistryEntryLifetime = RegistryEntryLifetime.Singleton
): ClassDecorator {
  return function (target: Function) {
    if (!decoratorRegistry) {
      console.warn(
        `Injectable decorator: No registry configured for ${ getServiceName(descriptor) }.` +
        ` Call setDecoratorRegistry() first.`);
      return;
    }
    
    // Auto-register the service when the class is defined
    const factory = () => {
      // Get dependency metadata
      const metadata = DependencyMetadataImpl.getAllMetadata(target);
      const parameterDeps = Array.from(metadata.parameters.entries())
        .sort((
          [a],
          [b]
        ) => a - b)
        .map(([, desc]) => desc);
      
      // If we have parameter dependencies, resolve them
      if (parameterDeps.length > 0 && decoratorRegistry) {
        const resolvedDeps = parameterDeps.map(dep => {
          // This would need access to the resolve method
          // For now, we'll create without dependencies
          // TODO: finish
          return null;
        });
        // @ts-ignore
        return new (target as any)(...resolvedDeps.filter(dep => dep !== null));
      }
      
      // @ts-ignore
      return new (target as any)();
    };
    
    switch (lifetime) {
      case RegistryEntryLifetime.Singleton:
        decoratorRegistry.registerSingleton(descriptor, factory);
        break;
      case RegistryEntryLifetime.Transient:
        decoratorRegistry.registerTransient(descriptor, factory);
        break;
      case RegistryEntryLifetime.Scoped:
        decoratorRegistry.registerScoped(descriptor, factory);
        break;
      default:
        throw new Error(`Unknown service lifetime: ${ lifetime }`);
    }
  };
}

/**
 * Dependency injection decorator for constructor parameters.
 *
 * @template T - The service type
 * @param {ServiceDescriptor<T>} descriptor - Service descriptor for the dependency
 * @returns {ParameterDecorator} Parameter decorator function
 *
 * @example
 * ```typescript
 * class UserService {
 *   constructor(
 *     @Inject(DatabaseDescriptor) private db: IDatabase,
 *     @Inject(LoggerDescriptor) private logger: ILogger
 *   ) {}
 * }
 * ```
 */
export function Inject<T extends Service>(descriptor: ServiceDescriptor<T>): ParameterDecorator {
  return function (
    target: any,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void {
    // Store metadata about dependencies for later resolution
    DependencyMetadataImpl.setParameterMetadata(target, parameterIndex, descriptor);
    
    // Log for demonstration purposes
    if (process.env.NODE_ENV === 'development') {
      console.log(
        `Dependency injection metadata: ${ target.name || 'Unknown' } parameter ${ parameterIndex }` +
        ` -> ${ getServiceName(descriptor) }`);
    }
  };
}

/**
 * Property injection decorator for injecting services into properties.
 *
 * @template T - The service type
 * @param {ServiceDescriptor<T>} descriptor - Service descriptor for the dependency
 * @returns {PropertyDecorator} Property decorator function
 *
 * @example
 * ```typescript
 * class UserService {
 *   @InjectProperty(DatabaseDescriptor)
 *   private db!: IDatabase;
 * }
 * ```
 */
export function InjectProperty<T extends Service>(descriptor: ServiceDescriptor<T>): PropertyDecorator {
  return function (
    target: any,
    propertyKey: string | symbol
  ): void {
    // Store property injection metadata
    DependencyMetadataImpl.setPropertyMetadata(target.constructor, propertyKey, descriptor);
    
    // Define a getter that resolves the service lazily
    Object.defineProperty(target, propertyKey, {
      get: function (this: any) {
        if (!decoratorRegistry) {
          throw new Error(`InjectProperty: No registry configured for ${ getServiceName(descriptor) }`);
        }
        
        // This would need access to the resolve method
        // For demonstration, we'll return undefined
        console.warn(`Property injection for ${ getServiceName(descriptor) } would be resolved here`);
        return undefined;
      },
      configurable: true,
      enumerable: true
    });
  };
}

/**
 * Method injection decorator for injecting services into method parameters.
 *
 * @template T - The service type
 * @param {ServiceDescriptor<T>} descriptor - Service descriptor for the dependency
 * @returns {ParameterDecorator} Parameter decorator function
 *
 * @example
 * ```typescript
 * class UserService {
 *   processUser(@InjectMethod(DatabaseDescriptor) db: IDatabase) {
 *     // ...
 *   }
 * }
 * ```
 */
export function InjectMethod<T extends Service>(descriptor: ServiceDescriptor<T>): ParameterDecorator {
  return function (
    target: any,
    propertyKey: string | symbol | undefined,
    parameterIndex: number
  ): void {
    if (propertyKey) {
      // Store method parameter injection metadata
      const key = `${ String(propertyKey) }_param_${ parameterIndex }`;
      DependencyMetadataImpl.setPropertyMetadata(target.constructor, key, descriptor);
    }
  };
}

/**
 * Singleton decorator for automatic singleton registration.
 *
 * @template T - The service type
 * @param {ServiceDescriptor<T>} descriptor - Service descriptor
 * @returns {ClassDecorator} Class decorator function
 *
 * @example
 * ```typescript
 * @Singleton(UserServiceDescriptor)
 * class UserService {
 *   // Automatically registered as singleton
 * }
 * ```
 */
export function Singleton<T extends Service>(descriptor: ServiceDescriptor<T>): ClassDecorator {
  return Injectable(descriptor, RegistryEntryLifetime.Singleton);
}

/**
 * Transient decorator for automatic transient registration.
 *
 * @template T - The service type
 * @param {ServiceDescriptor<T>} descriptor - Service descriptor
 * @returns {ClassDecorator} Class decorator function
 *
 * @example
 * ```typescript
 * @Transient(RequestProcessorDescriptor)
 * class RequestProcessor {
 *   // Automatically registered as transient
 * }
 * ```
 */
export function Transient<T extends Service>(descriptor: ServiceDescriptor<T>): ClassDecorator {
  return Injectable(descriptor, RegistryEntryLifetime.Transient);
}

/**
 * Scoped decorator for automatic scoped registration.
 *
 * @template T - The service type
 * @param {ServiceDescriptor<T>} descriptor - Service descriptor
 * @returns {ClassDecorator} Class decorator function
 *
 * @example
 * ```typescript
 * @Scoped(RequestServiceDescriptor)
 * class RequestService {
 *   // Automatically registered as scoped
 * }
 * ```
 */
export function Scoped<T extends Service>(descriptor: ServiceDescriptor<T>): ClassDecorator {
  return Injectable(descriptor, RegistryEntryLifetime.Scoped);
}

/**
 * Configuration decorator for registering configuration classes.
 *
 * @param {string} prefix - Configuration prefix
 * @returns {ClassDecorator} Class decorator function
 *
 * @example
 * ```typescript
 * @Configuration('database')
 * class DatabaseConfig {
 *   host = 'localhost';
 *   port = 5432;
 * }
 * ```
 */
// export function Configuration(prefix: string = ''): ClassDecorator {
//   return function <T extends new (...args: any[]) => any>(constructor: T): T {
//     // This would integrate with a configuration system
//     console.log(`Configuration class registered with prefix: ${prefix}`);
//     return constructor;
//   };
// }
export function Configuration(prefix: string = ''): ClassDecorator {
  return function (target: Function) {
    // This would integrate with a configuration system
    console.log(`Configuration class registered with prefix: ${ prefix }`);
  };
}

/**
 * Utility namespace for decorator-related operations.
 *
 * @namespace
 */
export namespace DecoratorUtils {
  /**
   * Gets all dependency metadata for a class.
   *
   * @param {any} target - Target class
   * @returns {Object} Dependency metadata
   */
  export function getDependencyMetadata(target: any) {
    return DependencyMetadataImpl.getAllMetadata(target);
  }
  
  /**
   * Clears dependency metadata for a class.
   *
   * @param {any} target - Target class
   * @returns {void}
   */
  export function clearDependencyMetadata(target: any): void {
    DependencyMetadataImpl.clearMetadata(target);
  }
  
  /**
   * Checks if a class has injectable metadata.
   *
   * @param {any} target - Target class
   * @returns {boolean} True if class has dependency metadata
   */
  export function hasInjectableMetadata(target: any): boolean {
    const metadata = DependencyMetadataImpl.getAllMetadata(target);
    return metadata.parameters.size > 0 || metadata.properties.size > 0;
  }
  
  /**
   * Gets constructor parameter dependencies.
   *
   * @param {any} target - Target class
   * @returns {ServiceDescriptor<any>[]} Array of parameter dependencies
   */
  export function getConstructorDependencies(target: any): ServiceDescriptor<any>[] {
    const metadata = DependencyMetadataImpl.getParameterMetadata(target);
    return Array.from(metadata.entries())
      .sort((
        [a],
        [b]
      ) => a - b)
      .map(([, descriptor]) => descriptor);
  }
  
  /**
   * Gets property dependencies.
   *
   * @param {any} target - Target class
   * @returns {Map<string | symbol, ServiceDescriptor<any>[]>} Property dependencies map
   */
  export function getPropertyDependencies(target: any): Map<string | symbol, ServiceDescriptor<any>[]> {
    return DependencyMetadataImpl.getAllMetadata(target).properties;
  }
}
