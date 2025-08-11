import { Either } from "@/either";
import { UnifiedErrorCode } from "@/exception/ErrorCodes";
import {
  PluginConfig,
  PluginError
} from "@/plugin";
import {
  ResourceLoader,
  ResourceSource
} from "@/resource";
import { BasePluginLoader } from "./BasePluginLoader";

/**
 *
 */
export abstract class FilePluginLoader
  extends BasePluginLoader {
  
  protected constructor(
    private readonly resourceSource: ResourceSource,
    private readonly resourceLoader: ResourceLoader
  ) {
    super();
  }
  
  protected async doLoadConfigurations(): Promise<
    Either<PluginError, [string, PluginConfig[]]>
  > {
    const resourceLoader = this.resourceLoader
    const resourceSource = this.resourceSource
    const contentEither = await resourceLoader.loadResource(resourceSource)
    if (Either.isLeft(contentEither)) {
      return Either.left(PluginError.create(
        UnifiedErrorCode.PLUGIN_LOAD_FAILED,
        `Failed to load configuration resource: ${ contentEither.left.message }`,
        'doLoadConfigurations',
        { configPath: resourceSource.location },
        undefined,
        contentEither.left
      ));
    }
    const dataEither = contentEither.right.asEitherJson()
    if (Either.isLeft(dataEither)) {
      return Either.left(PluginError.create(
        UnifiedErrorCode.INVALID_PLUGIN_FORMAT,
        `Invalid JSON format in configuration: ${ dataEither.left }`,
        'doLoadConfigurations',
        { configPath: resourceSource.location }
      ));
    }
    const resourceName = resourceSource.location
    const data = dataEither.right as any
    if (!Array.isArray(data) && !data.plugins) {
      return Either.left(PluginError.create(
        UnifiedErrorCode.INVALID_PLUGIN_FORMAT,
        `Configuration ${ resourceName } must contain an array of plugins or an object with a "plugins" property`,
        'doLoadConfigurations',
        { configPath: resourceName }
      ));
    }
    const plugins: PluginConfig[] = Array.isArray(data) ? data : data.plugins;
    return Either.right([resourceName, plugins]);
  }
}
