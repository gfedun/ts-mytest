/**
 * @fileoverview Core BaseRegistry Types
 *
 * This module contains the main registry types and interfaces
 * extracted for better readability and reusability.
 * Focuses on core service registry functionality and factory concerns.
 *
 * @author
 * @version 1.0.0
 */

import {
  Service,
  ServiceDescriptor
} from "./Service";

/**
 * interceptor interface for cross-cutting concerns
 */
export interface RegistryEntryInterceptor<TComponent, TDescriptor> {
  /** interceptor name */
  readonly name: string
  /** Check if this interceptor applies to the given descriptor */
  appliesTo(
    descriptor: TDescriptor
  ): boolean;
  /** Intercept and potentially modify the service instance */
  intercept(
    descriptor: TDescriptor,
    instance: TComponent
  ): TComponent;
}

/**
 * middleware interface for resolution lifecycle hooks
 */
export interface RegistryEntryMiddleware<TComponent, TDescriptor> {
  /** middleware name */
  readonly name: string
  /** Called before service resolution */
  beforeResolve?(
    descriptor: TDescriptor
  ): void;
  /** Called after successful service resolution */
  afterResolve?(
    descriptor: TDescriptor,
    instance: TComponent
  ): void;
  /** Called when service resolution fails */
  onError?(
    descriptor: TDescriptor,
    error: Error
  ): void;
}

/**
 * Configuration options for registry factory
 */
export interface RegistryConfig<TComp, TDesc> {
  /** Enable metrics collection */
  enableMetrics?: boolean;
  /** Enable interceptors */
  enableInterceptors?: boolean;
  /** Enable middleware */
  enableMiddleware?: boolean;
  /** Lifecycle Hooks */
  lifecycleHooks?: RegistryEntryLifecycleHooks<TComp, TDesc>;
  /** Custom interceptors */
  interceptors?: RegistryEntryInterceptor<TComp, TDesc>[];
  /** Custom middleware */
  middleware?: RegistryEntryMiddleware<TComp, TDesc>[];
}

/**
 * BaseRegistry metrics for monitoring service resolution performance
 */
export interface ServiceRegistryMetrics {
  /** Total number of service registrations */
  totalRegistrations: number;
  /** Total number of service resolutions */
  totalResolutions: number;
  /** Number of singleton cache hits */
  singletonHits: number;
  /** Number of scoped cache hits */
  scopedHits: number;
  /** Number of transient service creations */
  transientCreations: number;
  /** Number of resolution errors */
  resolutionErrors: number;
  /** Average resolution time in milliseconds */
  averageResolutionTime: number;
  /** Number of circular dependency detections */
  circularDependencyDetections: number;
}

/**
 * BaseRegistry lifecycle hooks
 */
export interface RegistryEntryLifecycleHooks<TComp, TDesc> {
  /** Called before service registration */
  beforeRegistration?(descriptor: TDesc): void;
  /** Called after service registration */
  afterRegistration?(descriptor: TDesc): void;
  /** Called before service resolution */
  beforeResolution?(descriptor: TDesc): void;
  /** Called after service resolution */
  afterResolution?(
    descriptor: TDesc,
    instance: TComp
  ): void;
}

/**
 * Enumeration of service lifetime types for dependency injection.
 *
 * @enum {string}
 * @readonly
 */
export enum ServiceLifetime {
  /** Single instance for the entire application lifetime */
  Singleton = 'singleton',
  /** New instance created on every resolution */
  Transient = 'transient',
  /** Single instance per scope (useful for request-scoped services) */
  Scoped = 'scoped'
}

export type ServiceRegistryConfig = RegistryConfig<Service, ServiceDescriptor>
export type ServiceInterceptor = RegistryEntryInterceptor<Service, ServiceDescriptor>
export type ServiceMiddleware = RegistryEntryMiddleware<Service, ServiceDescriptor>
export type ServiceLifecycleHooks = RegistryEntryLifecycleHooks<Service, ServiceDescriptor>


