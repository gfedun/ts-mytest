import { Either } from "@/either";

/**
 * Resource - Simple data class representing a loaded resource
 *
 * Simplified version without abstractions, complex metadata, or recovery strategies.
 * Contains the essential data and basic content conversion methods.
 */
export class Resource {
  /**
   * Name/identifier of the resource
   */
  readonly name: string;
  
  /**
   * The actual content/data of the resource
   */
  readonly content: unknown;
  
  /**
   * MIME type or content type of the resource (optional)
   */
  readonly contentType?: string | undefined;
  
  /**
   * Size of the resource in bytes (optional)
   */
  readonly size?: number | undefined;
  
  /**
   * When the resource was last modified (optional)
   */
  readonly lastModified?: Date | undefined;
  
  constructor(
    name: string,
    content: unknown,
    contentType?: string,
    size?: number,
    lastModified?: Date
  ) {
    this.name = name;
    this.content = content;
    this.contentType = contentType;
    this.size = size;
    this.lastModified = lastModified;
  }
  
  /**
   * Get the content as a string
   */
  asString(): string {
    if (typeof this.content === 'string') {
      return this.content;
    }
    if (this.content === null || this.content === undefined) {
      return '';
    }
    if (this.content instanceof Buffer) {
      return this.content.toString('utf-8');
    }
    return String(this.content);
  }
  
  /**
   * Get the content as parsed JSON
   * Throws error if parsing fails
   */
  asJson(): unknown {
    const stringContent = this.asString();
    return JSON.parse(stringContent);
  }
  
  /**
   * Get the content as parsed JSON using Either pattern
   * Returns Left with error message if parsing fails
   */
  asEitherJson(): Either<string, unknown> {
    const stringContent = this.asString();
    try {
      return Either.right(JSON.parse(stringContent));
    } catch (error) {
      return Either.left(`Failed to parse JSON for resource '${ this.name }': ${ (error as Error).message }`);
    }
  }
  
  /**
   * Get the content as a Buffer
   */
  asBuffer(): Buffer {
    if (this.content instanceof Buffer) {
      return this.content;
    }
    if (typeof this.content === 'string') {
      return Buffer.from(this.content, 'utf-8');
    }
    if (this.content === null || this.content === undefined) {
      return Buffer.alloc(0);
    }
    // For other types, convert to string first then to buffer
    return Buffer.from(String(this.content), 'utf-8');
  }
  
  /**
   * Get the content as a number
   * Throws error if conversion fails
   */
  asNumber(): number {
    const stringContent = this.asString();
    const num = Number(stringContent);
    if (isNaN(num)) {
      throw new Error(`Failed to convert resource '${ this.name }' content to number`);
    }
    return num;
  }
  
  /**
   * Get the content as a boolean
   */
  asBoolean(): boolean {
    if (typeof this.content === 'boolean') {
      return this.content;
    }
    const stringContent = this.asString().toLowerCase().trim();
    return stringContent === 'true' || stringContent === '1' || stringContent === 'yes';
  }
  
  /**
   * Check if the content is empty
   */
  isEmpty(): boolean {
    if (this.content === null || this.content === undefined) {
      return true;
    }
    if (typeof this.content === 'string') {
      return this.content.trim().length === 0;
    }
    if (this.content instanceof Buffer) {
      return this.content.length === 0;
    }
    return false;
  }
  
  /**
   * Get a simple string representation of the resource
   */
  toString(): string {
    return `Resource(name="${ this.name }", type="${ this.contentType || 'unknown' }", size=${ this.size || 'unknown' })`;
  }
  
  /**
   * Static factory method to create a resource
   */
  static create(
    name: string,
    content: unknown,
    options?: {
      contentType?: string;
      size?: number;
      lastModified?: Date;
    }
  ): Resource {
    return new Resource(
      name,
      content,
      options?.contentType,
      options?.size,
      options?.lastModified
    );
  }
  
  /**
   * Static factory method to create a text resource
   */
  static text(
    name: string,
    content: string
  ): Resource {
    return new Resource(
      name,
      content,
      'text/plain',
      Buffer.byteLength(content, 'utf-8')
    );
  }
  
  /**
   * Static factory method to create a JSON resource
   */
  static json(
    name: string,
    content: unknown
  ): Resource {
    const jsonString = JSON.stringify(content);
    return new Resource(
      name,
      jsonString,
      'application/json',
      Buffer.byteLength(jsonString, 'utf-8')
    );
  }
  
  /**
   * Static factory method to create a binary resource
   */
  static binary(
    name: string,
    content: Buffer,
    contentType?: string
  ): Resource {
    return new Resource(
      name,
      content,
      contentType || 'application/octet-stream',
      content.length
    );
  }
}
