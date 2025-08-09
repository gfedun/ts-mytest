/**
 * ResourceSource - Simple data class representing where a resource is located
 *
 * Simplified version without abstractions or complex authentication systems.
 * Contains the essential information needed to locate and load a resource.
 */
export class ResourceSource {
  /**
   * The protocol used to access the resource (e.g., 'file', 'http', 'https', 'text', 'object')
   */
  readonly protocol: string;
  
  /**
   * The location/path of the resource
   */
  readonly location: string;
  
  /**
   * The resource name/identifier (optional, can be derived from location)
   */
  readonly name?: string | undefined;
  
  /**
   * Optional credentials or authentication information
   */
  readonly credentials?: Record<string, unknown> | undefined;
  
  /**
   * Additional options or parameters for accessing the resource
   */
  readonly options?: Record<string, unknown> | undefined;
  
  constructor(
    protocol: string,
    location: string,
    name?: string,
    credentials?: Record<string, unknown>,
    options?: Record<string, unknown>
  ) {
    this.protocol = protocol.toLowerCase();
    this.location = location;
    this.name = name;
    this.credentials = credentials;
    this.options = options;
  }
  
  /**
   * Get the full URI representation of this resource source
   */
  getUri(): string {
    return `${ this.protocol }://${ this.location }`;
  }
  
  /**
   * Get the resource name, either explicit or derived from location
   */
  getResourceName(): string {
    if (this.name) {
      return this.name;
    }
    
    // Extract name from location (last part of path)
    const parts = this.location.split('/');
    const lastPart = parts[parts.length - 1];
    
    // If location ends with slash or is empty, use the protocol as name
    if (!lastPart || lastPart === '') {
      return this.protocol;
    }
    
    return lastPart;
  }
  
  /**
   * Check if the source has credentials
   */
  hasCredentials(): boolean {
    return this.credentials !== undefined && Object.keys(this.credentials).length > 0;
  }
  
  /**
   * Check if the source has options
   */
  hasOptions(): boolean {
    return this.options !== undefined && Object.keys(this.options).length > 0;
  }
  
  /**
   * Get a simple string representation
   */
  toString(): string {
    return this.getUri();
  }
  
  /**
   * Static factory method to create a resource source
   */
  static create(
    protocol: string,
    location: string,
    name?: string,
    credentials?: Record<string, unknown>,
    options?: Record<string, unknown>
  ): ResourceSource {
    return new ResourceSource(protocol, location, name, credentials, options);
  }
  
  /**
   * Static factory method to create a file resource source
   */
  static file(
    filePath: string,
    name?: string
  ): ResourceSource {
    return new ResourceSource('file', filePath, name);
  }
  
  /**
   * Static factory method to create an HTTP resource source
   */
  static http(
    url: string,
    name?: string,
    options?: Record<string, unknown>
  ): ResourceSource {
    return new ResourceSource('http', url, name, undefined, options);
  }
  
  /**
   * Static factory method to create an HTTPS resource source
   */
  static https(
    url: string,
    name?: string,
    options?: Record<string, unknown>
  ): ResourceSource {
    return new ResourceSource('https', url, name, undefined, options);
  }
  
  /**
   * Static factory method to create a text resource source (inline text)
   */
  static text(
    content: string,
    name?: string
  ): ResourceSource {
    return new ResourceSource('text', content, name || 'inline-text');
  }
  
  /**
   * Static factory method to create an object resource source (inline object)
   */
  static object(
    data: unknown,
    name?: string
  ): ResourceSource {
    return new ResourceSource('object', JSON.stringify(data), name || 'inline-object');
  }
  
  /**
   * Static factory method to create an Azure Blob resource source
   */
  static azureBlob(
    containerName: string,
    blobName: string,
    credentials?: Record<string, unknown>,
    options?: Record<string, unknown>
  ): ResourceSource {
    return new ResourceSource(
      'azure-blob',
      `${ containerName }/${ blobName }`,
      blobName,
      credentials,
      options
    );
  }
  
  /**
   * Static factory method to parse a URI string into a ResourceSource
   */
  static fromUri(
    uri: string,
    name?: string
  ): ResourceSource {
    const urlPattern = /^([a-zA-Z][a-zA-Z0-9+.-]*):\/\/(.+)$/;
    const match = uri.match(urlPattern);
    
    if (!match) {
      throw new Error(`Invalid URI format: ${ uri }`);
    }
    
    const [, protocol, location] = match;
    return new ResourceSource(protocol, location, name);
  }
  
  /**
   * Check if two ResourceSource instances are equal
   */
  equals(other: ResourceSource): boolean {
    return (
      this.protocol === other.protocol &&
      this.location === other.location &&
      this.name === other.name
    );
  }
  
  /**
   * Create a copy of this ResourceSource with modified properties
   */
  with(changes: {
    protocol?: string;
    location?: string;
    name?: string;
    credentials?: Record<string, unknown>;
    options?: Record<string, unknown>;
  }): ResourceSource {
    return new ResourceSource(
      changes.protocol ?? this.protocol,
      changes.location ?? this.location,
      changes.name ?? this.name,
      changes.credentials ?? this.credentials,
      changes.options ?? this.options
    );
  }
}

