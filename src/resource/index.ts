/**
 * @fileoverview XResource Package - Simplified Resource Management
 *
 * A simplified resource loading system that replaces the complex 'resource' package.
 * Provides clean, functional API for loading resources from various sources.
 *
 * @version 2.0.0 (Simplified Edition)
 */

// Core classes - main API
export { Resource } from './Resource';
export { ResourceSource } from './ResourceSource';
export { ResourceLoader } from './ResourceLoader';

// Error handling
export {
  ResourceError
} from './ResourceError';

// Loader functions for advanced use cases
export { loadFile } from './loaders/fileLoader';
export { loadHttp } from './loaders/httpLoader';
export {
  loadText,
  loadObject
} from './loaders/textLoader';
export { loadAzureBlob } from './loaders/azureBlobLoader';

// Convenience re-exports for common patterns
export type { Either } from '@/either';

// Import classes for use in convenience functions
import { ResourceLoader } from './ResourceLoader';
import { ResourceSource } from './ResourceSource';

/**
 * Default ResourceLoader instance for quick usage
 */
export const defaultLoader = new ResourceLoader();

/**
 * Quick load function using the default loader
 */
export const load = (source: ResourceSource | string) => {
  if (typeof source === 'string') {
    return defaultLoader.loadFromUri(source);
  }
  return defaultLoader.load(source);
};
