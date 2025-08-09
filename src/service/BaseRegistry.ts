/**
 * @fileoverview Enhanced Service BaseRegistry with Interceptors and Advanced Features
 *
 * This module provides an advanced BaseRegistry Entry registry that extends the basic functionality
 * with interceptors, middleware, and enhanced resolution capabilities.
 *
 * @author
 * @version 1.0.0
 */

import { Either } from "@/either";
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Exception } from '@/exception/Exception';
import { ExceptionFactory } from '@/exception/ExceptionFactory';
import { Maybe } from '@/maybe';
import { ServiceRegistryError, } from './ServiceRegistryError';
import { RegistryEntryDescriptor } from "./Service";
import {
  RegistryConfig,
  RegistryEntryInterceptor,
  RegistryEntryLifecycleHooks,
  ServiceLifetime,
  RegistryEntryMiddleware,
  ServiceRegistryMetrics
} from './types';

/**
 * Service registration configuration containing factory function and lifetime information.
 *
 * @template T - The BaseRegistry Entry type
 * @interface
 */
interface RegistryEntryRegistration<
  TComponent, TDescriptor extends RegistryEntryDescriptor<TComponent>
> {
  /** Unique symbol identifier for the BaseRegistry Entry */
  readonly descriptor: TDescriptor;
  /** Factory function that creates BaseRegistry Entry instances */
  readonly factory: () => TComponent;
  /** Service lifetime management strategy */
  readonly lifetime: ServiceLifetime;
}

/**
 * Service registry implementation with advanced features
 */
export abstract class BaseRegistry<
  TComponent, TDescriptor extends RegistryEntryDescriptor<TComponent>
