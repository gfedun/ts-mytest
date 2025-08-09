import { Either } from "@/either";
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import { Resource } from '../Resource';
import { ResourceError } from '../ResourceError';
import { ResourceSource } from '../ResourceSource';

/**
 * Load an HTTP or HTTPS resource
 */
export async function loadHttp(
  source: ResourceSource,
  timeoutMs: number = 30000
): Promise<Either<ResourceError, Resource>> {
  const url = source.getUri();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      ...source.options as RequestInit
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      if (response.status === 404) {
        return Either.left(
          ResourceError.notFound(source.getResourceName(), url)
        );
      }
      if (response.status === 403 || response.status === 401) {
        return Either.left(
          ResourceError.accessDenied(source.getResourceName(), url)
        );
      }
      return Either.left(
        ResourceError.loadFailed(
          source.getResourceName(),
          url,
          `HTTP ${ response.status }: ${ response.statusText }`
        )
      );
    }
    
    const contentType = response.headers.get('content-type') || undefined;
    const contentLength = response.headers.get('content-length');
    const size = contentLength ? parseInt(contentLength, 10) : undefined;
    const lastModified = response.headers.get('last-modified')
      ? new Date(response.headers.get('last-modified')!)
      : undefined;
    
    const buffer = await response.arrayBuffer();
    const content = Buffer.from(buffer);
    return Either.right(new Resource(
        source.getResourceName(),
        content,
        contentType,
        size,
        lastModified
      )
    );
  } catch (error) {
    clearTimeout(timeoutId);
    
    if ((error as any).name === 'AbortError') {
      return Either.left(
        ResourceError.create(
          UnifiedErrorCode.TIMEOUT_ERROR,
          `HTTP request timed out after ${ timeoutMs }ms for resource '${ source.getResourceName() }'`,
          'loadHttp',
          {
            resourceName: source.getResourceName(),
            location: url,
            resourceType: 'http',
            loadTime: timeoutMs,
            protocol: new URL(url).protocol
          },
          {
            canRetry: true,
            retryDelay: 1000,
            maxRetries: 2,
            suggestions: [
              'Increase timeout value',
              'Check network connectivity',
              'Verify server availability'
            ]
          }
        )
      );
    }
    
    if (error instanceof ResourceError) {
      return Either.left(error)
    }
    
    return Either.left(
      ResourceError.create(
        UnifiedErrorCode.PLUGIN_LOAD_FAILED,
        `Network error loading resource '${ source.getResourceName() }': ${ error instanceof Error ? error.message : String(
          error) }`,
        'loadHttp',
        {
          resourceName: source.getResourceName(),
          location: url,
          resourceType: 'http',
          protocol: new URL(url).protocol,
          networkInfo: {
            errorType: error instanceof Error ? error.name : 'Unknown',
            errorMessage: error instanceof Error ? error.message : String(error)
          }
        },
        {
          canRetry: true,
          retryDelay: 2000,
          maxRetries: 3,
          suggestions: [
            'Check network connectivity',
            'Verify URL is accessible',
            'Check for firewall or proxy issues',
            'Try again later if server is temporarily unavailable'
          ]
        },
        error instanceof Error ? error : undefined
      )
    );
  }
}
