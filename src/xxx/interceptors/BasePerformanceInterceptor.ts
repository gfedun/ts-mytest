import { RegistryEntryInterceptor } from "@/registry/types";
import {
  getServiceName,
  Service,
  ServiceDescriptor
} from "@/service/Service";

const symbolPerformanceInterceptor: unique symbol = Symbol.for("cla/lib/PerformanceInterceptor")

const hasPerformanceInterceptor = (u: unknown): u is BasePerformanceInterceptor =>
  typeof u === "object" && u !== null && symbolPerformanceInterceptor in u

/**
 * Performance monitoring interceptor
 */
export abstract class BasePerformanceInterceptor
  implements RegistryEntryInterceptor<Service, ServiceDescriptor> {
  
  readonly name = 'PerformanceInterceptor';
  private readonly _metrics = new Map<string, {
    calls: number;
    totalTime: number;
    errors: number,
    minTime: number,
    maxTime: number
  }>();
  
  abstract appliesTo<T extends Service>(descriptor: ServiceDescriptor<T>): boolean;
  
  intercept<T extends Service>(
    descriptor: ServiceDescriptor<T>,
    instance: T
  ): T {
    if (hasPerformanceInterceptor(instance)) {
      return instance;
    }
    const proxy = new Proxy(instance as any, {
      get: (
        target,
        prop,
        receiver
      ) => {
        const originalMethod = Reflect.get(target, prop, receiver);
        if (typeof originalMethod === 'function') {
          const isAsyncFunction = originalMethod.constructor.name === 'AsyncFunction';
          if (isAsyncFunction) {
            return this.createAsyncProxy(originalMethod, descriptor, prop);
          } else {
            return this.createSyncProxy(originalMethod, descriptor, prop);
          }
        }
        return originalMethod;
      }
    });
    proxy[symbolPerformanceInterceptor] = () => this.name
    return proxy
  }
  
  private createSyncProxy<T extends Service>(
    originalMethod: any,
    descriptor: ServiceDescriptor<T>,
    prop: string | symbol
  ) {
    return new Proxy(originalMethod, {
      apply: (
        fn,
        thisArg,
        args
      ) => {
        const methodName = `${ getServiceName(descriptor) }.${ prop.toString() }`;
        const startTime = Date.now();
        // Initialize _metrics
        if (!this._metrics.has(methodName)) {
          this._metrics.set(methodName, {
            calls: 0,
            totalTime: 0,
            errors: 0,
            minTime: Infinity,
            maxTime: 0
          });
        }
        const metric = this._metrics.get(methodName)!;
        metric.calls++;
        try {
          const result = Reflect.apply(fn, thisArg, args);
          const endTime = Date.now();
          const time = (endTime - startTime);
          if (time > 0) {
            metric.minTime = Math.min(metric.minTime, time);
            metric.maxTime = Math.max(metric.maxTime, time);
          }
          metric.totalTime += time;
          return result;
        } catch (error) {
          metric.errors++;
          throw error;
        }
      }
    });
  }
  private createAsyncProxy<T extends Service>(
    originalMethod: any,
    descriptor: ServiceDescriptor<T>,
    prop: string | symbol
  ) {
    return new Proxy(originalMethod, {
      apply: async (
        fn,
        thisArg,
        args
      ) => {
        const methodName = `${ getServiceName(descriptor) }.${ prop.toString() }`;
        const startTime = Date.now();
        // Initialize _metrics
        if (!this._metrics.has(methodName)) {
          this._metrics.set(methodName, {
            calls: 0,
            totalTime: 0,
            errors: 0,
            minTime: Infinity,
            maxTime: 0
          });
        }
        const metric = this._metrics.get(methodName)!;
        metric.calls++;
        try {
          const result = await Reflect.apply(fn, thisArg, args);
          const endTime = Date.now();
          const time = (endTime - startTime);
          if (time > 0) {
            metric.minTime = Math.min(metric.minTime, time);
            metric.maxTime = Math.max(metric.maxTime, time);
          }
          metric.totalTime += time;
          return result;
        } catch (error) {
          metric.errors++;
          throw error;
        }
      }
    });
  }
  getMetrics(): Map<string, {
    calls: number;
    totalTime: number;
    errors: number;
    avgTime: number;
    minTime: number;
    maxTime: number
  }> {
    const result = new Map();
    for (const [method, metric] of this._metrics) {
      result.set(method, {
        ...metric,
        avgTime: metric.calls > 0 ? metric.totalTime / metric.calls : 0
      });
    }
    return result;
  }
}
