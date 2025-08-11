import { ServiceDescriptor } from "@/service";
import { BasePerformanceInterceptor } from "@/service/interceptors/BasePerformanceInterceptor";
import { Service } from "@/service/Service";

/**
 * Performance monitoring interceptor
 */
export class PerformanceInterceptor
  extends BasePerformanceInterceptor {
  
  constructor() {
    super();
  }
  appliesTo<T extends Service>(descriptor: ServiceDescriptor<T>): boolean {
    return true;
  }
  
}
