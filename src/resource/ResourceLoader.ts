import { Either } from "@/either";
import { loadAzureBlob } from "./loaders/azureBlobLoader";
import { loadFile } from "./loaders/fileLoader";
import { loadHttp } from "./loaders/httpLoader";
import {
  loadObject,
  loadText
} from "./loaders/textLoader";
import { Resource } from "./Resource";
import { ResourceError } from "./ResourceError";
import { ResourceSource } from "./ResourceSource";

/**
 * ResourceLoader - Single class for loading resources from various sources
 *
 * Simplified loader that replaces the complex ResourceManager/ResourceManagerImpl system.
 * Handles protocol detection and loading logic internally without separate loader classes.
 */
export class ResourceLoader {
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  
  constructor(options?: {
    timeoutMs?: number;
    maxRetries?: number;
  }) {
    this.timeoutMs = options?.timeoutMs ?? 30000; // 30 seconds default
    this.maxRetries = options?.maxRetries ?? 3;
  }
  
  /**
   * Load a single resource from the given source
   */
  async load(source: ResourceSource): Promise<Either<ResourceError, Resource>> {
    try {
      const resourceName = source.getResourceName();
      
      // Validate protocol support
      if (!this.isProtocolSupported(source.protocol)) {
        return Either.left(
          ResourceError.protocolNotSupported(
            source.protocol,
            this.getSupportedProtocols()
          )
        );
      }
      
      // Load based on protocol
      return await this.loadByProtocol(source);
    } catch (error) {
      const resourceError = error instanceof ResourceError
        ? error
        : ResourceError.loadFailed(
          source.getResourceName(),
          source.location,
          error instanceof Error ? error.message : String(error),
          error instanceof Error ? error : undefined
        );
      
      return Either.left(resourceError);
    }
  }
  
  /**
   * Load multiple resources in parallel
   */
  async loadMany(sources: ResourceSource[]): Promise<Array<Either<ResourceError, Resource>>> {
    const promises = sources.map(source => this.load(source));
    return Promise.all(promises);
  }
  
  /**
   * Load a resource from a URI string
   */
  async loadFromUri(
    uri: string,
    name?: string
  ): Promise<Either<ResourceError, Resource>> {
    try {
      const source = ResourceSource.fromUri(uri, name);
      return this.load(source);
    } catch (error) {
      return Either.left(
        ResourceError.validationFailed(
          name || uri,
          'loadFromUri',
          [`Invalid URI: ${ uri }`],
          error instanceof Error ? error : undefined
        )
      );
    }
  }
  
  /**
   * Check if a protocol is supported
   */
  isProtocolSupported(protocol: string): boolean {
    const supportedProtocols = this.getSupportedProtocols();
    return supportedProtocols.includes(protocol.toLowerCase());
  }
  
  /**
   * Get all supported protocols
   */
  getSupportedProtocols(): string[] {
    return ['file', 'http', 'https', 'text', 'object', 'azure-blob'];
  }
  
  /**
   * Load resource based on protocol
   */
  private async loadByProtocol(
    source: ResourceSource
  ): Promise<Either<ResourceError, Resource>> {
    const protocol = source.protocol.toLowerCase();
    
    switch (protocol) {
      case 'file':
        return loadFile(source);
      
      case 'http':
      case 'https':
        return loadHttp(source, this.timeoutMs);
      
      case 'text':
        return loadText(source);
      
      case 'object':
        return loadObject(source);
      
      case 'azure-blob':
        return loadAzureBlob(source);
      
      default:
        throw ResourceError.protocolNotSupported(protocol, this.getSupportedProtocols());
    }
  }
  
  /**
   * Static factory method to create a ResourceLoader with default settings
   */
  static create(options?: {
    timeoutMs?: number;
    maxRetries?: number;
  }): ResourceLoader {
    return new ResourceLoader(options);
  }
  
  /**
   * Static convenience method to quickly load a resource from a URI
   */
  static async loadFromUri(
    uri: string,
    name?: string
  ): Promise<Either<ResourceError, Resource>> {
    const loader = new ResourceLoader();
    return loader.loadFromUri(uri, name);
  }
}
