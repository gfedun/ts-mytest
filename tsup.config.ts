import type { Options } from "tsup"

const env = process.env.NODE_ENV

export const tsup: Options = {
  entry: {
    // Main entry point
    index: "src/index.txt",
    // Core modules - preserve folder structure
    "core/config/index": "src/core/config/index.txt",
    "core/config/Config": "src/core/config/Config.ts",
    "core/config/ConfigFactory": "src/core/config/ConfigFactory.ts",
    "core/instance/Instance": "src/core/registry/Instance.ts",
    "core/logger/index": "src/core/logger/index.txt",
    "core/logger/LogBuilder": "src/core/logger/LogBuilder.ts",
    "core/logger/Loggable": "src/core/logger/Loggable.ts",
    "core/logger/Logger": "src/core/logger/Logger.ts",
    "core/logger/LoggerFactory": "src/core/logger/LoggerFactory.ts",
    "core/logger/PinoLogger": "src/core/logger/PinoLogger.ts",
    "core/logger/Redactable": "src/core/logger/Redactable.ts",
    "core/monads/index": "src/core/monads/index.txt",
    "core/monads/Either": "src/core/monads/Either.ts",
    "core/monads/Option": "src/core/monads/Maybe.ts",
    // Examples
    "examples/config/Config": "src/examples/config/Config.ts",
    "examples/config/ConfigFactory": "src/examples/config/ConfigFactory.ts",
    "examples/config/Example": "src/examples/config/Example.ts",
    "examples/logger/Example": "src/examples/logger/Example.ts",
    "examples/logger/LoggerFactory": "src/examples/logger/LoggerFactory.ts",
  },
  splitting: false, // Disable splitting to avoid weird file names
  sourcemap: true,
  clean: true,
  dts: true, // Generate TypeScript declaration files
  format: ["cjs", "esm"], // CommonJS and ES modules
  minify: env === "production",
  bundle: false, // Don't bundle - preserve individual files
  skipNodeModulesBundle: true,
  watch: env === "development",
  target: "es2020",
  outDir: "build",
}