> {
  private readonly _registrations = new Map<symbol, RegistryEntryRegistration<TComponent, TDescriptor>>();
  private readonly _singletonInstances = new Map<symbol, TComponent>();
  private readonly _scopedInstances = new Map<symbol, TComponent>();
  private readonly _isResolving = new Set<symbol>();
  private readonly _interceptors: RegistryEntryInterceptor<TComponent, TDescriptor>[] = [];
  private readonly _middleware: RegistryEntryMiddleware<TComponent, TDescriptor>[] = [];
  private readonly _metrics: ServiceRegistryMetrics;
  private readonly _lifecycleHooks: RegistryEntryLifecycleHooks<TComponent, TDescriptor>;
  private readonly _enableCircularDependencyDetection = false;
  protected _config: RegistryConfig<TComponent, TDescriptor>;
  
  constructor(
    config: RegistryConfig<TComponent, TDescriptor> = {}
  ) {
    this._config = {
      enableMetrics: true,
      enableInterceptors: true,
      enableMiddleware: false,
      ...config
    };
    
    this._metrics = {
      totalRegistrations: 0,
      totalResolutions: 0,
      singletonHits: 0,
      scopedHits: 0,
      transientCreations: 0,
      resolutionErrors: 0,
      averageResolutionTime: 0,
      circularDependencyDetections: 0
    };
    
    if (config.interceptors) {
      config.interceptors.forEach(interceptor => {
        this.addInterceptor(interceptor);
      });
    }
    if (config.middleware) {
      config.middleware.forEach(middleware => {
        this.addMiddleware(middleware);
      });
    }
    
    this._lifecycleHooks = this._config?.lifecycleHooks ?? {};
  }
  
  protected abstract getRegistryEntryInfo(
    descriptor: TDescriptor
  ): [symbol, string];
  
  protected abstract createRegistry(
    // config?: RegistryConfig<TComponent, TDescriptor>
  ): BaseRegistry<TComponent, TDescriptor>;
  
  register<TComp extends TComponent, TDesc extends TDescriptor>(
    descriptor: TDesc,
    factory: () => TComp,
    lifetime: ServiceLifetime = ServiceLifetime.Singleton
  ): Either<ServiceRegistryError, void> {
    
    if (!descriptor) {
      // NEW: Use unified error system with proper error chaining
      return Either.left(ServiceRegistryError.create(
        UnifiedErrorCode.INVALID_REGISTRY_ENTRY_DESCRIPTOR,
        'BaseRegistry Entry descriptor cannot be null or undefined',
        'register',
        { timestamp: new Date() }
      ));
    }
    const [descriptorSymbol, descriptorName] = this.getRegistryEntryInfo(descriptor)
    if (!factory || typeof factory !== 'function') {
      // NEW: Use unified error system with proper context preservation
      return Either.left(ServiceRegistryError.create(
        UnifiedErrorCode.INVALID_REGISTRY_ENTRY_FACTORY,
        `Invalid factory function for Registry Entry '${ descriptorName }'`,
        'register',
        {
          serviceDescriptor: descriptorName,
          serviceName: descriptorName,
          timestamp: new Date()
        }
      ));
    }
    
    try {
      if (this._registrations.has(descriptorSymbol)) {
        // NEW: Use RegistryError factory method with unified error codes
        return Either.left(ServiceRegistryError.create(
          UnifiedErrorCode.REGISTRY_ENTRY_ALREADY_REGISTERED,
          `Registry Entry '${ descriptorName }' is already registered`,
          'register',
          {
            serviceDescriptor: descriptorName,
            serviceName: descriptorName,
            timestamp: new Date()
          }
        ));
      }
      
      this._lifecycleHooks?.beforeRegistration?.(descriptor)
      
      this._registrations.set(descriptorSymbol, {
        descriptor: descriptor,
        factory,
        lifetime,
      });
      
      this._metrics.totalRegistrations++;
      
      // Run middleware
      this._middleware.forEach(m => {
        try {
          m.beforeResolve?.(descriptor);
        } catch (error) {
          this.warn(`Middleware error during registration: ${ error }`);
        }
      });
      
      this._lifecycleHooks?.afterRegistration?.(descriptor)
      this.debug(`Registry Entry '${ descriptorName }' registered with lifetime '${ lifetime }'`);
      return Either.right(undefined as void);
    } catch (error) {
      // NEW: Use ExceptionFactory.convertAndPreserve for complete information preservation
      const preservedError = ExceptionFactory.convertAndPreserve<ServiceRegistryError>(
        error instanceof Error ? error : new Error(String(error)),
        UnifiedErrorCode.REGISTRATION_FAILED,
        'REGISTRY',
        'register',
        `Failed to register Registry Entry '${ descriptorName }'`,
        {
          additionalData:
            {
              serviceDescriptor: descriptorName,
              serviceName: descriptorName,
              serviceLifetime: lifetime,
              registryOperation: 'register'
            }
        }
      );
      
      this.error(`Registry Entry registration failed: ${ preservedError.getDetailedMessage() }`);
      return Either.left(preservedError);
    }
  }
  
  registerSingleton<TComp extends TComponent, TDesc extends TDescriptor>(
    descriptor: TDesc,
    factory: () => TComp
  ): Either<ServiceRegistryError, void> {
    return this.register(descriptor, factory, ServiceLifetime.Singleton);
  }
  
  registerTransient<TComp extends TComponent, TDesc extends TDescriptor>(
    descriptor: TDesc,
    factory: () => TComp
  ): Either<ServiceRegistryError, void> {
    return this.register(descriptor, factory, ServiceLifetime.Transient);
  }
  
  registerScoped<TComp extends TComponent, TDesc extends TDescriptor>(
    descriptor: TDesc,
    factory: () => TComp
  ): Either<ServiceRegistryError, void> {
    return this.register(descriptor, factory, ServiceLifetime.Scoped);
  }
  
  registerInstance<TComp extends TComponent, TDesc extends TDescriptor>(
    descriptor: TDesc,
    instance: TComp
  ): Either<ServiceRegistryError, void> {
    return this.register(descriptor, () => instance, ServiceLifetime.Singleton);
  }
  
  resolve<TComp extends TComponent, TDesc extends TDescriptor>(
    descriptor: TDesc
  ): Maybe<TComp> {
    const result = this.tryResolve<TComp, TDesc>(descriptor)
    if (Either.isLeft(result)) {
      return Maybe.nothing();
    } else {
      return Maybe.just(result.right);
    }
  }
  
  tryResolve<TComp extends TComponent, TDesc extends TDescriptor>(
    descriptor: TDesc
  ): Either<ServiceRegistryError, TComp> {
    const startTime = Date.now();
    const [descriptorSymbol, descriptorName] = this.getRegistryEntryInfo(descriptor)
    
    try {
      this._lifecycleHooks?.beforeResolution?.(descriptor);
      (this._metrics as any).totalResolutions++;
      
      // Run before middleware with enhanced error handling
      this._middleware.forEach(m => {
        try {
          m.beforeResolve?.(descriptor);
        } catch (error) {
          // NEW: Use unified error chaining for middleware errors
          throw ExceptionFactory.convertAndPreserve<ServiceRegistryError>(
            error instanceof Error ? error : new Error(String(error)),
            UnifiedErrorCode.MIDDLEWARE_ERROR,
            'REGISTRY',
            'tryResolve',
            `Middleware failed before Registry Entry resolution for '${ descriptorName }'`,
            {
              additionalData: {
                serviceDescriptor: descriptorName,
                serviceName: descriptorName,
                middlewareName: 'unknown',
                middlewareStage: 'beforeResolve'
              }
            }
          );
        }
      });
      
      // Apply interceptors with enhanced error handling
      let finalInstance = this.resolveInternal<TComponent, TDescriptor>(descriptor);
      for (const interceptor of this._interceptors) {
        if (interceptor.appliesTo(descriptor)) {
          try {
            finalInstance = interceptor.intercept(descriptor, finalInstance);
          } catch (error) {
            // NEW: Use unified error chaining for interceptor errors
            throw ExceptionFactory.convertAndPreserve<ServiceRegistryError>(
              error instanceof Error ? error : new Error(String(error)),
              UnifiedErrorCode.INTERCEPTOR_ERROR,
              'REGISTRY',
              'tryResolve',
              `Interceptor failed for Registry Entry '${ descriptorName }'`,
              {
                additionalData: {
                  serviceDescriptor: descriptorName,
                  serviceName: descriptorName,
                  interceptorName: 'unknown',
                  interceptorStage: 'intercept'
                }
              }
            );
          }
        }
      }
      
      // Run after middleware
      this._middleware.forEach(m => {
        try {
          m.afterResolve?.(descriptor, finalInstance);
        } catch (error) {
          this.warn(`Middleware error after Registry Entry resolution for '${ descriptorName }': ${ error }`);
        }
      });
      
      // Update metrics
      if (this._config.enableMetrics) {
        const duration = Date.now() - startTime;
        (this._metrics as any).averageResolutionTime =
          (
            this._metrics.averageResolutionTime * (this._metrics.totalResolutions - 1)
            + duration
          ) / this._metrics.totalResolutions;
      }
      
      this._lifecycleHooks?.afterResolution?.(descriptor, finalInstance);
      this.debug(`Registry Entry '${ descriptorName }' resolved successfully`);
      return Either.right(finalInstance as TComp);
    } catch (error) {
      (this._metrics as any).resolutionErrors++;
      
      // Run error middleware
      const err = error instanceof Error ? error : new Error(String(error));
      this._middleware.forEach(m => {
        try {
          m.onError?.(descriptor, err);
        } catch (middlewareError) {
          this.warn(`Middleware error during error handling: ${ middlewareError }`);
        }
      });
      
      // NEW: Handle RegistryError instances with proper preservation
      if (error instanceof ServiceRegistryError) {
        this.error(`Registry Entry resolution failed: ${ error.getDetailedMessage() }`);
        return Either.left(error);
      }
      
      // NEW: Convert other errors using the preservation system
      const preservedError = ExceptionFactory.convertAndPreserve<ServiceRegistryError>(
        error instanceof Error ? error : new Error(String(error)),
        UnifiedErrorCode.REGISTRY_ENTRY_RESOLUTION_FAILED,
        'REGISTRY',
        'tryResolve',
        `Failed to resolve Registry Entry '${ descriptorName }'`,
        {
          additionalData: {
            serviceDescriptor: descriptorName,
            serviceName: descriptorName,
            performanceMetrics: { resolutionTime: Date.now() - startTime },
            resolutionAttempt: true
          }
        }
      );
      
      this.error(`Registry Entry resolution failed: ${ preservedError.getDetailedMessage() }`);
      return Either.left(preservedError);
    }
  }
  
  isRegistered(
    descriptor: TDescriptor
  ): boolean {
    const [descriptorSymbol] = this.getRegistryEntryInfo(descriptor)
    return this._registrations.has(descriptorSymbol);
  }
  
  unregister(
    descriptor: TDescriptor
  ): void {
    const [descriptorSymbol] = this.getRegistryEntryInfo(descriptor)
    this._registrations.delete(descriptorSymbol);
    this._singletonInstances.delete(descriptorSymbol);
    this._scopedInstances.delete(descriptorSymbol);
  }
  
  clear(): void {
    this._registrations.clear();
    this._singletonInstances.clear();
    this._scopedInstances.clear();
    this._isResolving.clear();
  }
  
  clearScoped(): void {
    this._scopedInstances.clear();
  }
  
  // Internal methods
  private canResolveInternal<TDesc extends TDescriptor>(
    descriptor: TDesc
  ): Maybe<RegistryEntryRegistration<TComponent, TDescriptor>> {
    const [, descriptorName] = this.getRegistryEntryInfo(descriptor)
    const descriptorSymbol = this.getRegistryEntryInfo(descriptor)[0];
    if (this._enableCircularDependencyDetection && this._isResolving.has(descriptorSymbol)) {
      (this._metrics as any).circularDependencyDetections++;
      const resolutionChain = Array.from(this._isResolving).map(() => descriptorName);
      resolutionChain.push(descriptorName);
      // NEW: Use unified error system for circular dependency detection
      throw ServiceRegistryError.circularDependency(
        descriptorName,
        resolutionChain,
        'canResolveInternal'
      );
    }
    return Maybe.fromNullable(this._registrations.get(descriptorSymbol));
  }
  
  // Internal methods
  private resolveInternal<TComp extends TComponent, TDesc extends TDescriptor>(
    descriptor: TDesc
  ): TComp {
    const [descriptorSymbol, descriptorName] = this.getRegistryEntryInfo(descriptor)
    const registrationMaybe = this.canResolveInternal(descriptor);
    if (Maybe.isNothing(registrationMaybe)) {
      // NEW: Use unified error system for service not found
      throw ServiceRegistryError.serviceNotFound(descriptorName, 'resolveInternal');
    }
    const registration = registrationMaybe.value;
    try {
      switch (registration.lifetime) {
        case ServiceLifetime.Singleton:
          return this.resolveSingleton(
            registration as RegistryEntryRegistration<TComponent, TDescriptor>
          ) as TComp;
        case ServiceLifetime.Scoped:
          return this.resolveScoped(
            registration as RegistryEntryRegistration<TComponent, TDescriptor>
          ) as TComp;
        case ServiceLifetime.Transient:
          return this.resolveTransient(
            registration as RegistryEntryRegistration<TComponent, TDescriptor>
          ) as TComp;
        default:
          // NEW: Use unified error system for invalid lifetime
          throw ServiceRegistryError.create(
            UnifiedErrorCode.INVALID_REGISTRY_ENTRY_LIFETIME,
            `Invalid service lifetime '${ String(registration.lifetime) }' for Registry Entry '${ descriptorName }'`,
            'resolveInternal',
            {
              serviceDescriptor: descriptorName,
              serviceName: descriptorName,
              serviceLifetime: String(registration.lifetime),
              timestamp: new Date()
            }
          );
      }
    } catch (error) {
      if (error instanceof ServiceRegistryError) {
        throw error;
      }
      // NEW: Use ExceptionFactory.convertAndPreserve for instantiation failures
      throw ExceptionFactory.convertAndPreserve<ServiceRegistryError>(
        error instanceof Error ? error : new Error(String(error)),
        UnifiedErrorCode.REGISTRY_ENTRY_INSTANTIATION_FAILED,
        'REGISTRY',
        'resolveInternal',
        `Registry Entry instantiation failed for '${ descriptorName }'`,
        {
          additionalData: {
            serviceDescriptor: descriptorName,
            serviceName: descriptorName,
            serviceLifetime: registration.lifetime,
            instantiationAttempt: true
          }
        }
      );
    }
  }
  
  private resolveSingleton(
    registration: RegistryEntryRegistration<TComponent, TDescriptor>
  ): TComponent {
    const [descriptorSymbol, _] = this.getRegistryEntryInfo(registration.descriptor)
    if (this._singletonInstances.has(descriptorSymbol)) {
      (this._metrics as any).singletonHits++;
      return this._singletonInstances.get(descriptorSymbol)!;
    }
    const instance = this.createInstance(registration);
    this._singletonInstances.set(descriptorSymbol, instance);
    return instance;
  }
  
  private resolveScoped(
    registration: RegistryEntryRegistration<TComponent, TDescriptor>
  ): TComponent {
    const [descriptorSymbol, _] = this.getRegistryEntryInfo(registration.descriptor)
    if (this._scopedInstances.has(descriptorSymbol)) {
      (this._metrics as any).scopedHits++;
      return this._scopedInstances.get(descriptorSymbol)!;
    }
    const instance = this.createInstance(registration);
    this._scopedInstances.set(descriptorSymbol, instance);
    return instance;
  }
  
  private resolveTransient(
    registration: RegistryEntryRegistration<TComponent, TDescriptor>
  ): TComponent {
    (this._metrics as any).transientCreations++;
    return this.createInstance(registration);
  }
  
  private createInstance(
    registration: RegistryEntryRegistration<TComponent, TDescriptor>
  ): TComponent {
    const [descriptorSymbol, descriptorName] = this.getRegistryEntryInfo(registration.descriptor)
    if (this._enableCircularDependencyDetection) {
      this._isResolving.add(descriptorSymbol);
    }
    try {
      const instance = registration.factory();
      if (!instance) {
        // NEW: Use unified error system for null instance errors
        throw ServiceRegistryError.create(
          UnifiedErrorCode.REGISTRY_ENTRY_INSTANTIATION_FAILED,
          `Factory function returned null or undefined for Registry Entry '${ descriptorName }'`,
          'createInstance',
          {
            serviceDescriptor: descriptorName,
            serviceName: descriptorName,
            serviceLifetime: registration.lifetime,
            timestamp: new Date()
          }
        );
      }
      return instance;
    } catch (error) {
      if (error instanceof ServiceRegistryError) {
        throw error;
      }
      // NEW: Use RegistryError.factoryExecutionFailed for factory execution failures
      throw ServiceRegistryError.factoryExecutionFailed(
        descriptorName,
        'createInstance',
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined
      );
    } finally {
      if (this._enableCircularDependencyDetection) {
        this._isResolving.delete(descriptorSymbol);
      }
    }
  }
  
  addInterceptor(
    interceptor: RegistryEntryInterceptor<TComponent, TDescriptor>
  ): Either<ServiceRegistryError, void> {
    if (!interceptor) {
      // NEW: Use unified error system for interceptor registration failures
      return Either.left(ServiceRegistryError.create(
        UnifiedErrorCode.INTERCEPTOR_REGISTRATION_FAILED,
        'Interceptor cannot be null or undefined',
        'addInterceptor',
        { timestamp: new Date() }
      ));
    }
    this._interceptors.push(interceptor);
    this.debug(`Interceptor added successfully`);
    return Either.right(undefined as void)
  }
  
  addMiddleware(
    middleware: RegistryEntryMiddleware<TComponent, TDescriptor>
  ): Either<ServiceRegistryError, void> {
    if (!middleware) {
      // NEW: Use unified error system for middleware registration failures
      return Either.left(ServiceRegistryError.create(
        UnifiedErrorCode.MIDDLEWARE_REGISTRATION_FAILED,
        'Middleware cannot be null or undefined',
        'addMiddleware',
        { timestamp: new Date() }
      ));
    }
    this._middleware.push(middleware);
    this.debug(`Middleware added successfully`);
    return Either.right(undefined as void)
  }
  
  getMetrics(): ServiceRegistryMetrics {
    return { ...this._metrics };
  }
  
  getAllServices(): Array<{
    descriptor: TDescriptor;
    lifetime: ServiceLifetime;
  }> {
    const result: Array<{
      descriptor: TDescriptor;
      lifetime: ServiceLifetime;
    }> = [];
    
    for (const [, registration] of this._registrations) {
      result.push({
        descriptor: registration.descriptor,
        lifetime: registration.lifetime,
      });
    }
    return result;
  }
  
  createScopedRegistry(
    parent: BaseRegistry<TComponent, TDescriptor>
  ): Either<ServiceRegistryError, BaseRegistry<TComponent, TDescriptor>> {
    const scopedRegistry = this.createRegistry();
    // Copy all parent registrations
    const parentServices = parent.getAllServices();
    try {
      parentServices.forEach(registryEntry => {
        const [, descriptorName] = this.getRegistryEntryInfo(registryEntry.descriptor)
        scopedRegistry.register(
          registryEntry.descriptor,
          // Create a factory that resolves from parent for singletons
          registryEntry.lifetime === ServiceLifetime.Singleton
            ? () => {
              const result = parent.resolve(registryEntry.descriptor);
              if (Maybe.isJust(result)) {
                return result.value;
              }
              // NEW: Use unified error system for parent resolution failures
              throw ServiceRegistryError.create(
                UnifiedErrorCode.REGISTRY_ENTRY_RESOLUTION_FAILED,
                `Failed to resolve Registry Entry for Singleton '${ descriptorName }' from parent registry`,
                'createScopedRegistry',
                {
                  serviceDescriptor: descriptorName,
                  serviceName: descriptorName,
                  timestamp: new Date()
                }
              );
            }
            : () => {
              const result = parent.resolve(registryEntry.descriptor);
              if (Maybe.isJust(result)) {
                return result.value;
              }
              // NEW: Use unified error system for parent resolution failures
              throw ServiceRegistryError.create(
                UnifiedErrorCode.REGISTRY_ENTRY_RESOLUTION_FAILED,
                `Failed to resolve Registry Entry for Transient '${ descriptorName }' from parent registry`,
                'createScopedRegistry',
                {
                  serviceDescriptor: descriptorName,
                  serviceName: descriptorName,
                  timestamp: new Date()
                }
              );
            },
          registryEntry.lifetime,
        );
      });
      return Either.right(scopedRegistry);
    } catch (error) {
      if (error instanceof ServiceRegistryError) {
        return Either.left(error);
      }
      // NEW: Use ExceptionFactory.convertAndPreserve for scoped registry creation failures
      const preservedError = ExceptionFactory.convertAndPreserve<ServiceRegistryError>(
        error instanceof Error ? error : new Error(String(error)),
        UnifiedErrorCode.SCOPED_REGISTRY_ERROR,
        'REGISTRY',
        'createScopedRegistry',
        'Unexpected exception during scoped registry creation',
        {
          additionalData: {
            scopedRegistryCreation: true,
            parentServicesCount: parentServices.length,
            timestamp: new Date()
          }
        }
      );
      
      this.error(`Unexpected exception during scoped registry creation: ${ preservedError.getDetailedMessage() }`);
      return Either.left(preservedError);
    }
  }
  
  protected abstract debug(
    message: string,
    ...args: any[]
  ): void;
  
  protected abstract info(
    message: string,
    ...args: any[]
  ): void;
  
  protected abstract warn(
    message: string,
    ...args: any[]
  ): void;
  
  protected abstract error(
    message: string,
    ...args: any[]
  ): void;
}
