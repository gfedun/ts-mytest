import { RegistryEntryInterceptor } from "@/registry/types";
import {
  getServiceName,
  Service,
  ServiceDescriptor
} from "@/service/Service";

export class CachingInterceptor
  implements RegistryEntryInterceptor<Service, ServiceDescriptor> {
  readonly name = 'CachingInterceptor';
  private cache = new Map<string, { value: any; timestamp: number; ttl: number }>();
  // we need to add CacheSize - to avoid to be too big
  constructor(private defaultTtl: number = 60000) {} // 1 minute default TTL
  
  appliesTo<T extends Service>(descriptor: ServiceDescriptor<T>): boolean {
    // Apply caching to read operations
    // return descriptor.name.includes('Banking');
    return true;
  }
  
  intercept<T extends Service>(
    descriptor: ServiceDescriptor<T>,
    instance: T
  ): T {
    console.log(`Applying caching to ${ getServiceName(descriptor) }`);
    
    return new Proxy(instance as any, {
      get: (
        target,
        prop,
        receiver
      ) => {
        const originalMethod = Reflect.get(target, prop, receiver);
        
        if (typeof originalMethod === 'function' && prop.toString().startsWith('get')) {
          return new Proxy(originalMethod, {
            apply: async (
              fn,
              thisArg,
              args
            ) => {
              const cacheKey = `${ getServiceName(descriptor) }` +
                `.${ prop.toString() }:${ JSON.stringify(args) }`;
              const now = Date.now();
              
              // Check cache
              const cached = this.cache.get(cacheKey);
              if (cached && (now - cached.timestamp) < cached.ttl) {
                console.log(`💾 Cache hit for ${ cacheKey }`);
                return cached.value;
              }
              
              // Execute method and cache result
              const result = await Reflect.apply(fn, thisArg, args);
              this.cache.set(cacheKey, {
                value: result,
                timestamp: now,
                ttl: this.defaultTtl
              });
              
              console.log(`💾 Cached result for ${ cacheKey }`);
              return result;
            }
          });
        }
        
        return originalMethod;
      }
    });
  }
  
  clearCache(): void {
    this.cache.clear();
    console.log('🗑️  Cache cleared');
  }
}
