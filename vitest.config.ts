// vitest.config.ts
import { defineConfig } from "vitest/config"

import path from "path"

export default defineConfig({
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    test: {
        // Enable multi-threading
        //threads: true,
        
        // clear mocks before each test
        // clearMocks: true,
        
        // Configure globals
        globals: true,
        
        // Environment setup
        environment: "node",
        
        // Include patterns
        include: ["**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
        
        // Coverage settings
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
            exclude: ["node_modules/", "build/", "**/*.d.ts", "**/*.test.{js,ts}", "**/*.config.{js,ts}"],
        },
    },
})
