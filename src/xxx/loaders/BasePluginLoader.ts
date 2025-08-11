import { Either } from "@/either";
import { UnifiedErrorCode } from "@/exception/ErrorCodes";
import { ConsoleLogger } from "@/logger";
import { ModelFactory } from "@/model/ModelFactory";
import { ZodValidatorImpl } from "@/model/validation/ZodValidator";
import {
  Plugin,
  PluginConfig,
  PluginConfigSource,
  PluginError,
  PluginLoader,
  PluginType
} from "@/plugin";
import { z } from "zod";

/**
 *
 */
const PluginConfigSchema = z.object({
  id: z.string(),
  enabled: z.boolean().optional().default(true),
  comments: z.string().optional(),
  type: z.enum(['system', 'library', 'user']).optional().default('user'),
  priority: z.number().min(0, 'priority cannot be negative').optional().default(0),
  config: z.record(z.string(), z.any()).optional(),
  dependencies: z.array(z.string()).optional()
});

const LOGGER_NAMESPACE = "[PluginConfigSourcePluginLoader]" as const

/**
 *
 */
export abstract class BasePluginLoader
  implements PluginLoader,
             PluginConfigSource {
  
  readonly abstract name: string;
  protected readonly zodValidator: any;
  
  protected constructor() {
    this.zodValidator = new ZodValidatorImpl(PluginConfigSchema as any)
  }
  
  abstract canLoad(
    pluginId: string,
    config: PluginConfig
  ): boolean;
  
  abstract loadPlugin(
    pluginId: string,
    config: PluginConfig
  ): Promise<Either<PluginError, Plugin>>
  
  protected abstract doLoadConfigurations(): Promise<
    Either<PluginError, [string, PluginConfig[]]>
  >
  
  async loadConfigurations(): Promise<Either<PluginError, PluginConfig[]>> {
    const rvEither = await this.doLoadConfigurations()
    if (Either.isLeft(rvEither)) {
      return Either.left(rvEither.left)
    } else {
      const [resourceName, pluginConfigs] = rvEither.right
      if (pluginConfigs.length == 0) {
        return Either.right([] as any)
      }
      const resultEither = this.validatePluginConfigs(pluginConfigs, resourceName)
      if (Either.isLeft(resultEither)) {
        return Either.left(resultEither.left)
      } else {
        return Either.right(resultEither.right)
      }
    }
    
  }
  
  /**
   *
   * @param plugins
   * @param resourceName
   * @protected
   */
  protected validatePluginConfigs(
    plugins: PluginConfig[],
    resourceName: string
  ): Either<PluginError, PluginConfig[]> {
    const errors: PluginError[] = []
    const pconfs: PluginConfig[] = []
    for (let i = 0; i < plugins.length; i++) {
      const vrEither = this.validatePluginConfig(plugins[i], resourceName, i)
      if (vrEither.isLeft()) {
        errors.push(vrEither.left)
      } else {
        pconfs.push(vrEither.right)
      }
    }
    if (errors.length > 0) {
      // Create a combined error with all validation errors
      const combinedMessage = errors.map(err => err.message).join("\n");
      return Either.left(PluginError.create(
        UnifiedErrorCode.PLUGIN_INVALID_CONFIGURATION,
        `Multiple plugin configuration errors in ${ resourceName }:\n${ combinedMessage }`,
        'validatePluginConfigs',
        {
          configPath: resourceName,
          additionalData: { errorCount: errors.length }
        }
      ));
    }
    return Either.right(pconfs);
  }
  
  protected validatePluginConfig(
    pconf: PluginConfig,
    rname: string,
    index: number
  ): Either<PluginError, PluginConfig> {
    const pluginFactory = ModelFactory.entity<PluginConfig>();
    pluginFactory.setValidator(this.zodValidator)
    const validationResult = pluginFactory.validate(pconf)
    if (validationResult.success) {
      const pc: PluginConfig = {
        priority: 0,
        type: PluginType.User,
        enabled: true,
        ...pconf
      }
      return Either.right(pc)
    } else {
      const errors = validationResult.errors
        .map(err => err.path.join(".") + "=" + err.message)
        .join(" ; ");
      const message = `Error parsing PluginConfig:"${ rname }",` +
        `index:"${ index }",id:"${ pconf.id }": [${ errors }]`
      
      return Either.left(PluginError.create(
        UnifiedErrorCode.PLUGIN_INVALID_CONFIGURATION,
        message,
        'validatePluginConfig',
        {
          pluginId: pconf.id,
          configPath: rname,
          additionalData: {
            configIndex: index,
            validationErrors: validationResult.errors
          }
        }
      ));
    }
  }
  
  protected isValidPlugin(plugin: any): plugin is Plugin {
    return plugin &&
      typeof plugin === 'object' &&
      plugin.metadata &&
      typeof plugin.metadata.id === 'string' &&
      typeof plugin.initialize === 'function' &&
      typeof plugin.start === 'function' &&
      typeof plugin.stop === 'function' &&
      typeof plugin.cleanup === 'function' &&
      typeof plugin.getHealth === 'function';
  }
  
  protected getLogger() {
    return ConsoleLogger
  }
  
  protected debug(
    message: string,
    ...args: any[]
  ): void {
    this.getLogger().debug(`${ LOGGER_NAMESPACE } ${ this.name }, ${ message }`, ...args);
  }
  
  protected info(
    message: string,
    ...args: any[]
  ): void {
    this.getLogger().info(`${ LOGGER_NAMESPACE } ${ this.name }, ${ message }`, ...args);
  }
  
  protected warn(
    message: string,
    ...args: any[]
  ): void {
    this.getLogger().warn(`${ LOGGER_NAMESPACE } ${ this.name }, ${ message }`, ...args);
  }
  
  protected error(
    message: string,
    ...args: any[]
  ): void {
    this.getLogger().error(`${ LOGGER_NAMESPACE } ${ this.name }, ${ message }`, ...args);
  }
  
  watchChanges(
    callback: (configs: PluginConfig[]) => void)
    : () => void {
    return () => {};
  }
}
