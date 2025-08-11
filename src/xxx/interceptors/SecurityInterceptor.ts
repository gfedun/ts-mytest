import { RegistryEntryInterceptor } from "@/registry/types";
import {
  getServiceName,
  Service,
  ServiceDescriptor
} from "@/service/Service";

interface ISecurityService {
  authenticate(token: string): boolean;
  authorize(
    userId: string,
    action: string
  ): boolean;
}

class SecurityInterceptor
  implements RegistryEntryInterceptor<Service, ServiceDescriptor> {
  readonly name = 'SecurityInterceptor';
  
  constructor(private securityService: ISecurityService) {}
  
  appliesTo<T extends Service>(descriptor: ServiceDescriptor<T>): boolean {
    // Apply security to banking services
    return getServiceName(descriptor).includes('Banking');
  }
  
  intercept<T extends Service>(
    descriptor: ServiceDescriptor<T>,
    instance: T
  ): T {
    console.log(`Applying security interception to ${ getServiceName(descriptor) }`);
    
    // Create a proxy that intercepts method calls
    return new Proxy(instance as any, {
      get: (
        target,
        prop,
        receiver
      ) => {
        const originalMethod = Reflect.get(target, prop, receiver);
        
        if (typeof originalMethod === 'function') {
          return new Proxy(originalMethod, {
            apply: (
              fn,
              thisArg,
              args
            ) => {
              // Mock authentication check
              const token = 'token123'; // In real app, this would come from context
              if (!this.securityService.authenticate(token)) {
                throw new Error('Authentication failed');
              }
              
              // Mock authorization check
              const userId = 'user1'; // In real app, extracted from token
              const action = prop.toString();
              if (!this.securityService.authorize(userId, action)) {
                throw new Error(`Unauthorized action: ${ action }`);
              }
              
              console.log(`✓ Security check passed for ${ action }`);
              return Reflect.apply(fn, thisArg, args);
            }
          });
        }
        
        return originalMethod;
      }
    });
  }
}
