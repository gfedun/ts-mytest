import { Either } from "@/either";
import { UnifiedErrorCode } from "@/exception/ErrorCodes";
import {
  Plugin,
  PluginConfig,
  PluginError
} from "@/plugin";
import { BasePluginLoader } from "./BasePluginLoader";

export class InMemoryPluginInstanceLoader
  extends BasePluginLoader {
  
  readonly name: string = "InMemoryPluginInstanceLoader"
  private _pluginClasses: Map<string, (new () => Plugin) | Plugin> = new Map();
  
  constructor(
    private readonly _pluginConfigs: PluginConfig[],
    private readonly _sourceName: string = "InMemory"
  ) {
    super()
  }
  
  registerClass(
    pluginId: string,
    pluginClass: (new () => Plugin) | Plugin
  ): this {
    this._pluginClasses.set(pluginId, pluginClass);
    this.info(`Registered plugin class: ${ pluginId }`);
    return this;
  }
  
  canLoad(
    pluginId: string,
    config: PluginConfig
  ): boolean {
    return this._pluginClasses.has(pluginId);
  }
  
  async loadPlugin(
    pluginId: string,
    config: PluginConfig
  ): Promise<Either<PluginError, Plugin>> {
    try {
      this.info(`Loading plugin: "${ pluginId }"`);
      const PluginClass = this._pluginClasses.get(pluginId);
      if (!PluginClass) {
        return Either.left(PluginError.create(
          UnifiedErrorCode.PLUGIN_NOT_FOUND,
          `Plugin class not found: "${ pluginId }"`,
          'loadPlugin',
          { pluginId }
        ));
      } else {
        // Instantiate the plugin
        const plugin = PluginClass instanceof Plugin ? PluginClass : new PluginClass();
        // Validate plugin structure
        if (!this.isValidPlugin(plugin)) {
          return Either.left(PluginError.create(
            UnifiedErrorCode.INVALID_PLUGIN_FORMAT,
            `Invalid plugin structure: "${ pluginId }"`,
            'loadPlugin',
            { pluginId }
          ));
        }
        this.info(`Plugin loaded: "${ pluginId }"`);
        return Either.right(plugin);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return Either.left(PluginError.create(
        UnifiedErrorCode.PLUGIN_LOAD_FAILED,
        `Failed to load plugin "${ pluginId }": ${ errorMessage }`,
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
