import { Either } from "@/either";
import { UnifiedErrorCode } from "@/exception/ErrorCodes";
import {
  Plugin,
  PluginConfig,
  PluginError
} from "@/plugin";
import { BasePluginLoader } from "./BasePluginLoader";

/**
 *
 */
export class InMemoryPluginFactoryLoader
  extends BasePluginLoader {
  
  readonly name: string = "InMemoryPluginFactoryLoader"
  private _factories: Map<string, (config: Record<string, any>) => Plugin> = new Map();
  
  constructor(
    private _pluginConfigs: PluginConfig[],
    private readonly _sourceName: string = "InMemory"
  ) {
    super()
  }
  
  registerFactory(
    pluginId: string,
    factory: (config: Record<string, any>) => Plugin
  ): void {
    this._factories.set(pluginId, factory);
    this.info(`Registered plugin factory: ${ pluginId }`);
  }
  
  canLoad(
    pluginId: string,
    config: PluginConfig
  ): boolean {
    return this._factories.has(pluginId);
  }
  
  loadPlugin(
    pluginId: string,
    config: PluginConfig
  ): Promise<Either<PluginError, Plugin>> {
    return this.doLoadPlugin(pluginId, config)
  }
  
  private async doLoadPlugin(
    pluginId: string,
    config: PluginConfig | undefined
  ): Promise<Either<PluginError, Plugin>> {
    try {
      this.info(`Loading plugin via factory: ${ pluginId }`);
      const factory = this._factories.get(pluginId);
      if (!factory) {
        return Either.left(PluginError.create(
          UnifiedErrorCode.PLUGIN_NOT_FOUND,
          `Plugin factory not found: ${ pluginId }`,
          'loadPlugin',
          { pluginId }
        ));
      }
      // Create plugin using factory
      const plugin = factory(config?.config || {});
      this.info(`Plugin created: ${ plugin.metadata.name }`);
      return Either.right(plugin);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Either.left(PluginError.create(
        UnifiedErrorCode.PLUGIN_LOAD_FAILED,
        `Failed to create plugin ${ pluginId }: ${ errorMessage }`,
        'loadPlugin',
        { pluginId },
        undefined,
        error instanceof Error ? error : undefined
      ));
    }
  }
  
  protected async doLoadConfigurations(): Promise<
    Either<PluginError, [string, PluginConfig[]]>
  > {
    return Either.right([this._sourceName, this._pluginConfigs])
  }
}
