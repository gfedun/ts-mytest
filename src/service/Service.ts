export const symbolRegistryEntry: unique symbol = Symbol.for("@system/RegistryEntry")

export type RegistryEntryDescriptor<T> = {
  new(...args: any[]): T;
  readonly [symbolRegistryEntry]: () => symbol
} | {
  prototype: T;
  readonly [symbolRegistryEntry]: () => symbol
}

/**
 * ServiceDescriptor
 *
 */
export function getRegistryEntryDescriptorInfo<T>(
  descriptor: RegistryEntryDescriptor<T>
): [symbol, string] {
  const symbolValue = descriptor[symbolRegistryEntry]();
  return [symbolValue, symbolValue.description!]
}

/**
 * ServiceDescriptor
 *
 */
export type ServiceDescriptor<T extends Service = Service> = RegistryEntryDescriptor<T>

/**
 * getServiceDescriptorInfo
 *
 */
export function getServiceDescriptorInfo<T extends Service = Service>(
  descriptor: ServiceDescriptor<T>
): [symbol, string] {
  const symbolValue = descriptor[symbolRegistryEntry]();
  return [symbolValue, symbolValue.description!]
}

export function getServiceSymbol<T extends Service = Service>(
  descriptor: ServiceDescriptor<T>
): symbol {
  return descriptor[symbolRegistryEntry]();
}

export function getServiceName<T extends Service = Service>(
  descriptor: ServiceDescriptor<T>
): string {
  const symbolValue = descriptor[symbolRegistryEntry]();
  return symbolValue.description ?? "unknown"
}

/**
 * Plugin metadata describing a plugin's properties
 */
export interface ServiceMetadata {
  /** Human-readable service name */
  readonly name: string;
  /** Service description */
  readonly description?: string;
  /** Service version */
  readonly version?: string;
  /** Service author/vendor */
  readonly author?: string;
  /** Required dependencies (other service IDs) */
  // readonly dependencies?: readonly string[];
}

export abstract class Service {
  abstract readonly [symbolRegistryEntry]: () => symbol
  protected constructor(readonly metadata: ServiceMetadata) {
  }
}
