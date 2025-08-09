import { Either } from "@/either";
import * as fs from 'fs/promises';
import { Resource } from '../Resource';
import { ResourceError } from '../ResourceError';
import { ResourceSource } from '../ResourceSource';

/**
 * Load a file resource from the filesystem
 */
export async function loadFile(
  source: ResourceSource
): Promise<Either<ResourceError, Resource>> {
  try {
    const filePath = source.location;
    const stats = await fs.stat(filePath);
    
    if (!stats.isFile()) {
      return Either.left(
        ResourceError.notFound(source.getResourceName(), filePath)
      );
    }
    
    const content = await fs.readFile(filePath);
    const contentType = guessContentType(filePath);
    
    return Either.right(
      new Resource(
        source.getResourceName(),
        content,
        contentType,
        stats.size,
        stats.mtime
      )
    );
    
  } catch (error) {
    if ((error as any).code === 'ENOENT') {
      return Either.left(
        ResourceError.notFound(source.getResourceName(), source.location)
      );
    }
    if ((error as any).code === 'EACCES') {
      return Either.left(
        ResourceError.accessDenied(source.getResourceName(), source.location, error as Error)
      );
    }
    if (error instanceof ResourceError) {
      return Either.left(error)
    }
    return Either.left(
      ResourceError.loadFailed(
        source.getResourceName(),
        source.location,
        error instanceof Error ? error.message : String(error),
        error instanceof Error ? error : undefined
      )
    );
  }
}

/**
 * Guess content type based on file extension
 */
function guessContentType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  
  const mimeTypes: Record<string, string> = {
    'txt': 'text/plain',
    'json': 'application/json',
    'xml': 'application/xml',
    'html': 'text/html',
    'css': 'text/css',
    'js': 'application/javascript',
    'ts': 'text/typescript',
    'md': 'text/markdown',
    'yml': 'text/yaml',
    'yaml': 'text/yaml',
    'csv': 'text/csv',
    'pdf': 'application/pdf',
    'png': 'image/png',
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'gif': 'image/gif',
    'svg': 'image/svg+xml'
  };
  
  return mimeTypes[ext || ''] || 'application/octet-stream';
}
