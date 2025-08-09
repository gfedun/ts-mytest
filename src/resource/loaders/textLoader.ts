import { Either } from "@/either";
import { Resource } from '../Resource';
import { ResourceError } from '../ResourceError';
import { ResourceSource } from '../ResourceSource';

/**
 * Load a text resource (inline text content)
 */
export async function loadText(
  source: ResourceSource
): Promise<Either<ResourceError, Resource>> {
  const content = source.location;
  const size = Buffer.byteLength(content, 'utf-8');
  
  return Either.right(new Resource(
      source.getResourceName(),
      content,
      'text/plain',
      size,
      new Date()
    )
  );
}

/**
 * Load an object resource (inline JSON content)
 */
export async function loadObject(
  source: ResourceSource
): Promise<Either<ResourceError, Resource>> {
  try {
    const jsonString = source.location;
    // Validate that it's valid JSON
    JSON.parse(jsonString);
    const size = Buffer.byteLength(jsonString, 'utf-8');
    
    return Either.right(
      new Resource(
        source.getResourceName(),
        jsonString,
        'application/json',
        size,
        new Date()
      )
    );
    
  } catch (error) {
    return Either.left(
      ResourceError.contentParseError(
        source.getResourceName(),
        'JSON',
        'object loading',
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined
      )
    );
  }
}
