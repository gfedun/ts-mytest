/**
 * @fileoverview Module-based Plugin Loader
 *
 * This module provides a plugin loader that can load plugins from Node.js modules,
 * supporting both CommonJS and ES modules. It handles dynamic imports and
 * plugin instantiation.
 *
 * @author
 * @version 1.0.0
 */

import { Either } from '@/either';
import { UnifiedErrorCode } from '@/exception/ErrorCodes';
import {
  Plugin,
  PluginConfig,
  PluginError,
} from "@/plugin";
import * as process from "node:process";
import * as path from "path";
import { BasePluginLoader } from "./BasePluginLoader";

/**
 * Loads plugins from Node.js modules
 */
export class ModulePluginLoader
  extends BasePluginLoader {
  
  public readonly name = 'ModulePluginLoader';
  
  constructor() {
    super();
  }
  
  protected async doLoadConfigurations(): Promise<
    Either<PluginError, [string, PluginConfig[]]>
  > {
    return Either.right([this.name, [] as PluginConfig[]]);
  }
  
  canLoad(
    pluginId: string,
    config: PluginConfig
  ): boolean {
    // Can load if config specifies a module path or if pluginId looks like a module
    return !!(config.config?.modulePath ||
      pluginId.startsWith('./') ||
      pluginId.startsWith('../') ||
      !pluginId.includes('/'));
  }
  
  async loadPlugin(
    pluginId: string,
    config: PluginConfig
  ): Promise<Either<PluginError, Plugin>> {
    try {
      const modulePath = this.resolveModulePath(pluginId, config);
      const pluginModule = await import(modulePath);
      // Extract plugin class or factory function
      const PluginClass = pluginModule.default || pluginModule[pluginId] || pluginModule.Plugin;
      if (!PluginClass) {
        return Either.left(PluginError.create(
          UnifiedErrorCode.PLUGIN_LOAD_FAILED,
          `No plugin class found in module: ${ modulePath }`,
          'loadPlugin',
          { pluginId, pluginPath: modulePath, operation: 'loadPlugin', timestamp: new Date() }
        ));
      }
      
      // Create plugin instance
      const plugin = typeof PluginClass === 'function'
        ? new PluginClass(pluginId, config)
        : PluginClass;
      
      if (!plugin || typeof plugin.initialize !== 'function') {
        return Either.left(PluginError.create(
          UnifiedErrorCode.PLUGIN_LOAD_FAILED,
          `Invalid plugin instance from module: ${ modulePath }`,
          'loadPlugin',
          { pluginId, pluginPath: modulePath, operation: 'loadPlugin', timestamp: new Date() }
        ));
      }
      
      return Either.right(plugin);
    } catch (error) {
      return Either.left(PluginError.create(
        UnifiedErrorCode.PLUGIN_LOAD_FAILED,
        `Failed to load plugin from module: ${ error instanceof Error ? error.message : String(error) }`,
        'loadPlugin',
        { pluginId, operation: 'loadPlugin', timestamp: new Date() },
        undefined,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  private resolveModulePath(
    pluginId: string,
    config: PluginConfig
  ): string {
    if (config.config?.modulePath) {
      return config.config.modulePath as string;
    }
    
    if (pluginId.startsWith('./') || pluginId.startsWith('../')) {
      return path.resolve(process.cwd(), pluginId);
    }
    
    return pluginId; // Assume it's a package name
  }
}
